import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabaseClient, FakeSupabaseStore } from "./fakeSupabase.js";

const store = new FakeSupabaseStore();

vi.mock("../src/services/supabase.service.js", () => ({
  getSupabaseAdminClient: () => createFakeSupabaseClient(store),
}));

const { createProject } = await import("../src/services/projects.service.js");
const {
  deleteAsset,
  getAsset,
  listAssets,
  saveGeneratedAsset,
} = await import("../src/services/assets.service.js");

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

describe("assets.service", () => {
  describe("saveGeneratedAsset", () => {
    it("saves a valid generated image and returns a signed URL", async () => {
      const asset = await saveGeneratedAsset("workspace-1", "user-1", {
        image: VALID_JPEG_BASE64,
        prompt: "a red bicycle",
      });

      expect(asset.prompt).toBe("a red bicycle");
      expect(asset.mimeType).toBe("image/jpeg");
      expect(asset.width).toBe(512);
      expect(asset.height).toBe(512);
      expect(asset.url).toContain("signed");
    });

    it("records a generation_jobs row and links it via generation_outputs", async () => {
      await saveGeneratedAsset("workspace-1", "user-1", {
        image: VALID_JPEG_BASE64,
        prompt: "a mountain at sunrise",
      });

      expect(store.tables.generation_jobs).toHaveLength(1);
      expect(store.tables.generation_jobs[0]).toMatchObject({
        status: "succeeded",
        prompt: "a mountain at sunrise",
      });
      expect(store.tables.generation_outputs).toHaveLength(1);
    });

    it("rejects an invalid/corrupt image payload", async () => {
      await expect(
        saveGeneratedAsset("workspace-1", "user-1", {
          image: Buffer.from("not a real jpeg").toString("base64"),
        })
      ).rejects.toThrow();

      expect(store.tables.assets).toHaveLength(0);
    });

    it("rejects saving to a project that belongs to a different workspace (IDOR check)", async () => {
      const otherWorkspaceProject = await createProject("workspace-2", "user-2", {
        name: "Not yours",
      });

      await expect(
        saveGeneratedAsset("workspace-1", "user-1", {
          image: VALID_JPEG_BASE64,
          projectId: otherWorkspaceProject.id,
        })
      ).rejects.toThrow(/not found/i);

      expect(store.tables.assets).toHaveLength(0);
    });

    it("associates the asset with a project in the same workspace", async () => {
      const project = await createProject("workspace-1", "user-1", { name: "Campaign A" });

      const asset = await saveGeneratedAsset("workspace-1", "user-1", {
        image: VALID_JPEG_BASE64,
        projectId: project.id,
      });

      expect(asset.projectId).toBe(project.id);
    });
  });

  describe("listAssets / getAsset / deleteAsset — ownership isolation", () => {
    it("never returns another workspace's assets in a list call", async () => {
      await saveGeneratedAsset("workspace-1", "user-1", { image: VALID_JPEG_BASE64 });
      await saveGeneratedAsset("workspace-2", "user-2", { image: VALID_JPEG_BASE64 });

      const page = await listAssets("workspace-1", {
        sort: "newest",
        page: 1,
        pageSize: 24,
      });

      expect(page.items).toHaveLength(1);
      expect(page.total).toBe(1);
    });

    it("filters assets by search term against the stored prompt", async () => {
      await saveGeneratedAsset("workspace-1", "user-1", {
        image: VALID_JPEG_BASE64,
        prompt: "a red bicycle",
      });
      await saveGeneratedAsset("workspace-1", "user-1", {
        image: VALID_JPEG_BASE64,
        prompt: "a mountain landscape",
      });

      const page = await listAssets("workspace-1", {
        search: "bicycle",
        sort: "newest",
        page: 1,
        pageSize: 24,
      });

      expect(page.items).toHaveLength(1);
      expect(page.items[0].prompt).toBe("a red bicycle");
    });

    it("filters assets by project", async () => {
      const project = await createProject("workspace-1", "user-1", { name: "P1" });
      await saveGeneratedAsset("workspace-1", "user-1", {
        image: VALID_JPEG_BASE64,
        projectId: project.id,
      });
      await saveGeneratedAsset("workspace-1", "user-1", { image: VALID_JPEG_BASE64 });

      const page = await listAssets("workspace-1", {
        projectId: project.id,
        sort: "newest",
        page: 1,
        pageSize: 24,
      });

      expect(page.items).toHaveLength(1);
    });

    it("paginates results", async () => {
      for (let i = 0; i < 5; i++) {
        await saveGeneratedAsset("workspace-1", "user-1", { image: VALID_JPEG_BASE64 });
      }

      const page1 = await listAssets("workspace-1", { sort: "newest", page: 1, pageSize: 2 });
      const page2 = await listAssets("workspace-1", { sort: "newest", page: 2, pageSize: 2 });

      expect(page1.items).toHaveLength(2);
      expect(page2.items).toHaveLength(2);
      expect(page1.total).toBe(5);
    });

    it("rejects reading another workspace's asset by id (IDOR check)", async () => {
      const asset = await saveGeneratedAsset("workspace-1", "user-1", {
        image: VALID_JPEG_BASE64,
      });

      await expect(getAsset("workspace-2", asset.id)).rejects.toThrow(/not found/i);
    });

    it("rejects deleting another workspace's asset (IDOR check)", async () => {
      const asset = await saveGeneratedAsset("workspace-1", "user-1", {
        image: VALID_JPEG_BASE64,
      });

      await expect(deleteAsset("workspace-2", asset.id)).rejects.toThrow(/not found/i);
      expect(store.tables.assets).toHaveLength(1);
    });

    it("deletes the storage file and the database row together", async () => {
      const asset = await saveGeneratedAsset("workspace-1", "user-1", {
        image: VALID_JPEG_BASE64,
      });

      await deleteAsset("workspace-1", asset.id);

      expect(store.tables.assets).toHaveLength(0);
      expect(store.storageFiles.size).toBe(0);
    });
  });
});
