"use client";

import * as fabric from "fabric";
import { NavIcon } from "@/components/dashboard/NavIcon";

const FONTS = ["Arial", "Georgia", "Times New Roman", "Courier New", "Verdana"];

export function RightSidebar({
  activeObject,
  dimensions,
  onUpdate,
  onCommit,
  onDelete,
}: {
  activeObject: fabric.FabricObject | null;
  dimensions: { width: number; height: number };
  onUpdate: (props: Record<string, unknown>) => void;
  onCommit: () => void;
  onDelete: () => void;
}) {
  const isText = activeObject instanceof fabric.Textbox || activeObject instanceof fabric.IText;
  const isShape =
    activeObject instanceof fabric.Rect ||
    activeObject instanceof fabric.Circle ||
    activeObject instanceof fabric.Triangle;

  return (
    <div className="flex h-full w-48 shrink-0 flex-col overflow-y-auto border-l border-aubergine/10 bg-white p-4 sm:w-56 lg:w-64">
      <h3 className="text-xs font-bold uppercase tracking-wide text-aubergine/50">Properties</h3>

      {!activeObject && (
        <div className="mt-4 space-y-2 text-sm">
          <p className="text-aubergine/50">No element selected.</p>
          <div className="rounded-lg bg-silver p-3">
            <p className="text-xs text-aubergine/50">Image dimensions</p>
            <p className="font-semibold text-aubergine">
              {dimensions.width} × {dimensions.height}px
            </p>
          </div>
        </div>
      )}

      {isText && activeObject && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs text-aubergine/60">Font</label>
            <select
              value={(activeObject as fabric.Textbox).fontFamily}
              onChange={(e) => {
                onUpdate({ fontFamily: e.target.value });
                onCommit();
              }}
              className="mt-1 w-full rounded-lg border border-aubergine/15 px-2 py-1.5 text-sm"
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-aubergine/60">Size</label>
            <input
              type="number"
              value={(activeObject as fabric.Textbox).fontSize}
              onChange={(e) => onUpdate({ fontSize: Number(e.target.value) || 1 })}
              onBlur={onCommit}
              className="mt-1 w-full rounded-lg border border-aubergine/15 px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-aubergine/60">Text color</label>
            <input
              type="color"
              value={String((activeObject as fabric.Textbox).fill ?? "#000000")}
              onChange={(e) => {
                onUpdate({ fill: e.target.value });
                onCommit();
              }}
              className="mt-1 h-9 w-full rounded-lg border border-aubergine/15"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                const current = (activeObject as fabric.Textbox).fontWeight;
                onUpdate({ fontWeight: current === "bold" ? "normal" : "bold" });
                onCommit();
              }}
              className="flex-1 rounded-lg border border-aubergine/15 py-1.5 text-sm font-bold text-aubergine hover:bg-aubergine/5"
            >
              B
            </button>
            <button
              onClick={() => {
                const current = (activeObject as fabric.Textbox).fontStyle;
                onUpdate({ fontStyle: current === "italic" ? "normal" : "italic" });
                onCommit();
              }}
              className="flex-1 rounded-lg border border-aubergine/15 py-1.5 text-sm italic text-aubergine hover:bg-aubergine/5"
            >
              I
            </button>
          </div>

          <div>
            <label className="text-xs text-aubergine/60">Alignment</label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  key={align}
                  onClick={() => {
                    onUpdate({ textAlign: align });
                    onCommit();
                  }}
                  className={`rounded-lg border px-2 py-1.5 text-xs capitalize ${
                    (activeObject as fabric.Textbox).textAlign === align
                      ? "border-marigold bg-marigold/15 text-aubergine"
                      : "border-aubergine/15 text-aubergine/70"
                  }`}
                >
                  {align}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-aubergine/60">Background</label>
            <input
              type="color"
              value={String((activeObject as fabric.Textbox).backgroundColor || "#ffffff")}
              onChange={(e) => {
                onUpdate({ backgroundColor: e.target.value });
                onCommit();
              }}
              className="mt-1 h-9 w-full rounded-lg border border-aubergine/15"
            />
            <button
              onClick={() => {
                onUpdate({ backgroundColor: "" });
                onCommit();
              }}
              className="mt-1 text-[11px] text-aubergine/50 hover:underline"
            >
              Clear background
            </button>
          </div>

          <div>
            <label className="text-xs text-aubergine/60">
              Opacity ({Math.round((activeObject.opacity ?? 1) * 100)})
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={activeObject.opacity ?? 1}
              onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
              onMouseUp={onCommit}
              className="mt-1 w-full"
            />
          </div>
        </div>
      )}

      {isShape && activeObject && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs text-aubergine/60">Fill color</label>
            <input
              type="color"
              value={String(activeObject.fill ?? "#EAAA00")}
              onChange={(e) => {
                onUpdate({ fill: e.target.value });
                onCommit();
              }}
              className="mt-1 h-9 w-full rounded-lg border border-aubergine/15"
            />
          </div>
          <div>
            <label className="text-xs text-aubergine/60">
              Opacity ({Math.round((activeObject.opacity ?? 1) * 100)})
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={activeObject.opacity ?? 1}
              onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
              onMouseUp={onCommit}
              className="mt-1 w-full"
            />
          </div>
        </div>
      )}

      {(isText || isShape) && (
        <button
          onClick={onDelete}
          className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <NavIcon name="trash" className="h-4 w-4" />
          Delete element
        </button>
      )}
    </div>
  );
}
