"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { ExportModal } from "@/components/creative-editor/ExportModal";
import { ImageSelector } from "@/components/creative-editor/ImageSelector";
import { LeftSidebar } from "@/components/creative-editor/LeftSidebar";
import { RightSidebar } from "@/components/creative-editor/RightSidebar";
import { SaveModal } from "@/components/creative-editor/SaveModal";
import { Toolbar } from "@/components/creative-editor/Toolbar";
import { useFabricEditor } from "@/components/creative-editor/useFabricEditor";
import type { Tool } from "@/components/creative-editor/types";
import type { Asset, Project } from "@/components/library/types";

function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function CreativeEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assetIdParam = searchParams.get("assetId");

  const [asset, setAsset] = useState<Asset | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("Untitled design");
  const [activeTool, setActiveTool] = useState<Tool>("basic");
  const [showExport, setShowExport] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const editor = useFabricEditor();

  useEffect(() => {
    apiFetch<{ projects: Project[] }>("/api/projects")
      .then((data) => setProjects(data.projects))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!assetIdParam) return;
    apiFetch<{ asset: Asset }>(`/api/assets/${assetIdParam}`)
      .then((data) => {
        setAsset(data.asset);
        setName(data.asset.prompt ?? "Untitled design");
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Could not load this image."));
  }, [assetIdParam]);

  useEffect(() => {
    if (!canvasElRef.current || !asset) return;
    const cleanup = editor.initCanvas(canvasElRef.current);
    if (canvasContainerRef.current) editor.setContainer(canvasContainerRef.current);
    editor.loadImage(asset.url);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset]);

  // Keeps the canvas display fitted when the workspace is resized —
  // window resize, sidebar content changing height, or the browser
  // zoom level changing all change how much room is actually available.
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => editor.fitToScreen());
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset]);

  // Keyboard shortcuts — skipped while typing in an input/textarea so
  // they don't interfere with normal text entry (including editing
  // in-canvas text, which Fabric renders via a hidden textarea).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !isTyping) {
        e.preventDefault();
        editor.undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "Z")) && !isTyping) {
        e.preventDefault();
        editor.redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        setShowSave(true);
      } else if (e.key === "Delete" && !isTyping) {
        editor.deleteSelected();
      } else if (e.key === "Escape") {
        editor.getCanvas()?.discardActiveObject();
        editor.getCanvas()?.requestRenderAll();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleExport(format: "jpeg" | "png", quality: number) {
    const dataUrl = editor.exportDataUrl(format, quality);
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, `${name || "creatiq-export"}.${format === "jpeg" ? "jpg" : "png"}`);
    setShowExport(false);
  }

  async function handleSave(saveName: string, projectId: string | undefined) {
    const dataUrl = editor.exportDataUrl("jpeg", 0.92);
    if (!dataUrl) return;

    setSaving(true);
    setSaveError("");

    try {
      await apiFetch("/api/assets", {
        method: "POST",
        body: JSON.stringify({
          image: dataUrlToBase64(dataUrl),
          prompt: saveName || undefined,
          projectId,
        }),
      });
      setShowSave(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save this image.");
    } finally {
      setSaving(false);
    }
  }

  if (!assetIdParam) {
    return (
      <ImageSelector
        onSelect={(selected) => router.push(`/dashboard/creative-editor?assetId=${selected.id}`)}
      />
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-sm text-red-600">{loadError}</p>
        <button
          onClick={() => router.push("/dashboard/creative-editor")}
          className="mt-4 text-sm font-medium text-aubergine underline"
        >
          Choose a different image
        </button>
      </div>
    );
  }

  if (!asset) {
    return <div className="py-24 text-center text-sm text-aubergine/50">Loading image...</div>;
  }

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col overflow-hidden border-aubergine/10 sm:inset-4 sm:rounded-2xl sm:border">
      <Toolbar
        name={name}
        onNameChange={setName}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onReset={editor.reset}
        zoom={editor.zoom}
        onZoomChange={editor.setZoomLevel}
        onFitToScreen={editor.fitToScreen}
        onExport={() => setShowExport(true)}
        onSave={() => setShowSave(true)}
        saving={saving}
        onBack={() => router.push("/dashboard/creative-editor")}
      />

      {saveSuccess && (
        <p role="status" className="bg-green-50 px-4 py-2 text-center text-sm text-green-700">
          Saved to My Library.
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <LeftSidebar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onCrop={editor.startCrop}
          cropping={editor.cropping}
          onApplyCrop={editor.applyCrop}
          onCancelCrop={editor.cancelCrop}
          onRotate={editor.rotate}
          onFlip={editor.flip}
          onResize={editor.resizeCanvas}
          dimensions={editor.dimensions}
          adjustments={editor.adjustments}
          onAdjust={editor.setAdjustment}
          onCommitAdjustments={editor.commitAdjustments}
          filterPreset={editor.filterPreset}
          onFilterPreset={editor.applyFilterPreset}
          onAddText={editor.addText}
          onAddShape={editor.addShape}
        />

        <div
          ref={canvasContainerRef}
          className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-silver"
        >
          <canvas ref={canvasElRef} />
        </div>

        <RightSidebar
          activeObject={editor.activeObject}
          dimensions={editor.dimensions}
          onUpdate={editor.updateSelectedProps}
          onCommit={editor.commitSelectedProps}
          onDelete={editor.deleteSelected}
        />
      </div>

      {showExport && <ExportModal onClose={() => setShowExport(false)} onExport={handleExport} />}
      {showSave && (
        <SaveModal
          defaultName={name}
          projects={projects}
          saving={saving}
          error={saveError}
          onClose={() => setShowSave(false)}
          onConfirm={handleSave}
        />
      )}
    </div>
  );
}

export default function CreativeEditorPage() {
  return (
    <Suspense fallback={null}>
      <CreativeEditorContent />
    </Suspense>
  );
}
