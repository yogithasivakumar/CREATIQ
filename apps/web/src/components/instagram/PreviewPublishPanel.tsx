"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { NavIcon } from "@/components/dashboard/NavIcon";
import type { Asset } from "@/components/library/types";
import type { InstagramStatus } from "./types";

type PublishMode = "now" | "schedule";

export function PreviewPublishPanel({
  selectedAsset,
  caption,
  hashtags,
  instagramStatus,
  onConnect,
  onPublished,
}: {
  selectedAsset: Asset | null;
  caption: string;
  hashtags: string[];
  instagramStatus: InstagramStatus | null;
  onConnect: () => void;
  onPublished: () => void;
}) {
  const [mode, setMode] = useState<PublishMode>("now");
  const [scheduledFor, setScheduledFor] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fullCaption = hashtags.length > 0 ? `${caption}\n\n${hashtags.map((h) => `#${h}`).join(" ")}` : caption;
  const canPublish = Boolean(selectedAsset && caption.trim() && instagramStatus?.connected);

  async function handlePublishNow() {
    if (!selectedAsset) return;

    setPublishing(true);
    setError("");
    setSuccess("");

    try {
      await apiFetch("/api/instagram/publish", {
        method: "POST",
        body: JSON.stringify({ assetId: selectedAsset.id, caption: fullCaption }),
      });
      setSuccess("Published to Instagram.");
      onPublished();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not publish this post.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleSchedule() {
    if (!selectedAsset || !scheduledFor) {
      setError("Choose a date and time to schedule for.");
      return;
    }

    setPublishing(true);
    setError("");
    setSuccess("");

    try {
      await apiFetch("/api/instagram/schedule", {
        method: "POST",
        body: JSON.stringify({
          assetId: selectedAsset.id,
          caption,
          hashtags,
          scheduledFor: new Date(scheduledFor).toISOString(),
        }),
      });
      setSuccess("Post scheduled. You'll need to publish it manually from Scheduled Posts once it's due — see Settings for details.");
      onPublished();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not schedule this post.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-aubergine/10 bg-white p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-aubergine/60">
        3. Preview &amp; Publish
      </h2>
      <p className="mt-1 text-xs text-aubergine/50">See how your post will look and schedule or publish.</p>

      {/* Instagram-style preview card */}
      <div className="mt-4 overflow-hidden rounded-xl border border-aubergine/10">
        <div className="flex items-center gap-2 border-b border-aubergine/10 p-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-marigold to-aubergine text-xs font-bold text-white">
            {(instagramStatus?.username ?? "C")[0].toUpperCase()}
          </span>
          <span className="text-xs font-semibold text-aubergine">
            {instagramStatus?.username ? `@${instagramStatus.username}` : "creatiq.studio"}
          </span>
        </div>

        <div className="flex aspect-square w-full items-center justify-center bg-black">
          {selectedAsset ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedAsset.url}
              alt={selectedAsset.prompt ?? "Selected asset"}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-silver text-xs text-aubergine/40">
              Select an image to preview
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 p-3 text-aubergine/60">
          <NavIcon name="heart" className="h-5 w-5" />
          <NavIcon name="comment" className="h-5 w-5" />
          <NavIcon name="send" className="h-5 w-5" />
          <span className="ml-auto">
            <NavIcon name="bookmark" className="h-5 w-5" />
          </span>
        </div>

        <div className="px-3 pb-3 text-xs text-aubergine">
          {caption ? (
            <p className="whitespace-pre-wrap">
              <span className="font-semibold">{instagramStatus?.username ?? "creatiq.studio"}</span>{" "}
              {caption}
            </p>
          ) : (
            <p className="text-aubergine/40">Your caption will appear here.</p>
          )}
          {hashtags.length > 0 && (
            <p className="mt-1 text-marigold">{hashtags.map((h) => `#${h}`).join(" ")}</p>
          )}
        </div>
      </div>

      {/* Connection status */}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-aubergine/10 p-3">
        {instagramStatus?.connected ? (
          <>
            <span className="flex items-center gap-2 text-xs font-semibold text-green-700">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Connected {instagramStatus.username ? `@${instagramStatus.username}` : ""}
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-2 text-xs font-semibold text-aubergine/60">
              <span className="h-2 w-2 rounded-full bg-aubergine/30" />
              {instagramStatus?.status === "expired" ? "Connection expired" : "Not connected"}
            </span>
            <button
              onClick={onConnect}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-marigold to-aubergine px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              <NavIcon name="instagram" className="h-3.5 w-3.5" />
              Connect Instagram
            </button>
          </>
        )}
      </div>

      {/* Publish controls */}
      <div className="mt-4">
        <div className="flex gap-1 rounded-xl bg-silver p-1">
          <button
            onClick={() => setMode("now")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              mode === "now" ? "bg-white text-aubergine shadow-sm" : "text-aubergine/60"
            }`}
          >
            Publish Now
          </button>
          <button
            onClick={() => setMode("schedule")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              mode === "schedule" ? "bg-white text-aubergine shadow-sm" : "text-aubergine/60"
            }`}
          >
            Schedule for Later
          </button>
        </div>

        {mode === "schedule" && (
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="mt-3 w-full rounded-lg border border-aubergine/15 px-3 py-2 text-xs text-aubergine outline-none focus:border-marigold"
          />
        )}

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        {success && <p className="mt-2 text-xs text-green-700">{success}</p>}

        <button
          onClick={mode === "now" ? handlePublishNow : handleSchedule}
          disabled={publishing || !canPublish || (mode === "schedule" && !scheduledFor)}
          aria-label={mode === "now" ? "Publish post now" : "Schedule post for later"}
          title={
            !instagramStatus?.connected
              ? "Connect an Instagram account first"
              : !selectedAsset
                ? "Select an image first"
                : !caption.trim()
                  ? "Add a caption first"
                  : undefined
          }
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-aubergine transition hover:bg-marigold/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <NavIcon name={mode === "now" ? "send" : "clock"} className="h-4 w-4" />
          {publishing
            ? "Working..."
            : mode === "now"
              ? "Publish Now"
              : "Schedule Post"}
        </button>

        {!instagramStatus?.connected && (
          <p className="mt-2 text-center text-[11px] text-aubergine/40">
            Connect your Instagram account above to enable publishing.
          </p>
        )}
      </div>
    </div>
  );
}
