"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { NavIcon } from "@/components/dashboard/NavIcon";
import { AssetCard, AssetCardSkeleton } from "@/components/library/AssetCard";
import { AssetDetailModal } from "@/components/library/AssetDetailModal";
import { ConfirmDialog } from "@/components/library/ConfirmDialog";
import { Pagination } from "@/components/library/Pagination";
import type { Asset, Project } from "@/components/library/types";

const PAGE_SIZE = 24;

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetPendingDeletion, setAssetPendingDeletion] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiFetch<{ projects: Project[] }>("/api/projects")
      .then((data) => {
        const found = data.projects.find((p) => p.id === projectId);
        setProject(found ?? null);
        if (!found) setError("This project could not be found.");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load the project."));
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sort: "newest",
        projectId,
      });

      try {
        const data = await apiFetch<{ items: Asset[]; total: number }>(
          `/api/assets?${params.toString()}`
        );
        if (cancelled) return;
        setAssets(data.items);
        setTotal(data.total);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load assets.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [projectId, page]);

  async function handleDelete(asset: Asset) {
    setDeleting(true);
    try {
      await apiFetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      setTotal((prev) => prev - 1);
      setAssetPendingDeletion(null);
      setSelectedAsset(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the asset.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/dashboard/projects"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-aubergine/60 hover:text-aubergine"
      >
        ← Back to projects
      </Link>

      <header className="mb-8">
        <h1 className="text-2xl font-bold text-aubergine">
          {project?.name ?? "Project"}
        </h1>
        {project?.description && (
          <p className="mt-1 text-sm text-aubergine/70">{project.description}</p>
        )}
      </header>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <AssetCardSkeleton key={i} />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-aubergine/20 bg-white px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-aubergine/5 text-aubergine">
            <NavIcon name="folder" className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-xl font-bold text-aubergine">No assets in this project yet</h2>
          <p className="mt-2 max-w-md text-sm text-aubergine/70">
            Save a generated image to this project to see it here.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onOpen={() => setSelectedAsset(asset)}
                onDelete={() => setAssetPendingDeletion(asset)}
              />
            ))}
          </div>

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      )}

      {selectedAsset && (
        <AssetDetailModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onDelete={() => setAssetPendingDeletion(selectedAsset)}
        />
      )}

      <ConfirmDialog
        open={assetPendingDeletion !== null}
        title="Delete this asset?"
        description="This permanently removes the image from your library. This cannot be undone."
        confirmLabel="Delete"
        danger
        pending={deleting}
        onConfirm={() => assetPendingDeletion && handleDelete(assetPendingDeletion)}
        onCancel={() => setAssetPendingDeletion(null)}
      />
    </div>
  );
}
