import { randomUUID } from "node:crypto";

// A minimal, in-memory fake of the subset of the supabase-js client
// this project's services actually use (table select/insert/update/
// delete with eq/ilike/or/order/range/count, plus storage
// upload/remove/createSignedUrl). This is deliberately not a mock of
// individual chained calls — it's a small real implementation over an
// in-memory store, so tests exercise real filtering/ownership logic
// (e.g. "does workspace A ever see workspace B's rows") instead of
// asserting that specific methods were called in a specific order.

type Row = Record<string, unknown>;

export class FakeSupabaseStore {
  tables: Record<string, Row[]> = {
    workspaces: [],
    workspace_members: [],
    projects: [],
    assets: [],
    generation_jobs: [],
    generation_outputs: [],
  };

  storageFiles = new Map<string, Buffer>();

  // Lets a test simulate a real-world DB/storage failure (e.g. the
  // actual incident this was added for: an INSERT into `assets`
  // failing because a migration adding project_id/prompt had never
  // been applied to the live database, which surfaced to the user as
  // a bare 500) without needing a real Postgres connection.
  failNextInsert = new Map<string, string>();
  failNextUpload = false;

  reset(): void {
    for (const key of Object.keys(this.tables)) {
      this.tables[key] = [];
    }
    this.storageFiles.clear();
    this.failNextInsert.clear();
    this.failNextUpload = false;
  }
}

function applyFilters(rows: Row[], filters: { col: string; op: string; val: unknown }[]): Row[] {
  return rows.filter((row) =>
    filters.every(({ col, op, val }) => {
      const cell = row[col];
      if (op === "eq") return cell === val;
      if (op === "ilike") {
        const pattern = String(val).replace(/^%|%$/g, "");
        return String(cell ?? "").toLowerCase().includes(pattern.toLowerCase());
      }
      return true;
    })
  );
}

class QueryBuilder {
  private filters: { col: string; op: string; val: unknown }[] = [];
  private orFilters: { col: string; val: unknown }[] = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | undefined;
  private wantSingle = false;
  private wantCount = false;

  constructor(
    private store: FakeSupabaseStore,
    private table: string
  ) {}

  select(_columns: string, opts?: { count?: string }): this {
    if (this.mode === "select") {
      // no-op, select is the default
    }
    this.wantCount = Boolean(opts?.count);
    return this;
  }

  insert(payload: Row): this {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Row): this {
    this.mode = "update";
    this.payload = payload;
    return this;
  }

  delete(): this {
    this.mode = "delete";
    return this;
  }

  eq(col: string, val: unknown): this {
    this.filters.push({ col, op: "eq", val });
    return this;
  }

  or(expr: string): this {
    // Minimal parser for "col.ilike.%term%,col2.ilike.%term%"
    for (const clause of expr.split(",")) {
      const [col, op, val] = clause.split(".");
      if (op === "ilike") {
        this.orFilters.push({ col, val });
      }
    }
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  range(from: number, to: number): this {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  limit(_n: number): this {
    return this;
  }

  single(): this {
    this.wantSingle = true;
    return this;
  }

  maybeSingle(): this {
    this.wantSingle = true;
    return this;
  }

  then(
    resolve: (value: { data: unknown; error: null; count?: number }) => unknown,
    reject?: (reason: unknown) => unknown
  ): unknown {
    try {
      return Promise.resolve(this.execute()).then(resolve, reject);
    } catch (error) {
      if (reject) return reject(error);
      throw error;
    }
  }

  private execute(): { data: unknown; error: null; count?: number } {
    const rows = this.store.tables[this.table] ?? (this.store.tables[this.table] = []);

    if (this.mode === "insert") {
      const failureMessage = this.store.failNextInsert.get(this.table);
      if (failureMessage) {
        this.store.failNextInsert.delete(this.table);
        return { data: null, error: new Error(failureMessage) } as unknown as {
          data: unknown;
          error: null;
        };
      }

      const row: Row = { id: randomUUID(), created_at: new Date().toISOString(), ...this.payload };
      if (!("updated_at" in row)) row.updated_at = row.created_at;
      if (!("status" in row) && this.table === "projects") row.status = "active";
      rows.push(row);

      // Simulates the add_workspace_owner DB trigger: creating a
      // workspace always creates the owner's membership row too, so
      // getOrCreateDefaultWorkspace's membership lookup finds it on
      // the next call instead of creating a duplicate workspace.
      if (this.table === "workspaces") {
        (this.store.tables.workspace_members ??= []).push({
          workspace_id: row.id,
          user_id: row.owner_id,
          role: "owner",
          created_at: row.created_at,
        });
      }

      return { data: this.wantSingle ? row : [row], error: null };
    }

    let filtered = applyFilters(rows, this.filters);

    if (this.orFilters.length > 0) {
      filtered = filtered.filter((row) =>
        this.orFilters.some(({ col, val }) => {
          const pattern = String(val).replace(/^%|%$/g, "");
          return String(row[col] ?? "").toLowerCase().includes(pattern.toLowerCase());
        })
      );
    }

    if (this.mode === "update") {
      for (const row of filtered) {
        Object.assign(row, this.payload, { updated_at: new Date().toISOString() });
      }
      const result = this.wantSingle ? filtered[0] ?? null : filtered;
      return { data: result, error: null };
    }

    if (this.mode === "delete") {
      const idsToDelete = new Set(filtered.map((r) => r.id));
      this.store.tables[this.table] = rows.filter((r) => !idsToDelete.has(r.id));
      return { data: null, error: null };
    }

    // select
    const total = filtered.length;

    if (this.orderCol) {
      filtered = [...filtered].sort((a, b) => {
        const av = String(a[this.orderCol!]);
        const bv = String(b[this.orderCol!]);
        return this.orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }

    if (this.rangeFrom !== null && this.rangeTo !== null) {
      filtered = filtered.slice(this.rangeFrom, this.rangeTo + 1);
    }

    if (this.wantSingle) {
      return { data: filtered[0] ?? null, error: null };
    }

    return { data: filtered, error: null, count: this.wantCount ? total : undefined };
  }
}

function buildStorageApi(store: FakeSupabaseStore, bucket: string) {
  return {
    upload: async (key: string, buffer: Buffer) => {
      if (store.failNextUpload) {
        store.failNextUpload = false;
        return { data: null, error: new Error("Simulated storage upload failure") };
      }
      store.storageFiles.set(`${bucket}/${key}`, buffer);
      return { data: { path: key }, error: null };
    },
    remove: async (keys: string[]) => {
      for (const key of keys) {
        store.storageFiles.delete(`${bucket}/${key}`);
      }
      return { data: null, error: null };
    },
    createSignedUrl: async (key: string, expiresIn: number) => {
      if (!store.storageFiles.has(`${bucket}/${key}`)) {
        return { data: null, error: new Error("Object not found") };
      }
      return {
        data: { signedUrl: `https://example.supabase.co/signed/${bucket}/${key}?ttl=${expiresIn}` },
        error: null,
      };
    },
    getBucket: async () => ({ data: { name: bucket }, error: null }),
  };
}

export function createFakeSupabaseClient(store: FakeSupabaseStore) {
  return {
    from(table: string) {
      return new QueryBuilder(store, table);
    },
    storage: {
      from(bucket: string) {
        return buildStorageApi(store, bucket);
      },
    },
    auth: {
      getUser: async () => ({ data: { user: null }, error: new Error("not used in this fake") }),
    },
  };
}
