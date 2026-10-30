"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import type { AdjustmentValues, FilterPreset } from "./types";
import { DEFAULT_ADJUSTMENTS } from "./types";

const MAX_HISTORY = 50;

// Builds the Fabric filter list for the base image from the current
// adjustment sliders + selected preset. Re-applied from scratch on
// every change rather than mutated in place — simpler and correct,
// and cheap since filter application only touches the image object's
// pixel buffer once per change, not every frame.
function buildFilters(adjustments: AdjustmentValues, preset: FilterPreset): fabric.filters.BaseFilter<string>[] {
  const list: fabric.filters.BaseFilter<string>[] = [];

  if (adjustments.brightness !== 0) {
    list.push(new fabric.filters.Brightness({ brightness: adjustments.brightness }));
  }
  if (adjustments.contrast !== 0) {
    list.push(new fabric.filters.Contrast({ contrast: adjustments.contrast }));
  }
  if (adjustments.saturation !== 0) {
    list.push(new fabric.filters.Saturation({ saturation: adjustments.saturation }));
  }
  if (adjustments.temperature !== 0) {
    const warm = adjustments.temperature > 0;
    list.push(
      new fabric.filters.BlendColor({
        color: warm ? "#ff9933" : "#3399ff",
        mode: "multiply",
        alpha: Math.min(Math.abs(adjustments.temperature) * 0.35, 0.35),
      })
    );
  }

  switch (preset) {
    case "grayscale":
      list.push(new fabric.filters.Grayscale());
      break;
    case "vintage":
      list.push(new fabric.filters.Vintage());
      break;
    case "sepia":
      list.push(new fabric.filters.Sepia());
      break;
    case "blackwhite":
      list.push(new fabric.filters.BlackWhite());
      break;
    case "kodachrome":
      list.push(new fabric.filters.Kodachrome());
      break;
    case "technicolor":
      list.push(new fabric.filters.Technicolor());
      break;
    case "dramatic":
      list.push(new fabric.filters.Contrast({ contrast: 0.3 }));
      list.push(new fabric.filters.Saturation({ saturation: 0.25 }));
      break;
    case "original":
    default:
      break;
  }

  return list;
}

// Keeps the canvas's CSS display size in sync with its backing-store
// pixel size (which stays at full native image resolution — needed
// for correct crop math and full-quality export) by scaling the
// *display* to fit a container via Fabric's zoom, which it applies to
// both the rendered content and the CSS size together via
// `{ cssOnly: true }` — the backing `<canvas>` width/height attributes
// (and therefore its actual pixel buffer) are never touched by this.
function fitCanvasToContainer(
  canvas: fabric.Canvas,
  container: HTMLElement,
  naturalWidth: number,
  naturalHeight: number
): number {
  const padding = 32; // breathing room so the image never touches the container edge
  const availableW = Math.max(container.clientWidth - padding, 50);
  const availableH = Math.max(container.clientHeight - padding, 50);

  const fitZoom = Math.min(availableW / naturalWidth, availableH / naturalHeight, 1);

  canvas.setDimensions(
    { width: naturalWidth * fitZoom, height: naturalHeight * fitZoom },
    { cssOnly: true }
  );
  canvas.setZoom(fitZoom);
  canvas.requestRenderAll();

  return fitZoom;
}

export function useFabricEditor() {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const baseImageRef = useRef<fabric.FabricImage | null>(null);
  const originalSrcRef = useRef<string>("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const suppressHistoryRef = useRef(false);
  const cropRectRef = useRef<fabric.Rect | null>(null);

  const [ready, setReady] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [activeObject, setActiveObject] = useState<fabric.FabricObject | null>(null);
  const [dirty, setDirty] = useState(false);
  const [adjustments, setAdjustments] = useState<AdjustmentValues>(DEFAULT_ADJUSTMENTS);
  const [filterPreset, setFilterPreset] = useState<FilterPreset>("original");
  const [zoom, setZoom] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [cropping, setCropping] = useState(false);

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || suppressHistoryRef.current) return;

    const json = JSON.stringify(canvas.toObject());
    const history = historyRef.current;
    const nextIndex = historyIndexRef.current + 1;

    history.splice(nextIndex, history.length - nextIndex, json);
    if (history.length > MAX_HISTORY) history.shift();
    else historyIndexRef.current = nextIndex;

    historyIndexRef.current = Math.min(nextIndex, MAX_HISTORY - 1);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
    setDirty(true);
  }, []);

  // Re-fits the canvas display to whatever the registered container's
  // current size is, using the backing store's actual pixel
  // dimensions (fabric.Canvas#getWidth()/getHeight() report the
  // *backing* size, not the zoomed display size, so this stays
  // correct no matter the current zoom level when it's called).
  const fitToScreen = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const currentZoom = canvas.getZoom();
    const naturalWidth = canvas.getWidth() / currentZoom;
    const naturalHeight = canvas.getHeight() / currentZoom;
    const fitZoom = fitCanvasToContainer(canvas, container, naturalWidth, naturalHeight);
    setZoom(fitZoom);
  }, []);

  const setContainer = useCallback(
    (el: HTMLElement | null) => {
      containerRef.current = el;
      if (el) fitToScreen();
    },
    [fitToScreen]
  );

  const initCanvas = useCallback((el: HTMLCanvasElement) => {
    const canvas = new fabric.Canvas(el, {
      preserveObjectStacking: true,
      backgroundColor: "#ffffff",
    });
    canvasRef.current = canvas;

    canvas.on("selection:created", () => {
      setHasSelection(true);
      setActiveObject(canvas.getActiveObject() ?? null);
    });
    canvas.on("selection:updated", () => {
      setHasSelection(true);
      setActiveObject(canvas.getActiveObject() ?? null);
    });
    canvas.on("selection:cleared", () => {
      setHasSelection(false);
      setActiveObject(null);
    });
    canvas.on("object:modified", pushHistory);

    setReady(true);

    return () => {
      canvas.dispose();
      canvasRef.current = null;
      setReady(false);
    };
  }, [pushHistory]);

  // Loads a fresh image into a blank canvas, sized to the image's
  // natural dimensions, and seeds history with that initial state —
  // this IS the "original" state Reset returns to.
  const loadImage = useCallback(async (url: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    originalSrcRef.current = url;
    const img = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });

    const width = img.width ?? 1;
    const height = img.height ?? 1;

    canvas.clear();
    canvas.setZoom(1);
    canvas.setDimensions({ width, height });
    img.set({ left: 0, top: 0, selectable: false, evented: false });
    canvas.add(img);
    canvas.sendObjectToBack(img);
    baseImageRef.current = img;
    setDimensions({ width, height });
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setFilterPreset("original");

    if (containerRef.current) {
      const fitZoom = fitCanvasToContainer(canvas, containerRef.current, width, height);
      setZoom(fitZoom);
    } else {
      canvas.requestRenderAll();
    }

    historyRef.current = [JSON.stringify(canvas.toObject())];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
    setDirty(false);
  }, []);

  const applyImageFilters = useCallback(
    (nextAdjustments: AdjustmentValues, nextPreset: FilterPreset) => {
      const img = baseImageRef.current;
      const canvas = canvasRef.current;
      if (!img || !canvas) return;

      img.filters = buildFilters(nextAdjustments, nextPreset);
      img.applyFilters();
      canvas.requestRenderAll();
    },
    []
  );

  const setAdjustment = useCallback(
    (key: keyof AdjustmentValues, value: number) => {
      setAdjustments((prev) => {
        const next = { ...prev, [key]: value };
        applyImageFilters(next, filterPreset);
        return next;
      });
    },
    [applyImageFilters, filterPreset]
  );

  const commitAdjustments = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const applyFilterPreset = useCallback(
    (preset: FilterPreset) => {
      setFilterPreset(preset);
      applyImageFilters(adjustments, preset);
      pushHistory();
    },
    [adjustments, applyImageFilters, pushHistory]
  );

  const restoreFromJson = useCallback((json: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    suppressHistoryRef.current = true;
    canvas.loadFromJSON(JSON.parse(json)).then(() => {
      canvas.getObjects().forEach((obj) => {
        if (obj instanceof fabric.FabricImage && obj === canvas.getObjects()[0]) {
          baseImageRef.current = obj;
        }
      });
      const base = canvas.getObjects().find((o) => o instanceof fabric.FabricImage) as
        | fabric.FabricImage
        | undefined;
      if (base) baseImageRef.current = base;
      canvas.requestRenderAll();
      suppressHistoryRef.current = false;
    });
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    restoreFromJson(historyRef.current[historyIndexRef.current]);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
    setDirty(historyIndexRef.current > 0);
  }, [restoreFromJson]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    restoreFromJson(historyRef.current[historyIndexRef.current]);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    setDirty(true);
  }, [restoreFromJson]);

  const reset = useCallback(() => {
    if (!originalSrcRef.current) return;
    loadImage(originalSrcRef.current);
  }, [loadImage]);

  const rotate = useCallback(
    (degrees: 90 | -90) => {
      const canvas = canvasRef.current;
      const img = baseImageRef.current;
      if (!canvas || !img) return;

      const angle = ((img.angle ?? 0) + degrees + 360) % 360;
      img.set({ angle });

      // Swap canvas dimensions on a 90-degree turn so the whole
      // rotated image stays visible instead of being clipped by a
      // canvas sized for the original orientation.
      const w = canvas.getWidth();
      const h = canvas.getHeight();
      canvas.setDimensions({ width: h, height: w });
      img.set({ left: (h - (img.width ?? 0) * (img.scaleX ?? 1)) / 2, top: (w - (img.height ?? 0) * (img.scaleY ?? 1)) / 2 });

      setDimensions({ width: h, height: w });
      if (containerRef.current) {
        const fitZoom = fitCanvasToContainer(canvas, containerRef.current, h, w);
        setZoom(fitZoom);
      } else {
        canvas.requestRenderAll();
      }
      pushHistory();
    },
    [pushHistory]
  );

  const flip = useCallback(
    (axis: "horizontal" | "vertical") => {
      const img = baseImageRef.current;
      const canvas = canvasRef.current;
      if (!img || !canvas) return;

      if (axis === "horizontal") img.set({ flipX: !img.flipX });
      else img.set({ flipY: !img.flipY });

      canvas.requestRenderAll();
      pushHistory();
    },
    [pushHistory]
  );

  // Crop is modeled as a draggable/resizable overlay rectangle the
  // user positions over the region to keep; applying it re-slices
  // the base FabricImage using its native cropX/cropY/width/height
  // (no canvas-resize tricks needed — Fabric supports this directly).
  const startCrop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.getWidth();
    const h = canvas.getHeight();
    const rect = new fabric.Rect({
      left: w * 0.1,
      top: h * 0.1,
      width: w * 0.8,
      height: h * 0.8,
      fill: "rgba(234,170,0,0.15)",
      stroke: "#EAAA00",
      strokeWidth: 2,
      strokeDashArray: [6, 4],
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.requestRenderAll();
    cropRectRef.current = rect;
    setCropping(true);
  }, []);

  const applyCrop = useCallback(() => {
    const canvas = canvasRef.current;
    const img = baseImageRef.current;
    const rect = cropRectRef.current;
    if (!canvas || !img || !rect) return;

    const imgLeft = img.left ?? 0;
    const imgTop = img.top ?? 0;
    const scaleX = img.scaleX ?? 1;
    const scaleY = img.scaleY ?? 1;

    const rectLeft = rect.left ?? 0;
    const rectTop = rect.top ?? 0;
    const rectW = (rect.width ?? 0) * (rect.scaleX ?? 1);
    const rectH = (rect.height ?? 0) * (rect.scaleY ?? 1);

    const cropX = Math.max(0, (rectLeft - imgLeft) / scaleX);
    const cropY = Math.max(0, (rectTop - imgTop) / scaleY);
    const cropW = Math.max(1, rectW / scaleX);
    const cropH = Math.max(1, rectH / scaleY);

    img.set({
      cropX,
      cropY,
      width: cropW,
      height: cropH,
      left: rectLeft,
      top: rectTop,
    });

    canvas.remove(rect);
    cropRectRef.current = null;
    canvas.setDimensions({ width: rectW, height: rectH });
    img.set({ left: 0, top: 0 });
    setDimensions({ width: Math.round(rectW), height: Math.round(rectH) });
    setCropping(false);
    if (containerRef.current) {
      const fitZoom = fitCanvasToContainer(canvas, containerRef.current, rectW, rectH);
      setZoom(fitZoom);
    } else {
      canvas.requestRenderAll();
    }
    pushHistory();
  }, [pushHistory]);

  const cancelCrop = useCallback(() => {
    const canvas = canvasRef.current;
    const rect = cropRectRef.current;
    if (canvas && rect) canvas.remove(rect);
    cropRectRef.current = null;
    canvas?.requestRenderAll();
    setCropping(false);
  }, []);

  // Resize the whole canvas/image (not a crop) — scales the base
  // image to new target dimensions, optionally preserving aspect
  // ratio by deriving height from width (or vice versa) beforehand.
  const resizeCanvas = useCallback(
    (width: number, height: number) => {
      const canvas = canvasRef.current;
      const img = baseImageRef.current;
      if (!canvas || !img) return;

      const naturalW = img.width ?? 1;
      const naturalH = img.height ?? 1;
      img.set({ scaleX: width / naturalW, scaleY: height / naturalH, left: 0, top: 0 });
      canvas.setDimensions({ width, height });
      setDimensions({ width, height });
      if (containerRef.current) {
        const fitZoom = fitCanvasToContainer(canvas, containerRef.current, width, height);
        setZoom(fitZoom);
      } else {
        canvas.requestRenderAll();
      }
      pushHistory();
    },
    [pushHistory]
  );

  const addText = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const text = new fabric.Textbox("Double-click to edit", {
      left: canvas.getWidth() / 2 - 100,
      top: canvas.getHeight() / 2 - 20,
      width: 200,
      fontSize: 32,
      fill: "#3A0F34",
      fontFamily: "Arial",
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
    pushHistory();
  }, [pushHistory]);

  const addShape = useCallback(
    (shape: "rect" | "circle" | "triangle") => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const common = {
        left: canvas.getWidth() / 2 - 60,
        top: canvas.getHeight() / 2 - 60,
        fill: "#EAAA00",
      };

      let obj: fabric.FabricObject;
      if (shape === "rect") obj = new fabric.Rect({ ...common, width: 120, height: 120 });
      else if (shape === "circle") obj = new fabric.Circle({ ...common, radius: 60 });
      else obj = new fabric.Triangle({ ...common, width: 120, height: 120 });

      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
      pushHistory();
    },
    [pushHistory]
  );

  const deleteSelected = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active || active === baseImageRef.current) return;

    canvas.remove(active);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    pushHistory();
  }, [pushHistory]);

  const updateSelectedProps = useCallback(
    (props: Record<string, unknown>) => {
      const canvas = canvasRef.current;
      const active = canvas?.getActiveObject();
      if (!canvas || !active) return;
      active.set(props);
      canvas.requestRenderAll();
    },
    []
  );

  const commitSelectedProps = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const setZoomLevel = useCallback((level: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const clamped = Math.min(Math.max(level, 0.1), 3);
    const currentZoom = canvas.getZoom();
    const naturalWidth = canvas.getWidth() / currentZoom;
    const naturalHeight = canvas.getHeight() / currentZoom;

    canvas.setZoom(clamped);
    canvas.setDimensions(
      { width: naturalWidth * clamped, height: naturalHeight * clamped },
      { cssOnly: true }
    );
    canvas.requestRenderAll();
    setZoom(clamped);
  }, []);

  // Flattens the canvas (image + all filters/text/shapes baked in) to
  // a data URL at the canvas's native resolution (multiplier: 1 —
  // never upscaled or downscaled from what's actually on the canvas,
  // per the "do not unnecessarily reduce image resolution" rule).
  const exportDataUrl = useCallback(
    (format: "jpeg" | "png", quality: number): string | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const activeZoom = canvas.getZoom();
      canvas.setZoom(1);
      const url = canvas.toDataURL({ format, quality, multiplier: 1 });
      canvas.setZoom(activeZoom);
      return url;
    },
    []
  );

  useEffect(() => {
    return () => {
      canvasRef.current?.dispose();
    };
  }, []);

  return {
    ready,
    canUndo,
    canRedo,
    hasSelection,
    dirty,
    adjustments,
    filterPreset,
    zoom,
    dimensions,
    cropping,
    initCanvas,
    loadImage,
    setAdjustment,
    commitAdjustments,
    applyFilterPreset,
    undo,
    redo,
    reset,
    rotate,
    flip,
    startCrop,
    applyCrop,
    cancelCrop,
    resizeCanvas,
    addText,
    addShape,
    deleteSelected,
    updateSelectedProps,
    commitSelectedProps,
    setZoomLevel,
    fitToScreen,
    setContainer,
    exportDataUrl,
    activeObject,
    getCanvas: () => canvasRef.current,
  };
}
