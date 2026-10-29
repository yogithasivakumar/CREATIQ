"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { NavIcon } from "@/components/dashboard/NavIcon";
import type { Asset } from "@/components/library/types";
import {
  CAPTION_LENGTHS,
  CAPTION_STYLES,
  CAPTION_TONES,
  type CaptionLength,
  type CaptionStyle,
  type CaptionTone,
} from "./types";

type Mode = "ai" | "custom";

export function GenerateCaptionPanel({
  selectedAsset,
  caption,
  hashtags,
  onCaptionChange,
  onHashtagsChange,
}: {
  selectedAsset: Asset | null;
  caption: string;
  hashtags: string[];
  onCaptionChange: (caption: string) => void;
  onHashtagsChange: (hashtags: string[]) => void;
}) {
  const [mode, setMode] = useState<Mode>("ai");
  const [style, setStyle] = useState<CaptionStyle>("product_highlight");
  const [tone, setTone] = useState<CaptionTone>("engaging_friendly");
  const [length, setLength] = useState<CaptionLength>("medium");
  const [instructions, setInstructions] = useState("");
  const [variant, setVariant] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleGenerate(nextVariant: number) {
    if (!selectedAsset) {
      setError("Select an image first.");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const data = await apiFetch<{ caption: string; hashtags: string[] }>(
        "/api/captions/generate",
        {
          method: "POST",
          body: JSON.stringify({
            assetId: selectedAsset.id,
            style,
            tone,
            length,
            instructions: instructions.trim() || undefined,
            hashtagCount: 5,
            variant: nextVariant,
          }),
        }
      );

      onCaptionChange(data.caption);
      onHashtagsChange(data.hashtags);
      setVariant(nextVariant);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate a caption.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    const fullText = `${caption}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-aubergine/10 bg-white p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-aubergine/60">
        2. Generate Caption
      </h2>
      <p className="mt-1 text-xs text-aubergine/50">Create an engaging Instagram caption.</p>

      <div className="mt-4 flex gap-1 rounded-xl bg-silver p-1">
        <button
          onClick={() => setMode("ai")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
            mode === "ai" ? "bg-white text-aubergine shadow-sm" : "text-aubergine/60"
          }`}
        >
          <NavIcon name="sparkles" className="h-3.5 w-3.5" />
          AI Generate
        </button>
        <button
          onClick={() => setMode("custom")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
            mode === "custom" ? "bg-white text-aubergine shadow-sm" : "text-aubergine/60"
          }`}
        >
          <NavIcon name="edit" className="h-3.5 w-3.5" />
          Custom
        </button>
      </div>

      {mode === "ai" ? (
        <div className="mt-4 flex-1 overflow-y-auto">
          <p className="mb-2 text-xs font-semibold text-aubergine/70">Caption Style</p>
          <div className="grid grid-cols-2 gap-2">
            {CAPTION_STYLES.map((option) => (
              <button
                key={option.value}
                onClick={() => setStyle(option.value)}
                className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${
                  style === option.value
                    ? "border-marigold bg-marigold/10 text-aubergine"
                    : "border-aubergine/15 text-aubergine/70 hover:border-aubergine/30"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-aubergine/70">Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as CaptionTone)}
                className="w-full rounded-lg border border-aubergine/15 px-2 py-1.5 text-xs text-aubergine outline-none focus:border-marigold"
              >
                {CAPTION_TONES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-aubergine/70">Length</label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as CaptionLength)}
                className="w-full rounded-lg border border-aubergine/15 px-2 py-1.5 text-xs text-aubergine outline-none focus:border-marigold"
              >
                {CAPTION_LENGTHS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="mb-1 mt-4 block text-xs font-semibold text-aubergine/70">
            Additional Instructions (Optional)
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value.slice(0, 300))}
            placeholder="e.g. Highlight the fragrance notes, use a warm and luxurious tone..."
            rows={2}
            className="w-full resize-none rounded-lg border border-aubergine/15 p-2 text-xs outline-none focus:border-marigold"
          />
          <p className="mt-1 text-right text-[10px] text-aubergine/40">
            {instructions.length}/300
          </p>

          <button
            onClick={() => handleGenerate(0)}
            disabled={generating || !selectedAsset}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aubergine to-aubergine/80 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <NavIcon name="sparkles" className="h-4 w-4 text-marigold" />
            {generating ? "Generating..." : "Generate Caption"}
          </button>

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

          {caption && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-aubergine/70">Generated Caption</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleGenerate(variant + 1)}
                    disabled={generating}
                    className="flex items-center gap-1 text-xs font-medium text-aubergine/60 hover:text-aubergine disabled:opacity-50"
                  >
                    <NavIcon name="refresh" className="h-3.5 w-3.5" />
                    Regenerate
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs font-medium text-aubergine/60 hover:text-aubergine"
                  >
                    <NavIcon name="copy" className="h-3.5 w-3.5" />
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <textarea
                value={caption}
                onChange={(e) => onCaptionChange(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-lg border border-aubergine/15 p-2.5 text-xs outline-none focus:border-marigold"
              />
              {hashtags.length > 0 && (
                <p className="mt-2 text-xs text-marigold">
                  {hashtags.map((h) => `#${h}`).join(" ")}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 flex-1">
          <label className="mb-1 block text-xs font-semibold text-aubergine/70">
            Write your own caption
          </label>
          <textarea
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            placeholder="Write your caption here..."
            rows={6}
            maxLength={2200}
            className="w-full resize-none rounded-lg border border-aubergine/15 p-2.5 text-xs outline-none focus:border-marigold"
          />
          <p className="mt-1 text-right text-[10px] text-aubergine/40">{caption.length}/2200</p>

          <label className="mb-1 mt-3 block text-xs font-semibold text-aubergine/70">
            Hashtags (space-separated, without #)
          </label>
          <input
            value={hashtags.join(" ")}
            onChange={(e) =>
              onHashtagsChange(
                e.target.value
                  .split(/\s+/)
                  .map((h) => h.replace(/^#/, ""))
                  .filter(Boolean)
              )
            }
            placeholder="CREATIQ LuxuryLiving"
            className="w-full rounded-lg border border-aubergine/15 p-2 text-xs outline-none focus:border-marigold"
          />
        </div>
      )}
    </div>
  );
}
