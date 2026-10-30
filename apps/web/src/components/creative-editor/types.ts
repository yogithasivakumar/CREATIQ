export type Tool = "basic" | "adjust" | "filters" | "text" | "shapes";

export interface AdjustmentValues {
  brightness: number; // -1..1
  contrast: number; // -1..1
  saturation: number; // -1..1
  temperature: number; // -1..1 (negative = cool, positive = warm)
}

export const DEFAULT_ADJUSTMENTS: AdjustmentValues = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
};

export type FilterPreset =
  | "original"
  | "grayscale"
  | "vintage"
  | "sepia"
  | "dramatic"
  | "blackwhite"
  | "kodachrome"
  | "technicolor";

export const FILTER_PRESETS: { id: FilterPreset; label: string }[] = [
  { id: "original", label: "Original" },
  { id: "grayscale", label: "Grayscale" },
  { id: "vintage", label: "Vintage" },
  { id: "sepia", label: "Sepia" },
  { id: "dramatic", label: "Dramatic" },
  { id: "blackwhite", label: "Black & White" },
  { id: "kodachrome", label: "Kodachrome" },
  { id: "technicolor", label: "Technicolor" },
];
