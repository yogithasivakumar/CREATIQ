import { describe, expect, it } from "vitest";
import { enhancePrompt } from "../src/services/ai/promptEnhancer.js";
import { validateJpegOutput } from "../src/services/ai/imageValidation.js";

// Repeatable evaluation set for the generation pipeline, covering the
// prompt categories named in the task: product photography,
// portraits, landscapes, illustrations, and a complex multi-constraint
// prompt. Every assertion here is mechanically checkable — presence
// of expected keywords, structural validity, length limits, output
// decodability. None of these assertions claim anything about
// subjective visual quality or whether a real generated image would
// actually look good; that cannot be verified by an automated test,
// only by a human looking at real output (see the manual verification
// note in the final report).

interface EvaluationCase {
  category: string;
  prompt: string;
  expectedKeywords: string[];
}

const EVALUATION_CASES: EvaluationCase[] = [
  {
    category: "product photography",
    prompt: "a stainless steel water bottle on a white studio background",
    expectedKeywords: ["stainless steel water bottle", "white studio background"],
  },
  {
    category: "portrait",
    prompt: "a close-up portrait of an elderly man with a grey beard, warm expression",
    expectedKeywords: ["elderly man", "grey beard", "warm expression"],
  },
  {
    category: "landscape",
    prompt: "a misty forest valley at dawn with a winding river",
    expectedKeywords: ["misty forest valley", "dawn", "winding river"],
  },
  {
    category: "illustration",
    prompt: "a flat-design vector illustration of a coffee cup with steam, minimalist style",
    expectedKeywords: ["flat-design vector illustration", "coffee cup", "minimalist style"],
  },
  {
    category: "complex multi-constraint",
    prompt:
      "a futuristic city skyline at sunset, floating glass buildings, warm orange and purple sky, birds in the distance, wide-angle view",
    expectedKeywords: [
      "futuristic city skyline",
      "floating glass buildings",
      "warm orange and purple sky",
      "wide-angle view",
    ],
  },
];

describe("generation evaluation set — prompt enhancement", () => {
  for (const testCase of EVALUATION_CASES) {
    describe(testCase.category, () => {
      it("preserves the user's subject keywords in the enhanced prompt", () => {
        const result = enhancePrompt(testCase.prompt);

        for (const keyword of testCase.expectedKeywords) {
          expect(result.text.toLowerCase()).toContain(keyword.toLowerCase());
        }
      });

      it("produces a structured, non-empty enhanced prompt under the model's limit", () => {
        const result = enhancePrompt(testCase.prompt);

        expect(result.text.length).toBeGreaterThan(testCase.prompt.length);
        expect(result.text.length).toBeLessThanOrEqual(2048);
      });

      it("includes every required structural section", () => {
        const result = enhancePrompt(testCase.prompt);

        for (const section of [
          "Subject:",
          "Materials and colors:",
          "Background:",
          "Lighting:",
          "Composition:",
          "Style:",
          "Quality:",
          "Additional constraints:",
        ]) {
          expect(result.text).toContain(section);
        }
      });

      it("is deterministic across repeated calls", () => {
        const first = enhancePrompt(testCase.prompt);
        const second = enhancePrompt(testCase.prompt);

        expect(first.text).toBe(second.text);
      });
    });
  }
});

describe("generation evaluation set — output validation", () => {
  function buildValidJpeg(width: number, height: number): Buffer {
    const soi = Buffer.from([0xff, 0xd8]);
    const sof0 = Buffer.from([
      0xff,
      0xc0,
      0x00,
      0x11,
      0x08,
      (height >> 8) & 0xff,
      height & 0xff,
      (width >> 8) & 0xff,
      width & 0xff,
      0x01,
      0x01,
      0x11,
      0x00,
    ]);
    const padding = Buffer.alloc(600, 0x00);
    const eoi = Buffer.from([0xff, 0xd9]);

    return Buffer.concat([soi, sof0, padding, eoi]);
  }

  it("accepts a well-formed output for every evaluation category's expected image size", () => {
    // flux-1-schnell's documented schema has no width/height
    // parameter, so this checks the validator against representative
    // output sizes rather than per-category sizes the API can't
    // actually request.
    for (const size of [512, 768, 1024]) {
      const jpeg = buildValidJpeg(size, size);
      const result = validateJpegOutput(jpeg.toString("base64"));

      expect(result.width).toBe(size);
      expect(result.height).toBe(size);
    }
  });

  it("rejects malformed output regardless of prompt category", () => {
    expect(() => validateJpegOutput("")).toThrow();
    expect(() => validateJpegOutput("clearly-not-an-image")).toThrow();
  });
});
