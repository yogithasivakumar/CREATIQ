// Deterministic, template-based prompt structuring for
// flux-1-schnell. No LLM call, no randomness, no network request —
// this is a pure string transform, so it costs nothing and never
// consumes inference quota on its own.
//
// flux-1-schnell's API schema (verified against Cloudflare's raw
// schema-input.json, which sets additionalProperties:false) accepts
// only { prompt, steps } — there is no width/height/negative_prompt
// field. "Negative constraints" therefore cannot be a real API
// parameter for this model; they can only be expressed as natural-
// language exclusion phrasing inside the single prompt string. This
// is a known, commonly used technique with diffusion models, but it
// is not guaranteed to be honored by the model — this function
// structures the request better, it does not guarantee output
// quality or prompt adherence.
//
// The enhancer never invents details the user didn't imply. It only
// organizes what's already in the prompt into clearer sections and
// appends a fixed, non-contradictory quality/negative-constraints
// footer. It does not call out to any model, paid or free, to do
// this structuring.
//
// Revision note (color/background priority fix): an earlier version
// of this template appended a generic, color-agnostic "Background:
// simple, uncluttered..." sentence unconditionally. In a real
// generation, a user who asked for "a deep aubergine background" got
// a predominantly red-orange/pink result instead — the generic
// Background/Materials sections said nothing about color, so they
// competed with (and diluted) the single color mention buried in the
// Subject sentence instead of reinforcing it. This version detects
// color words the user actually used and repeats them explicitly,
// with priority phrasing, in the Background and Materials sections
// instead of falling back to generic wording whenever a color is
// present. Known limitation: detection is a fixed keyword list, not
// real language understanding — an unlisted color name (e.g. a brand
// hex code or an uncommon color word) will not be detected and the
// enhancer falls back to the previous generic phrasing for that case.

// Common color/material words to detect in the user's prompt,
// including CREATIQ's own brand colors. Keep this list conservative
// (common English color/material terms) rather than exhaustive — a
// miss falls back to safe generic phrasing, not a wrong guess.
const COLOR_WORDS = [
  "aubergine",
  "marigold",
  "silver",
  "gold",
  "golden",
  "red",
  "orange",
  "red-orange",
  "pink",
  "magenta",
  "purple",
  "violet",
  "blue",
  "navy",
  "teal",
  "cyan",
  "turquoise",
  "green",
  "olive",
  "lime",
  "yellow",
  "amber",
  "brown",
  "tan",
  "beige",
  "cream",
  "ivory",
  "white",
  "black",
  "grey",
  "gray",
  "charcoal",
  "maroon",
  "burgundy",
  "coral",
  "peach",
  "lavender",
  "indigo",
  "bronze",
  "copper",
  "rose",
  "crimson",
  "scarlet",
] as const;

const MATERIAL_WORDS = [
  "glass",
  "metal",
  "metallic",
  "wood",
  "wooden",
  "leather",
  "fabric",
  "ceramic",
  "marble",
  "stone",
  "plastic",
  "matte",
  "glossy",
  "satin",
  "velvet",
  "silk",
] as const;

const DEFAULT_NEGATIVE_CONSTRAINTS =
  "blurriness, low resolution, extra limbs, distorted anatomy, and oversaturation";

const TEXT_LOGO_EXCLUSION =
  "Do not include any text, letters, words, numbers, captions, signage, watermarks, logos, or brand marks anywhere in the image, including on product surfaces, packaging, or labels. This instruction is a strong preference for the model, not a guarantee — text or logo-like marks may still occasionally appear.";

const QUALITY_FOOTER = "high detail, coherent composition, professional finish";

export interface EnhancedPrompt {
  /** The exact string sent to the model. */
  text: string;
  /** The original, unmodified user input, for display/logging. */
  originalPrompt: string;
  /** Color words detected in the user's prompt, for debugging/logging. */
  detectedColors: string[];
}

// Caps how many detected color/material words get echoed in the
// priority sections. Two reasons: (1) a prompt that happens to
// mention many color words shouldn't blow past the model's
// 2048-character limit just from the detected-word list being
// repeated three times across sections, and (2) instructing the model
// that "10+ colors must all be dominant" is incoherent anyway — a
// real, usable color-priority instruction names a handful of colors,
// not dozens. The words are kept in the order they first appear in
// the prompt, so the colors a user actually emphasizes early stay
// first.
const MAX_DETECTED_WORDS = 5;

function findWords(prompt: string, words: readonly string[]): string[] {
  const lowerPrompt = prompt.toLowerCase();
  const matches: { word: string; index: number }[] = [];

  for (const word of words) {
    const pattern = new RegExp(`\\b${word}\\b`, "i");
    const match = pattern.exec(lowerPrompt);

    if (match) {
      matches.push({ word, index: match.index });
    }
  }

  return matches
    .sort((a, b) => a.index - b.index)
    .slice(0, MAX_DETECTED_WORDS)
    .map((m) => m.word);
}

function buildMaterialsAndColorsSection(
  detectedColors: string[],
  detectedMaterials: string[]
): string {
  if (detectedColors.length === 0 && detectedMaterials.length === 0) {
    return "Materials and colors: coherent with the subject described above, natural and consistent color palette.";
  }

  const parts: string[] = [];

  if (detectedColors.length > 0) {
    parts.push(
      `the user-specified color${detectedColors.length > 1 ? "s" : ""} (${detectedColors.join(", ")}) must be the dominant, clearly visible color${detectedColors.length > 1 ? "s" : ""} in the image — do not substitute a different dominant color palette`
    );
  }

  if (detectedMaterials.length > 0) {
    parts.push(`materials consistent with: ${detectedMaterials.join(", ")}`);
  }

  return `Materials and colors: ${parts.join("; ")}.`;
}

function buildBackgroundSection(detectedColors: string[]): string {
  if (detectedColors.length === 0) {
    return "Background: simple, uncluttered, supporting the subject without distracting from it.";
  }

  return `Background: use the user-specified color${detectedColors.length > 1 ? "s" : ""} (${detectedColors.join(", ")}) as the dominant background color${detectedColors.length > 1 ? "s" : ""}, simple and uncluttered, not overridden by any other color scheme.`;
}

const MODEL_PROMPT_MAX_LENGTH = 2048; // schema-input.json: maxLength 2048

// Structures the user's prompt into explicit sections without
// inventing new subject matter. Colors and materials the user already
// named are detected and repeated with priority phrasing in the
// Background and Materials sections, so they reinforce (rather than
// compete with) the single mention in the Subject line.
//
// A long (near the 1000-character input cap), detail-rich prompt that
// also mentions several colors/materials can push the fully-structured
// text past the model's 2048-character limit. Rather than throw in
// that case — which would make the most detailed, color-specific
// prompts the ones most likely to fail — the lowest-priority sections
// are dropped first, in a fixed order, until the prompt fits. The
// Subject line (the user's own words) and the color-priority/
// text-exclusion sections (the ones this revision exists to fix) are
// dropped last, not first.
export function enhancePrompt(rawPrompt: string): EnhancedPrompt {
  const originalPrompt = rawPrompt.trim();

  const detectedColors = findWords(originalPrompt, COLOR_WORDS);
  const detectedMaterials = findWords(originalPrompt, MATERIAL_WORDS);

  // Ordered from lowest to highest priority. Built as an array of
  // [key, section] pairs so lower-priority entries can be dropped by
  // key without disturbing the others' relative order.
  const orderedSections: [string, string][] = [
    [
      "composition",
      "Composition: centered subject, clear focal point, balanced framing.",
    ],
    ["quality", `Quality: ${QUALITY_FOOTER}.`],
    [
      "additionalConstraints",
      `Additional constraints: avoid ${DEFAULT_NEGATIVE_CONSTRAINTS}.`,
    ],
    [
      "style",
      "Style: photorealistic unless the subject implies an illustrated or stylized look.",
    ],
    [
      "lighting",
      "Lighting: soft, even, well-balanced lighting with natural shadows.",
    ],
    ["textLogoExclusion", TEXT_LOGO_EXCLUSION],
    [
      "materialsAndColors",
      buildMaterialsAndColorsSection(detectedColors, detectedMaterials),
    ],
    ["background", buildBackgroundSection(detectedColors)],
    ["subject", `Subject: ${originalPrompt}.`],
  ];

  const dropOrder = orderedSections.map(([key]) => key);
  const included = new Map(orderedSections);

  function render(): string {
    return dropOrder
      .filter((key) => included.has(key))
      .map((key) => included.get(key))
      .reverse() // dropOrder is lowest-to-highest priority; output reads Subject first
      .join(" ");
  }

  let text = render();

  for (const key of dropOrder) {
    if (text.length <= MODEL_PROMPT_MAX_LENGTH) {
      break;
    }

    // Never drop the Subject line itself — it is the user's own
    // words and the one thing we must always send faithfully.
    if (key === "subject") {
      continue;
    }

    included.delete(key);
    text = render();
  }

  if (text.length > MODEL_PROMPT_MAX_LENGTH) {
    throw new Error(
      `Enhanced prompt exceeds the model's ${MODEL_PROMPT_MAX_LENGTH}-character limit (${text.length} characters) even after trimming optional sections. Shorten the input prompt.`
    );
  }

  return { text, originalPrompt, detectedColors };
}
