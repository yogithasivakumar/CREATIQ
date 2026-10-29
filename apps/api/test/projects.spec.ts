import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabaseClient, FakeSupabaseStore } from "./fakeSupabase.js";

const store = new FakeSupabaseStore();

vi.mock("../src/services/supabase.service.js", () => ({
  getSupabaseAdminClient: () => createFakeSupabaseClient(store),
}));

const {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} = await import("../src/services/projects.service.js");

beforeEach(() => {
  store.reset();
});

describe("projects.service", () => {
  it("creates a project scoped to the given workspace", async () => {
    const project = await createProject("workspace-1", "user-1", { name: "Spring Launch" });

    expect(project.name).toBe("Spring Launch");
    expect(project.status).toBe("active");
    expect(store.tables.projects[0]).toMatchObject({
      workspace_id: "workspace-1",
      created_by: "user-1",
    });
  });

  it("lists only projects belonging to the requested workspace (ownership isolation)", async () => {
    await createProject("workspace-1", "user-1", { name: "Workspace 1 project" });
    await createProject("workspace-2", "user-2", { name: "Workspace 2 project" });

    const workspace1Projects = await listProjects("workspace-1");

    expect(workspace1Projects).toHaveLength(1);
    expect(workspace1Projects[0].name).toBe("Workspace 1 project");
  });

  it("renames a project within its own workspace", async () => {
    const created = await createProject("workspace-1", "user-1", { name: "Old name" });

    const updated = await updateProject("workspace-1", created.id, { name: "New name" });

    expect(updated.name).toBe("New name");
  });

  it("rejects updating a project that belongs to a different workspace", async () => {
    const created = await createProject("workspace-1", "user-1", { name: "Mine" });

    await expect(
      updateProject("workspace-2", created.id, { name: "Hijacked" })
    ).rejects.toThrow(/not found/i);
  });

  it("rejects deleting a project that belongs to a different workspace", async () => {
    const created = await createProject("workspace-1", "user-1", { name: "Mine" });

    await expect(deleteProject("workspace-2", created.id)).rejects.toThrow(/not found/i);
    expect(store.tables.projects).toHaveLength(1);
  });

  it("deletes a project within its own workspace", async () => {
    const created = await createProject("workspace-1", "user-1", { name: "Delete me" });

    await deleteProject("workspace-1", created.id);

    expect(store.tables.projects).toHaveLength(0);
  });

  it("throws a not-found error when updating a nonexistent project", async () => {
    await expect(
      updateProject("workspace-1", "00000000-0000-0000-0000-000000000000", { name: "x" })
    ).rejects.toThrow(/not found/i);
  });
});
