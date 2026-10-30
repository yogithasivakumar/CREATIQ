"use client";

import { NavIcon } from "@/components/dashboard/NavIcon";

export function Toolbar({
  name,
  onNameChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
  zoom,
  onZoomChange,
  onFitToScreen,
  onExport,
  onSave,
  saving,
  onBack,
}: {
  name: string;
  onNameChange: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitToScreen: () => void;
  onExport: () => void;
  onSave: () => void;
  saving: boolean;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-aubergine/10 bg-white px-4 py-2.5">
      <button
        onClick={onBack}
        title="Back to Library"
        className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-aubergine/70 hover:bg-aubergine/5"
      >
        <NavIcon name="folder" className="h-4 w-4" />
        <span className="hidden sm:inline">Library</span>
      </button>

      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className="min-w-0 max-w-xs flex-1 rounded-lg border border-transparent px-2 py-1 text-sm font-semibold text-aubergine outline-none hover:border-aubergine/15 focus:border-marigold"
        aria-label="Document name"
        title={name}
      />

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="rounded-lg p-2 text-aubergine/70 hover:bg-aubergine/5 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <NavIcon name="undo" className="h-4 w-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="rounded-lg p-2 text-aubergine/70 hover:bg-aubergine/5 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <NavIcon name="refresh" className="h-4 w-4" />
        </button>
        <button
          onClick={onReset}
          title="Reset all edits"
          className="rounded-lg px-2 py-2 text-xs font-medium text-aubergine/70 hover:bg-aubergine/5"
        >
          Reset
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-lg bg-silver px-1.5 py-1">
        <button
          onClick={() => onZoomChange(zoom - 0.1)}
          title="Zoom out"
          className="rounded p-1 text-aubergine/70 hover:bg-white"
        >
          <NavIcon name="minus" className="h-3.5 w-3.5" />
        </button>
        <span className="w-10 text-center text-xs font-medium text-aubergine/70">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => onZoomChange(zoom + 0.1)}
          title="Zoom in"
          className="rounded p-1 text-aubergine/70 hover:bg-white"
        >
          <NavIcon name="plus" className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onFitToScreen}
          title="Fit to Screen"
          className="ml-0.5 rounded px-1.5 py-1 text-[10px] font-semibold text-aubergine/70 hover:bg-white"
        >
          Fit
        </button>
      </div>

      <button
        onClick={onExport}
        title="Export / Download"
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-aubergine/15 px-3 py-1.5 text-sm font-medium text-aubergine hover:bg-aubergine/5"
      >
        <NavIcon name="download" className="h-4 w-4" />
        <span className="hidden sm:inline">Export</span>
      </button>

      <button
        onClick={onSave}
        disabled={saving}
        title="Save to My Library (Ctrl+S)"
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-marigold px-3 py-1.5 text-sm font-semibold text-aubergine hover:bg-marigold/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <NavIcon name="save" className="h-4 w-4" />
        <span className="hidden sm:inline">{saving ? "Saving..." : "Save"}</span>
      </button>
    </div>
  );
}
