import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabaseClient, FakeSupabaseStore } from "./fakeSupabase.js";

const store = new FakeSupabaseStore();

vi.mock("../src/services/supabase.service.js", () => ({
  getSupabaseAdminClient: () => createFakeSupabaseClient(store),
}));

const { createProject } = await import("../src/services/projects.service.js");
const { saveGeneratedAsset, updateAssetProject } = await import(
  "../src/services/assets.service.js"
);

function buildValidJpeg(width = 512, height = 512): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const sof0 = Buffer.from([
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00,
  ]);
  const padding = Buffer.alloc(600, 0x00);
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([soi, sof0, padding, eoi]);
}

const VALID_JPEG_BASE64 = buildValidJpeg().toString("base64");

beforeEach(() => {
  store.reset();
});

describe("assets.service — updateAssetProject", () => {
  it("assigns an unassigned asset to a project in the same workspace", async () => {
    const project = await createProject("workspace-1", "user-1", { name: "Spring Launch" });
    const asset = await saveGeneratedAsset("workspace-1", "user-1", { image: VALID_JPEG_BASE64 });

    expect(asset.projectId).toBeNull();

    const updated = await updateAssetProject("workspace-1", asset.id, {
      projectId: project.id,
    });

    expect(updated.projectId).toBe(project.id);
  });

  it("moves an asset from one project to another", async () => {
    const projectA = await createProject("workspace-1", "user-1", { name: "A" });
    const projectB = await createProject("workspace-1", "user-1", { name: "B" });
    const asset = await saveGeneratedAsset("workspace-1", "user-1", {
      image: VALID_JPEG_BASE64,
      projectId: projectA.id,
    });

    const moved = await updateAssetProject("workspace-1", asset.id, {
      projectId: projectB.id,
    });

    expect(moved.projectId).toBe(projectB.id);
  });

  it("unassigns an asset's project with projectId: null", async () => {
    const project = await createProject("workspace-1", "user-1", { name: "Spring Launch" });
    const asset = await saveGeneratedAsset("workspace-1", "user-1", {
      image: VALID_JPEG_BASE64,
      projectId: project.id,
    });

    const unassigned = await updateAssetProject("workspace-1", asset.id, {
      projectId: null,
    });

    expect(unassigned.projectId).toBeNull();
  });

  it("rejects an invalid (nonexistent) project id with a not-found error", async () => {
    const asset = await saveGeneratedAsset("workspace-1", "user-1", { image: VALID_JPEG_BASE64 });

    await expect(
      updateAssetProject("workspace-1", asset.id, {
        projectId: "00000000-0000-0000-0000-000000000000",
      })
    ).rejects.toThrow(/not found/i);
  });

  it("rejects assigning an asset to a project in a different workspace (cross-workspace IDOR check)", async () => {
    const otherWorkspaceProject = await createProject("workspace-2", "user-2", {
      name: "Not yours",
    });
    const asset = await saveGeneratedAsset("workspace-1", "user-1", { image: VALID_JPEG_BASE64 });

    await expect(
      updateAssetProject("workspace-1", asset.id, {
        projectId: otherWorkspaceProject.id,
      })
    ).rejects.toThrow(/not found/i);
  });

  it("rejects updating an asset that belongs to a different workspace (cross-workspace IDOR check)", async () => {
    const project = await createProject("workspace-1", "user-1", { name: "Mine" });
    const asset = await saveGeneratedAsset("workspace-2", "user-2", { image: VALID_JPEG_BASE64 });

    await expect(
      updateAssetProject("workspace-1", asset.id, { projectId: project.id })
    ).rejects.toThrow(/not found/i);
  });

  it("throws a not-found error for a nonexistent asset id", async () => {
    await expect(
      updateAssetProject("workspace-1", "00000000-0000-0000-0000-000000000000", {
        projectId: null,
      })
    ).rejects.toThrow(/not found/i);
  });
});
