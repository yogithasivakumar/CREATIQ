import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: mockGetSession },
  }),
}));

const originalFetch = global.fetch;

const DEFAULT_SETTINGS = {
  defaultCaptionStyle: "product_highlight",
  defaultTone: "engaging_friendly",
  defaultLength: "medium",
  hashtagCount: 5,
  customHashtags: [],
  publishNowDefault: true,
  schedulingTimezone: "UTC",
  displayName: null,
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

const { default: SettingsPage } = await import("../src/app/dashboard/settings/page");

function mockFetchRouter(options?: { saveFails?: boolean; connected?: boolean }) {
  const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes("/api/settings") && init?.method === "PATCH") {
      if (options?.saveFails) {
        return { status: 400, ok: false, json: async () => ({ error: "Invalid hashtag count" }) };
      }
      const body = JSON.parse(init.body as string);
      return {
        status: 200,
        ok: true,
        json: async () => ({ ok: true, settings: { ...DEFAULT_SETTINGS, ...body } }),
      };
    }
    if (url.includes("/api/settings")) {
      return { status: 200, ok: true, json: async () => ({ ok: true, settings: DEFAULT_SETTINGS }) };
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
    return { status: 200, ok: true, json: async () => ({ ok: true }) };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("SettingsPage", () => {
  it("loads and displays the user's current settings", async () => {
    mockFetchRouter();
    render(<SettingsPage />);

    expect(await screen.findByDisplayValue("5")).toBeInTheDocument();
  });

  it("saves a changed setting and shows a success confirmation", async () => {
    const fetchMock = mockFetchRouter();
    const user = userEvent.setup();
    render(<SettingsPage />);

    await screen.findByText(/caption defaults/i);

    const toneSelect = screen.getByDisplayValue("Engaging & Friendly");
    await user.selectOptions(toneSelect, "luxurious");

    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(screen.getByText(/^saved\.$/i)).toBeInTheDocument();
    });

    const patchCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === "PATCH"
    );
    expect(patchCall).toBeTruthy();
    expect(JSON.parse((patchCall![1] as RequestInit).body as string).defaultTone).toBe("luxurious");
  });

  it("shows a visible error when saving fails", async () => {
    mockFetchRouter({ saveFails: true });
    const user = userEvent.setup();
    render(<SettingsPage />);

    await screen.findByText(/caption defaults/i);
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid hashtag count/i)).toBeInTheDocument();
    });
  });

  it("shows Instagram as not connected with a Connect button by default", async () => {
    mockFetchRouter({ connected: false });
    render(<SettingsPage />);

    expect(await screen.findByText(/not connected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^connect$/i })).toBeInTheDocument();
  });

  it("shows the connected Instagram username with a Disconnect button", async () => {
    mockFetchRouter({ connected: true });
    render(<SettingsPage />);

    expect(await screen.findByText(/connected as @creatiq.studio/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
  });
});
