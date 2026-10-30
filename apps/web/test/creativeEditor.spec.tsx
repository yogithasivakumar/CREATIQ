import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "../src/components/library/types";

const mockGetSession = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession: mockGetSession } }),
}));

let searchParamsValue = new URLSearchParams();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsValue,
  useRouter: () => ({ push: mockPush }),
}));

// Smoke-level coverage per the time-boxed directive: mocks the
// useFabricEditor hook itself (not raw Fabric.js, which needs a real
// canvas 2D context jsdom doesn't provide without the native `canvas`
// package) so these tests exercise the page's real wiring — button
// clicks calling the right handlers, export triggering a real
// download, save making a real POST /api/assets call — without
// depending on canvas rendering internals.
const mockEditor = {
  ready: true,
  canUndo: false,
  canRedo: false,
  hasSelection: false,
  dirty: false,
  adjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0 },
  filterPreset: "original" as const,
  zoom: 1,
  dimensions: { width: 512, height: 512 },
  cropping: false,
  activeObject: null,
  initCanvas: vi.fn(() => () => {}),
  loadImage: vi.fn(),
  setAdjustment: vi.fn(),
  commitAdjustments: vi.fn(),
  applyFilterPreset: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  reset: vi.fn(),
  rotate: vi.fn(),
  flip: vi.fn(),
  startCrop: vi.fn(),
  applyCrop: vi.fn(),
  cancelCrop: vi.fn(),
  resizeCanvas: vi.fn(),
  addText: vi.fn(),
  addShape: vi.fn(),
  deleteSelected: vi.fn(),
  updateSelectedProps: vi.fn(),
  commitSelectedProps: vi.fn(),
  setZoomLevel: vi.fn(),
  fitToScreen: vi.fn(),
  setContainer: vi.fn(),
  exportDataUrl: vi.fn(() => "data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh"),
  getCanvas: vi.fn(() => ({ discardActiveObject: vi.fn(), requestRenderAll: vi.fn() })),
};

vi.mock("@/components/creative-editor/useFabricEditor", () => ({
  useFabricEditor: () => mockEditor,
}));

const originalFetch = global.fetch;

const ASSET: Asset = {
  id: "asset-1",
  projectId: null,
  prompt: "a luxury perfume bottle",
  mimeType: "image/jpeg",
  width: 512,
  height: 512,
  fileSizeBytes: 12345,
  createdAt: "2026-01-01T00:00:00.000Z",
  url: "https://example.supabase.co/signed/asset-1.jpg",
};

beforeEach(() => {
  mockGetSession.mockResolvedValue({ data: { session: { access_token: "test-access-token" } } });
  searchParamsValue = new URLSearchParams({ assetId: "asset-1" });
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.clearAllMocks();
});

function mockFetchRouter() {
  const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes("/api/assets/asset-1") && !init?.method) {
      return { status: 200, ok: true, json: async () => ({ ok: true, asset: ASSET }) };
    }
    if (url.includes("/api/assets") && init?.method === "POST") {
      return { status: 201, ok: true, json: async () => ({ ok: true, asset: { ...ASSET, id: "asset-2" } }) };
    }
    if (url.includes("/api/projects")) {
      return { status: 200, ok: true, json: async () => ({ ok: true, projects: [] }) };
    }
    return { status: 200, ok: true, json: async () => ({ ok: true }) };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("CreativeEditorPage", () => {
  it("renders the editor workspace once an image loads", async () => {
    mockFetchRouter();
    const { default: CreativeEditorPage } = await import("../src/app/dashboard/creative-editor/page");
    render(<CreativeEditorPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^save$/i })).toBeInTheDocument();
    });
  });

  it("adding text calls the editor's addText operation", async () => {
    mockFetchRouter();
    const { default: CreativeEditorPage } = await import("../src/app/dashboard/creative-editor/page");
    const user = userEvent.setup();
    render(<CreativeEditorPage />);

    await screen.findByRole("button", { name: /^save$/i });
    await user.click(screen.getByRole("button", { name: /^text$/i }));
    await user.click(screen.getByRole("button", { name: /add text/i }));

    expect(mockEditor.addText).toHaveBeenCalled();
  });

  it("export opens the export modal and triggers a real download", async () => {
    mockFetchRouter();
    const { default: CreativeEditorPage } = await import("../src/app/dashboard/creative-editor/page");
    const user = userEvent.setup();
    render(<CreativeEditorPage />);

    await screen.findByRole("button", { name: /^save$/i });
    await user.click(screen.getByRole("button", { name: /^export$/i }));
    await user.click(screen.getByRole("button", { name: /^download$/i }));

    expect(mockEditor.exportDataUrl).toHaveBeenCalledWith("jpeg", expect.any(Number));
  });

  it("save calls POST /api/assets with the exported image", async () => {
    const fetchMock = mockFetchRouter();
    const { default: CreativeEditorPage } = await import("../src/app/dashboard/creative-editor/page");
    const user = userEvent.setup();
    render(<CreativeEditorPage />);

    await screen.findByRole("button", { name: /^save$/i });
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await user.click(screen.getAllByRole("button", { name: /^save$/i })[1]);

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        (call) => (call[1] as RequestInit | undefined)?.method === "POST"
      );
      expect(postCall).toBeTruthy();
      const body = JSON.parse((postCall![1] as RequestInit).body as string);
      expect(body.image).toBe("ZmFrZS1pbWFnZS1kYXRh");
    });

    expect(await screen.findByText(/saved to my library/i)).toBeInTheDocument();
  });
});
