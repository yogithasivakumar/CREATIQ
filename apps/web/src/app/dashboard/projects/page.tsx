"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { NavIcon } from "@/components/dashboard/NavIcon";
import { ConfirmDialog } from "@/components/library/ConfirmDialog";
import type { Project } from "@/components/library/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [projectPendingDeletion, setProjectPendingDeletion] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadProjects() {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ projects: Project[] }>("/api/projects");
      setProjects(data.projects);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function run() {
      await loadProjects();
    }

    run();
  }, []);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    setError("");
    try {
      const data = await apiFetch<{ project: Project }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setProjects((prev) => [data.project, ...prev]);
      setNewName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the project.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(project: Project) {
    const name = renameValue.trim();
    if (!name || name === project.name) {
      setRenamingId(null);
      return;
    }

    try {
      const data = await apiFetch<{ project: Project }>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setProjects((prev) => prev.map((p) => (p.id === project.id ? data.project : p)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rename the project.");
    } finally {
      setRenamingId(null);
    }
  }

  async function handleDelete(project: Project) {
    setDeleting(true);
    try {
      await apiFetch(`/api/projects/${project.id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      setProjectPendingDeletion(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the project.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-aubergine">Projects</h1>
        <p className="mt-1 text-sm text-aubergine/70">
          Group your generated assets into projects.
        </p>
      </header>

      <div className="mb-6 flex gap-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="New project name..."
          maxLength={200}
          className="flex-1 rounded-xl border border-aubergine/15 px-4 py-2.5 text-sm outline-none focus:border-marigold"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
          className="flex items-center gap-2 rounded-xl bg-aubergine px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-aubergine/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <NavIcon name="plus" className="h-4 w-4" />
          Create
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-aubergine/5" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-aubergine/20 bg-white px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-aubergine/5 text-aubergine">
            <NavIcon name="grid" className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-xl font-bold text-aubergine">No projects yet</h2>
          <p className="mt-2 max-w-md text-sm text-aubergine/70">
            Create a project above to start organizing your generated assets.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex items-center gap-3 rounded-2xl border border-aubergine/10 bg-white p-4"
            >
              {renamingId === project.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRename(project)}
                  onBlur={() => handleRename(project)}
                  className="flex-1 rounded-lg border border-marigold px-3 py-1.5 text-sm outline-none"
                />
              ) : (
                <Link href={`/dashboard/projects/${project.id}`} className="flex-1">
                  <p className="font-semibold text-aubergine hover:underline">{project.name}</p>
                  <p className="text-xs text-aubergine/50">
                    Updated {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </Link>
              )}

              <button
                onClick={() => {
                  setRenamingId(project.id);
                  setRenameValue(project.name);
                }}
                aria-label="Rename project"
                className="rounded-lg p-2 text-aubergine/50 transition hover:bg-aubergine/5 hover:text-aubergine"
              >
                <NavIcon name="edit" className="h-4 w-4" />
              </button>
              <button
                onClick={() => setProjectPendingDeletion(project)}
                aria-label="Delete project"
                className="rounded-lg p-2 text-aubergine/50 transition hover:bg-red-50 hover:text-red-600"
              >
                <NavIcon name="trash" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={projectPendingDeletion !== null}
        title="Delete this project?"
        description="Assets in this project will not be deleted, but they'll no longer be grouped under it."
        confirmLabel="Delete"
        danger
        pending={deleting}
        onConfirm={() => projectPendingDeletion && handleDelete(projectPendingDeletion)}
        onCancel={() => setProjectPendingDeletion(null)}
      />
    </div>
  );
}
