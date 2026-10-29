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
  onOpen,
  onDelete,
}: {
  asset: Asset;
  onOpen: () => void;
  onDelete: () => void;
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

      <button
        onClick={onDelete}
        aria-label="Delete asset"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-aubergine opacity-0 shadow transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
      >
        <NavIcon name="trash" className="h-4 w-4" />
      </button>

      <div className="p-3">
        <p className="line-clamp-2 text-xs text-aubergine/70">
          {asset.prompt ?? "No prompt recorded"}
        </p>
        <p className="mt-1 text-[11px] text-aubergine/40">{formatDate(asset.createdAt)}</p>
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
