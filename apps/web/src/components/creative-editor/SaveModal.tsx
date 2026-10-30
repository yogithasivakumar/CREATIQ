"use client";

import { useState } from "react";
import type { Project } from "@/components/library/types";

export function SaveModal({
  defaultName,
  projects,
  saving,
  error,
  onClose,
  onConfirm,
}: {
  defaultName: string;
  projects: Project[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (name: string, projectId: string | undefined) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [projectId, setProjectId] = useState("");

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-aubergine/40 px-4"
      onClick={onClose}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-aubergine">Save to My Library</h2>
        <p className="mt-1 text-xs text-aubergine/60">
          This saves a new asset — your original image is kept unchanged.
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-4">
          <label className="text-xs text-aubergine/60">Name / prompt</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-aubergine/15 px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-3">
          <label className="text-xs text-aubergine/60">Project (optional)</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-aubergine/15 px-3 py-2 text-sm text-aubergine"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-aubergine/70 hover:bg-aubergine/5">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(name, projectId || undefined)}
            disabled={saving}
            className="rounded-xl bg-marigold px-4 py-2 text-sm font-semibold text-aubergine hover:bg-marigold/90 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
