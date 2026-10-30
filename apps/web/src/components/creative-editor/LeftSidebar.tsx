"use client";

import { useState } from "react";
import { NavIcon } from "@/components/dashboard/NavIcon";
import { FILTER_PRESETS, type AdjustmentValues, type FilterPreset, type Tool } from "./types";

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: "basic", label: "Basic", icon: "crop" },
  { id: "adjust", label: "Adjust", icon: "sparkles" },
  { id: "filters", label: "Filters", icon: "layers" },
  { id: "text", label: "Text", icon: "type" },
  { id: "shapes", label: "Shapes", icon: "shapes" },
];

function AdjustSlider({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onCommit: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-aubergine/60">
        <span>{label}</span>
        <span>{Math.round(value * 100)}</span>
      </div>
      <input
        type="range"
        min={-1}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        className="mt-1 w-full"
      />
    </div>
  );
}

export function LeftSidebar({
  activeTool,
  onToolChange,
  onCrop,
  cropping,
  onApplyCrop,
  onCancelCrop,
  onRotate,
  onFlip,
  onResize,
  dimensions,
  adjustments,
  onAdjust,
  onCommitAdjustments,
  filterPreset,
  onFilterPreset,
  onAddText,
  onAddShape,
}: {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onCrop: () => void;
  cropping: boolean;
  onApplyCrop: () => void;
  onCancelCrop: () => void;
  onRotate: (deg: 90 | -90) => void;
  onFlip: (axis: "horizontal" | "vertical") => void;
  onResize: (w: number, h: number) => void;
  dimensions: { width: number; height: number };
  adjustments: AdjustmentValues;
  onAdjust: (key: keyof AdjustmentValues, value: number) => void;
  onCommitAdjustments: () => void;
  filterPreset: FilterPreset;
  onFilterPreset: (preset: FilterPreset) => void;
  onAddText: () => void;
  onAddShape: (shape: "rect" | "circle" | "triangle") => void;
}) {
  const [resizeW, setResizeW] = useState(dimensions.width);
  const [resizeH, setResizeH] = useState(dimensions.height);
  const [lockAspect, setLockAspect] = useState(true);
  const aspect = dimensions.width / (dimensions.height || 1);

  return (
    <div className="flex h-full w-48 shrink-0 flex-col border-r border-aubergine/10 bg-white sm:w-56 lg:w-64">
      <div className="flex border-b border-aubergine/10">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            title={tool.label}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${
              activeTool === tool.id ? "bg-marigold/15 text-aubergine" : "text-aubergine/50 hover:bg-aubergine/5"
            }`}
          >
            <NavIcon name={tool.icon} className="h-4 w-4" />
            {tool.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTool === "basic" && (
          <div className="space-y-5">
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-aubergine/50">Crop</h3>
              {cropping ? (
                <div className="flex gap-2">
                  <button
                    onClick={onApplyCrop}
                    className="flex-1 rounded-lg bg-marigold px-3 py-2 text-xs font-semibold text-aubergine"
                  >
                    Apply Crop
                  </button>
                  <button
                    onClick={onCancelCrop}
                    className="flex-1 rounded-lg border border-aubergine/15 px-3 py-2 text-xs font-medium text-aubergine/70"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={onCrop}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-aubergine/15 px-3 py-2 text-sm text-aubergine hover:bg-aubergine/5"
                >
                  <NavIcon name="crop" className="h-4 w-4" />
                  Start Crop
                </button>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-aubergine/50">Rotate &amp; Flip</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onRotate(-90)}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-aubergine/15 px-2 py-2 text-xs text-aubergine hover:bg-aubergine/5"
                >
                  <NavIcon name="rotateLeft" className="h-4 w-4" /> Left
                </button>
                <button
                  onClick={() => onRotate(90)}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-aubergine/15 px-2 py-2 text-xs text-aubergine hover:bg-aubergine/5"
                >
                  <NavIcon name="rotateRight" className="h-4 w-4" /> Right
                </button>
                <button
                  onClick={() => onFlip("horizontal")}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-aubergine/15 px-2 py-2 text-xs text-aubergine hover:bg-aubergine/5"
                >
                  <NavIcon name="flipHorizontal" className="h-4 w-4" /> Flip H
                </button>
                <button
                  onClick={() => onFlip("vertical")}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-aubergine/15 px-2 py-2 text-xs text-aubergine hover:bg-aubergine/5"
                >
                  <NavIcon name="flipVertical" className="h-4 w-4" /> Flip V
                </button>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-aubergine/50">Resize</h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={Math.round(resizeW)}
                  onChange={(e) => {
                    const w = Number(e.target.value) || 1;
                    setResizeW(w);
                    if (lockAspect) setResizeH(Math.round(w / aspect));
                  }}
                  className="w-full rounded-lg border border-aubergine/15 px-2 py-1.5 text-xs"
                  aria-label="Width"
                />
                <span className="text-xs text-aubergine/40">×</span>
                <input
                  type="number"
                  value={Math.round(resizeH)}
                  onChange={(e) => {
                    const h = Number(e.target.value) || 1;
                    setResizeH(h);
                    if (lockAspect) setResizeW(Math.round(h * aspect));
                  }}
                  className="w-full rounded-lg border border-aubergine/15 px-2 py-1.5 text-xs"
                  aria-label="Height"
                />
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-aubergine/60">
                <input
                  type="checkbox"
                  checked={lockAspect}
                  onChange={(e) => setLockAspect(e.target.checked)}
                />
                Lock aspect ratio
              </label>
              <button
                onClick={() => onResize(resizeW, resizeH)}
                className="mt-2 w-full rounded-lg bg-aubergine px-3 py-2 text-xs font-semibold text-white hover:bg-aubergine/90"
              >
                Apply Resize
              </button>
            </div>
          </div>
        )}

        {activeTool === "adjust" && (
          <div className="space-y-4">
            <AdjustSlider
              label="Brightness"
              value={adjustments.brightness}
              onChange={(v) => onAdjust("brightness", v)}
              onCommit={onCommitAdjustments}
            />
            <AdjustSlider
              label="Contrast"
              value={adjustments.contrast}
              onChange={(v) => onAdjust("contrast", v)}
              onCommit={onCommitAdjustments}
            />
            <AdjustSlider
              label="Saturation"
              value={adjustments.saturation}
              onChange={(v) => onAdjust("saturation", v)}
              onCommit={onCommitAdjustments}
            />
            <AdjustSlider
              label="Temperature"
              value={adjustments.temperature}
              onChange={(v) => onAdjust("temperature", v)}
              onCommit={onCommitAdjustments}
            />
          </div>
        )}

        {activeTool === "filters" && (
          <div className="grid grid-cols-2 gap-2">
            {FILTER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onFilterPreset(preset.id)}
                className={`rounded-lg border px-2 py-2.5 text-xs font-medium ${
                  filterPreset === preset.id
                    ? "border-marigold bg-marigold/15 text-aubergine"
                    : "border-aubergine/15 text-aubergine/70 hover:bg-aubergine/5"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}

        {activeTool === "text" && (
          <div className="space-y-3">
            <button
              onClick={onAddText}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-aubergine px-3 py-2.5 text-sm font-semibold text-white hover:bg-aubergine/90"
            >
              <NavIcon name="type" className="h-4 w-4" />
              Add Text
            </button>
            <p className="text-xs text-aubergine/50">
              Select a text element and use the Properties panel on the right to edit font, size,
              color, style, alignment, and background.
            </p>
          </div>
        )}

        {activeTool === "shapes" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onAddShape("rect")}
                title="Rectangle"
                className="flex items-center justify-center rounded-lg border border-aubergine/15 py-3 hover:bg-aubergine/5"
              >
                <span className="h-5 w-6 rounded-sm bg-aubergine/70" />
              </button>
              <button
                onClick={() => onAddShape("circle")}
                title="Circle"
                className="flex items-center justify-center rounded-lg border border-aubergine/15 py-3 hover:bg-aubergine/5"
              >
                <span className="h-5 w-5 rounded-full bg-aubergine/70" />
              </button>
              <button
                onClick={() => onAddShape("triangle")}
                title="Triangle"
                className="flex items-center justify-center rounded-lg border border-aubergine/15 py-3 hover:bg-aubergine/5"
              >
                <NavIcon name="shapes" className="h-5 w-5 text-aubergine/70" />
              </button>
            </div>
            <p className="text-xs text-aubergine/50">
              Select a shape and use the Properties panel on the right to change its color, size,
              and position.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
