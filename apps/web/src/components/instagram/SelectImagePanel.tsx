"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { NavIcon } from "@/components/dashboard/NavIcon";
import type { Asset, Project } from "@/components/library/types";

type Tab = "library" | "projects";

export function SelectImagePanel({
  selectedAsset,
  onSelect,
}: {
  selectedAsset: Asset | null;
  onSelect: (asset: Asset) => void;
}) {
  const [tab, setTab] = useState<Tab>("library");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ projects: Project[] }>("/api/projects")
      .then((data) => {
        setProjects(data.projects);
        if (data.projects.length > 0) setActiveProjectId(data.projects[0].id);
      })
      .catch(() => {
        // Non-fatal: the Projects tab just stays empty.
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({ page: "1", pageSize: "60", sort: "newest" });
      if (tab === "projects" && activeProjectId) {
        params.set("projectId", activeProjectId);
      }

      try {
        const data = await apiFetch<{ items: Asset[] }>(`/api/assets?${params.toString()}`);
        if (!cancelled) setAssets(data.items);
      } catch {
        if (!cancelled) setError("Could not load your images.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    function run() {
      if (tab === "library" || (tab === "projects" && activeProjectId)) {
        load();
      } else {
        setAssets([]);
        setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [tab, activeProjectId]);

  const filteredAssets = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return assets;
    return assets.filter((asset) => (asset.prompt ?? "").toLowerCase().includes(term));
  }, [assets, search]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-aubergine/10 bg-white p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-aubergine/60">
        1. Select Image
      </h2>
      <p className="mt-1 text-xs text-aubergine/50">Choose an image from your library or project.</p>

      <div className="relative mt-4">
        <NavIcon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-aubergine/40"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search images..."
          className="w-full rounded-xl border border-aubergine/15 py-2 pl-9 pr-3 text-sm outline-none focus:border-marigold"
        />
      </div>

      <div className="mt-4 flex gap-1 rounded-xl bg-silver p-1">
        <button
          onClick={() => setTab("library")}
          className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
            tab === "library" ? "bg-white text-aubergine shadow-sm" : "text-aubergine/60"
          }`}
        >
          My Library
        </button>
        <button
          onClick={() => setTab("projects")}
          className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
            tab === "projects" ? "bg-white text-aubergine shadow-sm" : "text-aubergine/60"
          }`}
        >
          Projects
        </button>
      </div>

      {tab === "projects" && (
        <select
          value={activeProjectId}
          onChange={(e) => setActiveProjectId(e.target.value)}
          className="mt-3 rounded-xl border border-aubergine/15 px-3 py-2 text-xs text-aubergine outline-none focus:border-marigold"
        >
          {projects.length === 0 && <option value="">No projects yet</option>}
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      )}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      <div className="mt-4 flex-1 overflow-y-auto">
        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-aubergine/5" />
            ))}
          </div>
        ) : filteredAssets.length === 0 ? (
          <p className="py-10 text-center text-xs text-aubergine/50">
            {tab === "projects" && projects.length === 0
              ? "Create a project to see it here."
              : "No images found."}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filteredAssets.map((asset) => {
              const isSelected = selectedAsset?.id === asset.id;
              return (
                <button
                  key={asset.id}
                  onClick={() => onSelect(asset)}
                  aria-pressed={isSelected}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                    isSelected ? "border-marigold" : "border-transparent hover:border-aubergine/20"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt={asset.prompt ?? "Asset"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {isSelected && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-marigold text-white">
                      <NavIcon name="check" className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
