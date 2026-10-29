import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabaseClient, FakeSupabaseStore } from "./fakeSupabase.js";

const store = new FakeSupabaseStore();

vi.mock("../src/services/supabase.service.js", () => ({
  getSupabaseAdminClient: () => createFakeSupabaseClient(store),
}));

const { getOrCreateDefaultWorkspace } = await import("../src/services/workspace.service.js");

beforeEach(() => {
  store.reset();
});

describe("getOrCreateDefaultWorkspace", () => {
  it("creates a new workspace and owner membership for a first-time user", async () => {
    const workspaceId = await getOrCreateDefaultWorkspace("user-1");

    expect(typeof workspaceId).toBe("string");
    expect(store.tables.workspaces).toHaveLength(1);
    expect(store.tables.workspaces[0]).toMatchObject({
      owner_id: "user-1",
      name: "My Workspace",
    });
  });

  it("reuses the existing workspace on a later call for the same user", async () => {
    const first = await getOrCreateDefaultWorkspace("user-2");
    const second = await getOrCreateDefaultWorkspace("user-2");

    expect(second).toBe(first);
    expect(store.tables.workspaces).toHaveLength(1);
  });

  it("gives different users different workspaces", async () => {
    const workspaceA = await getOrCreateDefaultWorkspace("user-a");
    const workspaceB = await getOrCreateDefaultWorkspace("user-b");

    expect(workspaceA).not.toBe(workspaceB);
  });
});
