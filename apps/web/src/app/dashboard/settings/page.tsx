"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { NavIcon } from "@/components/dashboard/NavIcon";
import {
  CAPTION_LENGTHS,
  CAPTION_STYLES,
  CAPTION_TONES,
  type CaptionLength,
  type CaptionStyle,
  type CaptionTone,
} from "@/components/instagram/types";
import type { InstagramStatus } from "@/components/instagram/types";

interface UserSettings {
  defaultCaptionStyle: CaptionStyle;
  defaultTone: CaptionTone;
  defaultLength: CaptionLength;
  hashtagCount: number;
  customHashtags: string[];
  publishNowDefault: boolean;
  schedulingTimezone: string;
  displayName: string | null;
}

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const [instagramStatus, setInstagramStatus] = useState<InstagramStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [instagramError, setInstagramError] = useState("");

  useEffect(() => {
    apiFetch<{ settings: UserSettings }>("/api/settings")
      .then((data) => setSettings(data.settings))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Could not load settings."))
      .finally(() => setLoading(false));

    apiFetch<InstagramStatus>("/api/instagram/status")
      .then(setInstagramStatus)
      .catch(() => {
        // Non-fatal: the connected-account section just shows "not connected".
      });
  }, []);

  function updateField<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function handleSave() {
    if (!settings) return;

    setSaving(true);
    setSaveError("");
    setSaved(false);

    try {
      const data = await apiFetch<{ settings: UserSettings }>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      setSettings(data.settings);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnectInstagram() {
    setDisconnecting(true);
    setInstagramError("");
    try {
      await apiFetch("/api/instagram/disconnect", { method: "POST" });
      setInstagramStatus({ connected: false, username: null, status: null });
    } catch (err) {
      setInstagramError(err instanceof ApiError ? err.message : "Could not disconnect Instagram.");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleConnectInstagram() {
    setInstagramError("");
    try {
      const data = await apiFetch<{ url: string }>("/api/instagram/connect");
      window.location.href = data.url;
    } catch (err) {
      setInstagramError(err instanceof ApiError ? err.message : "Could not start the Instagram connection.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-aubergine">Settings</h1>
        <p className="mt-1 text-sm text-aubergine/70">
          Manage your account, caption defaults, and connected accounts.
        </p>
      </header>

      {loadError && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {loadError}
        </p>
      )}

      {loading || !settings ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-aubergine/5" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-aubergine/10 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-aubergine/60">Profile</h2>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-aubergine">Display name</label>
              <input
                value={settings.displayName ?? ""}
                onChange={(e) => updateField("displayName", e.target.value || null)}
                maxLength={120}
                placeholder="Your name"
                className="w-full rounded-xl border border-aubergine/15 px-4 py-2.5 text-sm outline-none focus:border-marigold"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-aubergine/10 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-aubergine/60">
              Caption Defaults
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-aubergine/70">
                  Default style
                </label>
                <select
                  value={settings.defaultCaptionStyle}
                  onChange={(e) => updateField("defaultCaptionStyle", e.target.value as CaptionStyle)}
                  className="w-full rounded-xl border border-aubergine/15 px-3 py-2 text-sm text-aubergine outline-none focus:border-marigold"
                >
                  {CAPTION_STYLES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-aubergine/70">
                  Default tone
                </label>
                <select
                  value={settings.defaultTone}
                  onChange={(e) => updateField("defaultTone", e.target.value as CaptionTone)}
                  className="w-full rounded-xl border border-aubergine/15 px-3 py-2 text-sm text-aubergine outline-none focus:border-marigold"
                >
                  {CAPTION_TONES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-aubergine/70">
                  Default length
                </label>
                <select
                  value={settings.defaultLength}
                  onChange={(e) => updateField("defaultLength", e.target.value as CaptionLength)}
                  className="w-full rounded-xl border border-aubergine/15 px-3 py-2 text-sm text-aubergine outline-none focus:border-marigold"
                >
                  {CAPTION_LENGTHS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold text-aubergine/70">
                Hashtag count ({settings.hashtagCount})
              </label>
              <input
                type="range"
                min={0}
                max={30}
                value={settings.hashtagCount}
                onChange={(e) => updateField("hashtagCount", Number(e.target.value))}
                className="w-full accent-marigold"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold text-aubergine/70">
                Custom hashtags (comma-separated)
              </label>
              <input
                value={settings.customHashtags.join(", ")}
                onChange={(e) =>
                  updateField(
                    "customHashtags",
                    e.target.value
                      .split(",")
                      .map((h) => h.trim().replace(/^#/, ""))
                      .filter(Boolean)
                  )
                }
                placeholder="MyBrand, LuxuryLiving"
                className="w-full rounded-xl border border-aubergine/15 px-4 py-2.5 text-sm outline-none focus:border-marigold"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-aubergine/10 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-aubergine/60">
              Publishing Preferences
            </h2>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-aubergine">Default to Publish Now</p>
                <p className="text-xs text-aubergine/50">
                  When off, Schedule for Later is selected by default instead.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={settings.publishNowDefault}
                onClick={() => updateField("publishNowDefault", !settings.publishNowDefault)}
                className={`h-6 w-11 rounded-full transition ${
                  settings.publishNowDefault ? "bg-marigold" : "bg-aubergine/15"
                }`}
              >
                <span
                  className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white transition ${
                    settings.publishNowDefault ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold text-aubergine/70">
                Scheduling timezone
              </label>
              <select
                value={settings.schedulingTimezone}
                onChange={(e) => updateField("schedulingTimezone", e.target.value)}
                className="w-full rounded-xl border border-aubergine/15 px-3 py-2 text-sm text-aubergine outline-none focus:border-marigold"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-aubergine/40">
                Note: scheduled posts are persisted but require manual publishing from the
                Scheduled Posts list once due — there is no background job that publishes them
                automatically. See the Instagram Publishing README in the repository for what
                real automation would require.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-aubergine/10 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-aubergine/60">
              Connected Accounts
            </h2>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-aubergine/10 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-aubergine/5 text-aubergine">
                  <NavIcon name="instagram" className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-aubergine">Instagram</p>
                  <p className="text-xs text-aubergine/50">
                    {instagramStatus?.connected
                      ? `Connected${instagramStatus.username ? ` as @${instagramStatus.username}` : ""}`
                      : instagramStatus?.status === "expired"
                        ? "Connection expired — reconnect to publish"
                        : "Not connected"}
                  </p>
                </div>
              </div>

              {instagramStatus?.connected ? (
                <button
                  onClick={handleDisconnectInstagram}
                  disabled={disconnecting}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              ) : (
                <button
                  onClick={handleConnectInstagram}
                  className="rounded-lg bg-gradient-to-r from-marigold to-aubergine px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  Connect
                </button>
              )}
            </div>
            {instagramError && <p className="mt-2 text-xs text-red-600">{instagramError}</p>}
          </section>

          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-aubergine px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-aubergine/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
            {saved && <span className="text-sm font-medium text-green-700">Saved.</span>}
            {saveError && <span className="text-sm text-red-600">{saveError}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
