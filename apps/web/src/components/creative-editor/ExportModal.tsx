"use client";

import { useState } from "react";

export function ExportModal({
  onClose,
  onExport,
}: {
  onClose: () => void;
  onExport: (format: "jpeg" | "png", quality: number) => void;
}) {
  const [format, setFormat] = useState<"jpeg" | "png">("jpeg");
  const [quality, setQuality] = useState(0.92);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-aubergine/40 px-4"
      onClick={onClose}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-aubergine">Export image</h2>

        <div className="mt-4">
          <label className="text-xs text-aubergine/60">Format</label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(["jpeg", "png"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium uppercase ${
                  format === f
                    ? "border-marigold bg-marigold/15 text-aubergine"
                    : "border-aubergine/15 text-aubergine/70"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {format === "jpeg" && (
          <div className="mt-4">
            <label className="text-xs text-aubergine/60">Quality ({Math.round(quality * 100)}%)</label>
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.01}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-aubergine/70 hover:bg-aubergine/5">
            Cancel
          </button>
          <button
            onClick={() => onExport(format, quality)}
            className="rounded-xl bg-marigold px-4 py-2 text-sm font-semibold text-aubergine hover:bg-marigold/90"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
