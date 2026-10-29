"use client";

import { NavIcon } from "@/components/dashboard/NavIcon";
import type { Asset } from "./types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AssetCard({
  asset,
  projectName,
  onOpen,
  onDelete,
  onAssign,
}: {
  asset: Asset;
  /** The current project's name, if the asset is assigned to one. */
  projectName?: string | null;
  onOpen: () => void;
  onDelete: () => void;
  onAssign: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-aubergine/10 bg-white">
      <button
        onClick={onOpen}
        className="block aspect-square w-full overflow-hidden bg-silver"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt={asset.prompt ?? "Generated asset"}
          className="h-full w-full object-cover transition group-hover:scale-105"
          loading="lazy"
        />
      </button>

      <div className="absolute right-2 top-2 flex gap-2 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={onAssign}
          aria-label="Move to project"
          title="Move to project"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-aubergine shadow hover:bg-marigold/15 hover:text-aubergine"
        >
          <NavIcon name="grid" className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete asset"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-aubergine shadow hover:bg-red-50 hover:text-red-600"
        >
          <NavIcon name="trash" className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3">
        <p className="line-clamp-2 text-xs text-aubergine/70">
          {asset.prompt ?? "No prompt recorded"}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-[11px] text-aubergine/40">{formatDate(asset.createdAt)}</p>
          {projectName && (
            <span className="truncate rounded-full bg-marigold/15 px-2 py-0.5 text-[10px] font-semibold text-aubergine/70">
              {projectName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function AssetCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-aubergine/10 bg-white">
      <div className="aspect-square w-full animate-pulse bg-aubergine/5" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-full animate-pulse rounded bg-aubergine/5" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-aubergine/5" />
      </div>
    </div>
  );
}
