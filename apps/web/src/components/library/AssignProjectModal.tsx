"use client";

import { useMemo, useState } from "react";
import { NavIcon } from "@/components/dashboard/NavIcon";
import type { Project } from "./types";

export function AssignProjectModal({
  projects,
  currentProjectId,
  pending,
  error,
  onAssign,
  onClose,
}: {
  projects: Project[];
  currentProjectId: string | null;
  pending: boolean;
  error: string;
  onAssign: (projectId: string | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(term));
  }, [projects, search]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-project-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-aubergine/50 p-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 id="assign-project-title" className="text-lg font-bold text-aubergine">
            Move to project
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-aubergine/50 hover:bg-aubergine/5 hover:text-aubergine"
          >
            <NavIcon name="close" className="h-5 w-5" />
          </button>
        </div>

        {projects.length > 5 && (
          <div className="relative mt-4">
            <NavIcon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-aubergine/40"
            />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              aria-label="Search projects"
              className="w-full rounded-xl border border-aubergine/15 py-2 pl-9 pr-3 text-sm outline-none focus:border-marigold"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto" role="listbox">
          <ProjectOption
            label="No project"
            icon="folder"
            selected={currentProjectId === null}
            disabled={pending}
            onSelect={() => onAssign(null)}
          />

          {filteredProjects.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-aubergine/50">
              {projects.length === 0
                ? "You don't have any projects yet."
                : "No projects match your search."}
            </li>
          ) : (
            filteredProjects.map((project) => (
              <ProjectOption
                key={project.id}
                label={project.name}
                icon="grid"
                selected={currentProjectId === project.id}
                disabled={pending}
                onSelect={() => onAssign(project.id)}
              />
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function ProjectOption({
  label,
  icon,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  icon: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <li role="option" aria-selected={selected}>
      <button
        onClick={onSelect}
        disabled={disabled || selected}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed ${
          selected
            ? "bg-aubergine/10 font-semibold text-aubergine"
            : "text-aubergine/80 hover:bg-aubergine/5"
        }`}
      >
        <NavIcon name={icon} className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{label}</span>
        {selected && <NavIcon name="check" className="h-4 w-4 shrink-0 text-marigold" />}
      </button>
    </li>
  );
}
