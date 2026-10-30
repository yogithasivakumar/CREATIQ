"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { NavIcon } from "@/components/dashboard/NavIcon";
import type { Asset, Project } from "@/components/library/types";

export function ImageSelector({ onSelect }: { onSelect: (asset: Asset) => void }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ projects: Project[] }>("/api/projects")
      .then((data) => setProjects(data.projects))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({ page: "1", pageSize: "60", sort: "newest" });
      if (projectFilter) params.set("projectId", projectFilter);
      if (search) params.set("search", search);

      try {
        const data = await apiFetch<{ items: Asset[] }>(`/api/assets?${params.toString()}`);
        if (!cancelled) setAssets(data.items);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load images.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timeout = setTimeout(load, search ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [projectFilter, search]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-aubergine">Creative Editor</h1>
        <p className="mt-1 text-sm text-aubergine/70">Select an image to start editing.</p>
      </header>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <NavIcon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-aubergine/40"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search images..."
            className="w-full rounded-xl border border-aubergine/15 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-marigold"
          />
        </div>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-xl border border-aubergine/15 px-3 py-2.5 text-sm text-aubergine outline-none focus:border-marigold"
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-aubergine/5" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-aubergine/20 bg-white px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-aubergine/5 text-aubergine">
            <NavIcon name="folder" className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-xl font-bold text-aubergine">No images found</h2>
          <p className="mt-2 max-w-md text-sm text-aubergine/70">
            Generate an image and save it to your library first.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {assets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => onSelect(asset)}
              className="group aspect-square overflow-hidden rounded-2xl border border-aubergine/10 bg-silver transition hover:border-marigold"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.url}
                alt={asset.prompt ?? "Asset"}
                className="h-full w-full object-cover transition group-hover:scale-105"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
