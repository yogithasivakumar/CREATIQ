import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "../src/components/library/types";

const mockGetSession = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: mockGetSession },
  }),
}));

const originalFetch = global.fetch;

const PROJECTS = [
  { id: "project-a", name: "Spring Launch", description: null, status: "active" as const, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "project-b", name: "Summer Sale", description: null, status: "active" as const, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

const ASSET_UNASSIGNED: Asset = {
  id: "asset-1",
  projectId: null,
  prompt: "a red bicycle",
  mimeType: "image/jpeg",
  width: 512,
  height: 512,
  fileSizeBytes: 12345,
  createdAt: "2026-01-01T00:00:00.000Z",
  url: "https://example.supabase.co/signed/asset-1.jpg",
};

beforeEach(() => {
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: "test-access-token" } },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

const { default: AssetLibraryPage } = await import(
  "../src/app/dashboard/assets/page"
);

function mockFetchRouter(asset = ASSET_UNASSIGNED) {
  let currentAsset = { ...asset };

  const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes("/api/projects") && (!init || init.method === undefined)) {
      return { status: 200, ok: true, json: async () => ({ ok: true, projects: PROJECTS }) };
    }
    if (url.includes("/api/assets") && (!init || init.method === undefined)) {
      return {
        status: 200,
        ok: true,
        json: async () => ({ ok: true, items: [currentAsset], total: 1 }),
      };
    }
    if (url.includes("/api/assets/") && init?.method === "PATCH") {
      const body = JSON.parse(init.body as string);
      currentAsset = { ...currentAsset, projectId: body.projectId };
      return { status: 200, ok: true, json: async () => ({ ok: true, asset: currentAsset }) };
    }
    return { status: 200, ok: true, json: async () => ({ ok: true }) };
  });

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("AssetLibraryPage — assign to project", () => {
  it("opens the assign-project modal from the asset card and lists all projects plus 'No project'", async () => {
    mockFetchRouter();
    const user = userEvent.setup();
    render(<AssetLibraryPage />);

    const assignButton = await screen.findByRole("button", { name: /move to project/i });
    await user.click(assignButton);

    const dialog = await screen.findByRole("dialog", { name: /move to project/i });
    expect(within(dialog).getByText("No project")).toBeInTheDocument();
    expect(within(dialog).getByText("Spring Launch")).toBeInTheDocument();
    expect(within(dialog).getByText("Summer Sale")).toBeInTheDocument();
  });

  it("assigns an unassigned asset to a project and shows the project badge on the card", async () => {
    const fetchMock = mockFetchRouter();
    const user = userEvent.setup();
    render(<AssetLibraryPage />);

    const assignButton = await screen.findByRole("button", { name: /move to project/i });
    await user.click(assignButton);

    const dialog = await screen.findByRole("dialog", { name: /move to project/i });
    await user.click(within(dialog).getByText("Spring Launch"));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /move to project/i })).not.toBeInTheDocument();
    });

    const patchCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === "PATCH"
    );
    expect(patchCall).toBeTruthy();
    expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({
      projectId: "project-a",
    });

    await waitFor(() => {
      expect(screen.getByText("Spring Launch", { selector: "span" })).toBeInTheDocument();
    });
  });

  it("unassigns an asset's project by selecting 'No project'", async () => {
    const fetchMock = mockFetchRouter({ ...ASSET_UNASSIGNED, projectId: "project-a" });
    const user = userEvent.setup();
    render(<AssetLibraryPage />);

    const assignButton = await screen.findByRole("button", { name: /move to project/i });
    await user.click(assignButton);

    const dialog = await screen.findByRole("dialog", { name: /move to project/i });
    await user.click(within(dialog).getByText("No project"));

    const patchCall = await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === "PATCH"
      );
      expect(call).toBeTruthy();
      return call!;
    });
    expect(JSON.parse((patchCall[1] as RequestInit).body as string)).toEqual({
      projectId: null,
    });
  });

  it("filters projects in the modal via the search box when there are many projects", async () => {
    const manyProjects = Array.from({ length: 7 }, (_, i) => ({
      id: `project-${i}`,
      name: `Project ${i}`,
      description: null,
      status: "active" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }));

    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/projects") && !init?.method) {
        return { status: 200, ok: true, json: async () => ({ ok: true, projects: manyProjects }) };
      }
      if (url.includes("/api/assets") && !init?.method) {
        return {
          status: 200,
          ok: true,
          json: async () => ({ ok: true, items: [ASSET_UNASSIGNED], total: 1 }),
        };
      }
      return { status: 200, ok: true, json: async () => ({ ok: true }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<AssetLibraryPage />);

    const assignButton = await screen.findByRole("button", { name: /move to project/i });
    await user.click(assignButton);

    const dialog = await screen.findByRole("dialog", { name: /move to project/i });
    const searchBox = within(dialog).getByPlaceholderText(/search projects/i);
    await user.type(searchBox, "Project 3");

    expect(within(dialog).getByText("Project 3")).toBeInTheDocument();
    expect(within(dialog).queryByText("Project 0")).not.toBeInTheDocument();
  });

  it("shows a visible error in the modal when assignment fails", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/projects") && !init?.method) {
        return { status: 200, ok: true, json: async () => ({ ok: true, projects: PROJECTS }) };
      }
      if (url.includes("/api/assets") && !init?.method) {
        return {
          status: 200,
          ok: true,
          json: async () => ({ ok: true, items: [ASSET_UNASSIGNED], total: 1 }),
        };
      }
      if (init?.method === "PATCH") {
        return { status: 404, ok: false, json: async () => ({ error: "Project not found" }) };
      }
      return { status: 200, ok: true, json: async () => ({ ok: true }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<AssetLibraryPage />);

    const assignButton = await screen.findByRole("button", { name: /move to project/i });
    await user.click(assignButton);

    const dialog = await screen.findByRole("dialog", { name: /move to project/i });
    await user.click(within(dialog).getByText("Spring Launch"));

    await waitFor(() => {
      expect(within(dialog).getByRole("alert")).toHaveTextContent(/project not found/i);
    });

    // The modal stays open so the user can try a different project.
    expect(screen.getByRole("dialog", { name: /move to project/i })).toBeInTheDocument();
  });
});
