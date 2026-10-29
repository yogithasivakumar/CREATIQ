"use client";

import { NavIcon } from "@/components/dashboard/NavIcon";
import type { Asset } from "./types";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "Unknown size";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function AssetDetailModal({
  asset,
  projectName,
  onClose,
  onDelete,
  onAssign,
}: {
  asset: Asset;
  /** The current project's name, if the asset is assigned to one. */
  projectName?: string | null;
  onClose: () => void;
  onDelete: () => void;
  onAssign: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-aubergine/50 p-4"
      onClick={onClose}
    >
      <div
        className="grid max-h-[90vh] w-full max-w-3xl grid-rows-[1fr_auto] overflow-hidden rounded-2xl bg-white shadow-2xl md:grid-cols-[3fr_2fr] md:grid-rows-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center overflow-hidden bg-silver">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.url}
            alt={asset.prompt ?? "Generated asset"}
            className="max-h-[70vh] w-full object-contain"
          />
        </div>

        <div className="flex flex-col overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-bold text-aubergine">Asset details</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1 text-aubergine/50 hover:bg-aubergine/5 hover:text-aubergine"
            >
              <NavIcon name="close" className="h-5 w-5" />
            </button>
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-aubergine/50">Prompt</dt>
              <dd className="mt-1 text-aubergine">{asset.prompt ?? "No prompt recorded"}</dd>
            </div>
            <div>
              <dt className="font-medium text-aubergine/50">Project</dt>
              <dd className="mt-1 flex items-center justify-between gap-2">
                <span className="text-aubergine">{projectName ?? "No project"}</span>
                <button
                  onClick={onAssign}
                  className="shrink-0 text-xs font-semibold text-marigold hover:underline"
                >
                  Move
                </button>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-aubergine/50">Dimensions</dt>
              <dd className="mt-1 text-aubergine">
                {asset.width && asset.height ? `${asset.width} x ${asset.height}px` : "Unknown"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-aubergine/50">File size</dt>
              <dd className="mt-1 text-aubergine">{formatBytes(asset.fileSizeBytes)}</dd>
            </div>
            <div>
              <dt className="font-medium text-aubergine/50">Created</dt>
              <dd className="mt-1 text-aubergine">{formatDateTime(asset.createdAt)}</dd>
            </div>
          </dl>

          <div className="mt-auto flex gap-3 pt-6">
            <a
              href={asset.url}
              download
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-aubergine px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-aubergine/90"
            >
              <NavIcon name="download" className="h-4 w-4" />
              Download
            </a>
            <button
              onClick={onDelete}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <NavIcon name="trash" className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
