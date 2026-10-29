"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { NavIcon } from "@/components/dashboard/NavIcon";
import { AssetCard, AssetCardSkeleton } from "@/components/library/AssetCard";
import { AssetDetailModal } from "@/components/library/AssetDetailModal";
import { AssignProjectModal } from "@/components/library/AssignProjectModal";
import { ConfirmDialog } from "@/components/library/ConfirmDialog";
import { Pagination } from "@/components/library/Pagination";
import type { Asset, Project } from "@/components/library/types";

const PAGE_SIZE = 24;

type SortOrder = "newest" | "oldest";

export default function AssetLibraryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortOrder>("newest");
  const [projectFilter, setProjectFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetPendingDeletion, setAssetPendingDeletion] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [assetPendingAssignment, setAssetPendingAssignment] = useState<Asset | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      map.set(project.id, project.name);
    }
    return map;
  }, [projects]);

  useEffect(() => {
    apiFetch<{ projects: Project[] }>("/api/projects")
      .then((data) => setProjects(data.projects))
      .catch(() => {
        // Non-fatal: the filter dropdown just stays empty.
      });
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sort,
      });
      if (projectFilter) params.set("projectId", projectFilter);
      if (search) params.set("search", search);

      try {
        const data = await apiFetch<{ items: Asset[]; total: number }>(
          `/api/assets?${params.toString()}`
        );
        if (cancelled) return;
        setAssets(data.items);
        setTotal(data.total);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load your assets.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [page, sort, projectFilter, search]);

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

  async function handleAssign(asset: Asset, projectId: string | null) {
    setAssigning(true);
    setAssignError("");
    try {
      const data = await apiFetch<{ asset: Asset }>(`/api/assets/${asset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ projectId }),
      });

      if (projectFilter && data.asset.projectId !== projectFilter) {
        // The asset no longer matches the active project filter —
        // remove it from view instead of leaving a stale entry that
        // doesn't belong in this filtered list.
        setAssets((prev) => prev.filter((a) => a.id !== asset.id));
        setTotal((prev) => prev - 1);
      } else {
        setAssets((prev) => prev.map((a) => (a.id === asset.id ? data.asset : a)));
      }

      if (selectedAsset?.id === asset.id) {
        setSelectedAsset(data.asset);
      }

      setAssetPendingAssignment(null);
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : "Could not move this asset.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-aubergine">Asset Library</h1>
        <p className="mt-1 text-sm text-aubergine/70">
          Browse, search, and manage everything you&apos;ve generated.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <NavIcon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-aubergine/40"
          />
          <input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            placeholder="Search by prompt..."
            className="w-full rounded-xl border border-aubergine/15 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-marigold"
          />
        </div>

        <select
          value={projectFilter}
          onChange={(e) => {
            setProjectFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-aubergine/15 px-3 py-2.5 text-sm text-aubergine outline-none focus:border-marigold"
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as SortOrder);
            setPage(1);
          }}
          className="rounded-xl border border-aubergine/15 px-3 py-2.5 text-sm text-aubergine outline-none focus:border-marigold"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

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
          <h2 className="mt-5 text-xl font-bold text-aubergine">
            {search || projectFilter ? "No matching assets" : "Your library is empty"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-aubergine/70">
            {search || projectFilter
              ? "Try a different search term or filter."
              : "Generate an image and save it to your library to see it here."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                projectName={asset.projectId ? projectNameById.get(asset.projectId) : null}
                onOpen={() => setSelectedAsset(asset)}
                onDelete={() => setAssetPendingDeletion(asset)}
                onAssign={() => {
                  setAssignError("");
                  setAssetPendingAssignment(asset);
                }}
              />
            ))}
          </div>

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      )}

      {selectedAsset && (
        <AssetDetailModal
          asset={selectedAsset}
          projectName={
            selectedAsset.projectId ? projectNameById.get(selectedAsset.projectId) : null
          }
          onClose={() => setSelectedAsset(null)}
          onDelete={() => setAssetPendingDeletion(selectedAsset)}
          onAssign={() => {
            setAssignError("");
            setAssetPendingAssignment(selectedAsset);
          }}
        />
      )}

      {assetPendingAssignment && (
        <AssignProjectModal
          projects={projects}
          currentProjectId={assetPendingAssignment.projectId}
          pending={assigning}
          error={assignError}
          onAssign={(projectId) => handleAssign(assetPendingAssignment, projectId)}
          onClose={() => setAssetPendingAssignment(null)}
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
