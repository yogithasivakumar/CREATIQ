import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabaseClient, FakeSupabaseStore } from "./fakeSupabase.js";

const store = new FakeSupabaseStore();

vi.mock("../src/services/supabase.service.js", () => ({
  getSupabaseAdminClient: () => createFakeSupabaseClient(store),
}));

const { getUserSettings, updateUserSettings } = await import(
  "../src/services/settings.service.js"
);

beforeEach(() => {
  store.reset();
});

describe("settings.service", () => {
  it("creates a default settings row on first access", async () => {
    const settings = await getUserSettings("user-1");

    expect(settings.defaultCaptionStyle).toBe("product_highlight");
    expect(settings.defaultTone).toBe("engaging_friendly");
    expect(settings.defaultLength).toBe("medium");
    expect(settings.hashtagCount).toBe(5);
    expect(store.tables.user_settings).toHaveLength(1);
  });

  it("reuses the existing row on a later call instead of creating a duplicate", async () => {
    await getUserSettings("user-1");
    await getUserSettings("user-1");

    expect(store.tables.user_settings).toHaveLength(1);
  });

  it("updates only the fields provided, leaving the rest unchanged", async () => {
    await getUserSettings("user-1");

    const updated = await updateUserSettings("user-1", { defaultTone: "luxurious" });

    expect(updated.defaultTone).toBe("luxurious");
    expect(updated.defaultCaptionStyle).toBe("product_highlight");
  });

  it("persists custom hashtags and scheduling timezone", async () => {
    await getUserSettings("user-1");

    const updated = await updateUserSettings("user-1", {
      customHashtags: ["MyBrand", "Summer2026"],
      schedulingTimezone: "America/New_York",
    });

    expect(updated.customHashtags).toEqual(["MyBrand", "Summer2026"]);
    expect(updated.schedulingTimezone).toBe("America/New_York");
  });

  it("keeps settings isolated between different users", async () => {
    await getUserSettings("user-1");
    await updateUserSettings("user-1", { defaultTone: "playful" });

    const otherUserSettings = await getUserSettings("user-2");

    expect(otherUserSettings.defaultTone).toBe("engaging_friendly");
  });
});
