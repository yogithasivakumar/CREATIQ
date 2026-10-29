import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ProjectsPage calls apiFetch, which calls createClient() from
// @/lib/supabase/client and then supabase.auth.getSession(). None of
// that (or a real network call) should run in this test — only the
// Create button's own enabled/disabled logic and click wiring are
// under test here, so both are mocked.
const mockGetSession = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: mockGetSession },
  }),
}));

const originalFetch = global.fetch;

beforeEach(() => {
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: "test-access-token" } },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

const { default: ProjectsPage } = await import(
  "../src/app/dashboard/projects/page"
);

describe("ProjectsPage — Create button enabled/disabled behavior", () => {
  it("disables the Create button when the name input is empty", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ ok: true, projects: [] }),
    }) as unknown as typeof fetch;

    render(<ProjectsPage />);

    const createButton = await screen.findByRole("button", { name: /create/i });
    expect(createButton).toBeDisabled();
  });

  it("enables the Create button once a non-empty name is typed", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ ok: true, projects: [] }),
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<ProjectsPage />);

    const input = await screen.findByPlaceholderText(/new project name/i);
    const createButton = screen.getByRole("button", { name: /create/i });

    expect(createButton).toBeDisabled();

    await user.type(input, "Spring Launch");

    expect(createButton).toBeEnabled();
  });

  it("disables the Create button again for whitespace-only input", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ ok: true, projects: [] }),
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<ProjectsPage />);

    const input = await screen.findByPlaceholderText(/new project name/i);
    const createButton = screen.getByRole("button", { name: /create/i });

    await user.type(input, "   ");

    expect(createButton).toBeDisabled();
  });

  it("calls POST /api/projects with the trimmed name when Create is clicked, and shows the new project", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return {
          status: 201,
          ok: true,
          json: async () => ({
            ok: true,
            project: {
              id: "11111111-1111-1111-1111-111111111111",
              name: "Spring Launch",
              description: null,
              status: "active",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          }),
        };
      }
      return { status: 200, ok: true, json: async () => ({ ok: true, projects: [] }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<ProjectsPage />);

    const input = await screen.findByPlaceholderText(/new project name/i);
    const createButton = screen.getByRole("button", { name: /create/i });

    await user.type(input, "  Spring Launch  ");
    expect(createButton).toBeEnabled();

    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText("Spring Launch")).toBeInTheDocument();
    });

    const postCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === "POST"
    );
    expect(postCall).toBeTruthy();
    expect(JSON.parse((postCall![1] as RequestInit).body as string)).toEqual({
      name: "Spring Launch",
    });

    // The input clears and the button goes back to disabled once the
    // name field is empty again.
    expect(input).toHaveValue("");
    expect(createButton).toBeDisabled();
  });

  it("shows a 'Creating...' label on the button while the request is in flight", async () => {
    let resolvePost!: (value: unknown) => void;
    const postPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });

    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        await postPromise;
        return {
          status: 201,
          ok: true,
          json: async () => ({
            ok: true,
            project: {
              id: "22222222-2222-2222-2222-222222222222",
              name: "Pending Project",
              description: null,
              status: "active",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          }),
        };
      }
      return { status: 200, ok: true, json: async () => ({ ok: true, projects: [] }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<ProjectsPage />);

    const input = await screen.findByPlaceholderText(/new project name/i);
    const createButton = screen.getByRole("button", { name: /create/i });

    await user.type(input, "Pending Project");
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
    });

    resolvePost(undefined);

    await waitFor(() => {
      expect(screen.getByText("Pending Project")).toBeInTheDocument();
    });
  });

  it("shows a visible error and keeps the button usable when creation fails", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return {
          status: 500,
          ok: false,
          json: async () => ({ error: "Internal server error" }),
        };
      }
      return { status: 200, ok: true, json: async () => ({ ok: true, projects: [] }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<ProjectsPage />);

    const input = await screen.findByPlaceholderText(/new project name/i);
    const createButton = screen.getByRole("button", { name: /create/i });

    await user.type(input, "Will Fail");
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/internal server error/i);
    });

    // The failed attempt doesn't leave the button stuck disabled —
    // the user can see the error and try again.
    expect(createButton).toBeEnabled();
  });
});
