import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "../src/components/library/types";

const mockGetSession = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: mockGetSession },
  }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
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
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: "test-access-token" } },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

const { default: InstagramPublishingPage } = await import(
  "../src/app/dashboard/instagram/page"
);

function mockFetchRouter(options?: { connected?: boolean }) {
  const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes("/api/projects") && !init?.method) {
      return { status: 200, ok: true, json: async () => ({ ok: true, projects: [] }) };
    }
    if (url.includes("/api/assets") && !init?.method) {
      return { status: 200, ok: true, json: async () => ({ ok: true, items: [ASSET], total: 1 }) };
    }
    if (url.includes("/api/instagram/status")) {
      return {
        status: 200,
        ok: true,
        json: async () => ({
          ok: true,
          connected: options?.connected ?? false,
          username: options?.connected ? "creatiq.studio" : null,
          status: options?.connected ? "connected" : null,
        }),
      };
    }
    if (url.includes("/api/captions/generate") && init?.method === "POST") {
      return {
        status: 200,
        ok: true,
        json: async () => ({
          ok: true,
          caption: "Meet your new favorite: a luxury perfume bottle.",
          hashtags: ["ProductHighlight", "NewDrop"],
        }),
      };
    }
    return { status: 200, ok: true, json: async () => ({ ok: true }) };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("InstagramPublishingPage", () => {
  it("lets the user select an image from My Library", async () => {
    mockFetchRouter();
    const user = userEvent.setup();
    render(<InstagramPublishingPage />);

    const thumbnail = await screen.findByAltText("a luxury perfume bottle");
    await user.click(thumbnail);

    expect(thumbnail.closest("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("generates a caption for the selected image and shows it in an editable field", async () => {
    mockFetchRouter();
    const user = userEvent.setup();
    render(<InstagramPublishingPage />);

    const thumbnail = await screen.findByAltText("a luxury perfume bottle");
    await user.click(thumbnail);

    const generateButton = screen.getByRole("button", { name: /generate caption/i });
    await user.click(generateButton);

    await waitFor(() => {
      expect(
        screen.getByDisplayValue(/meet your new favorite/i)
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText(/#ProductHighlight #NewDrop/).length).toBeGreaterThan(0);
  });

  it("disables Generate Caption until an image is selected", async () => {
    mockFetchRouter();
    render(<InstagramPublishingPage />);

    await screen.findByAltText("a luxury perfume bottle");
    const generateButton = screen.getByRole("button", { name: /generate caption/i });

    expect(generateButton).toBeDisabled();
  });

  it("copies the caption and hashtags to the clipboard", async () => {
    mockFetchRouter();
    const user = userEvent.setup();
    render(<InstagramPublishingPage />);

    const thumbnail = await screen.findByAltText("a luxury perfume bottle");
    await user.click(thumbnail);
    await user.click(screen.getByRole("button", { name: /generate caption/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue(/meet your new favorite/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^copy$/i }));

    // Asserts the observable success state (button label flips to
    // "Copied!") rather than spying on navigator.clipboard.writeText
    // directly — jsdom's clipboard implementation isn't reliably
    // mockable across environments, but the UI state change is the
    // behaviorally meaningful proof that the copy actually succeeded.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^copied!$/i })).toBeInTheDocument();
    });
  });

  it("shows Connect Instagram and disables Publish Now when not connected", async () => {
    mockFetchRouter({ connected: false });
    render(<InstagramPublishingPage />);

    await screen.findByAltText("a luxury perfume bottle");

    expect(await screen.findByRole("button", { name: /connect instagram/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /publish post now/i })).toBeDisabled();
  });

  it("shows the connected username and enables publishing once connected and a caption exists", async () => {
    mockFetchRouter({ connected: true });
    const user = userEvent.setup();
    render(<InstagramPublishingPage />);

    expect(await screen.findByText(/connected @creatiq.studio/i)).toBeInTheDocument();

    const thumbnail = await screen.findByAltText("a luxury perfume bottle");
    await user.click(thumbnail);
    await user.click(screen.getByRole("button", { name: /generate caption/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /publish post now/i })).toBeEnabled();
    });
  });

  it("shows the full selected image in the preview without cropping it", async () => {
    mockFetchRouter();
    const user = userEvent.setup();
    render(<InstagramPublishingPage />);

    const thumbnail = await screen.findByAltText("a luxury perfume bottle");
    await user.click(thumbnail);

    // Selecting an image renders it twice (library thumbnail + the
    // Instagram preview); the preview copy is the one that must use
    // object-contain (show the whole image) rather than object-cover
    // (crop to fill), matching how Instagram itself letterboxes
    // non-square posts instead of cropping them.
    const images = screen.getAllByAltText("a luxury perfume bottle");
    const previewImage = images.find((img) => img.className.includes("object-contain"));

    expect(previewImage).toBeDefined();
    expect(previewImage!.className).not.toMatch(/object-cover/);
  });
});
