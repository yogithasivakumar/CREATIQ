import { describe, expect, it } from "vitest";
import { generateCaption, type CaptionStyle, type CaptionTone } from "../src/services/captions/captionGenerator.js";

const STYLES: CaptionStyle[] = [
  "product_highlight",
  "storytelling",
  "promotional",
  "lifestyle",
  "educational",
];

const TONES: CaptionTone[] = [
  "engaging_friendly",
  "professional",
  "playful",
  "luxurious",
  "minimal",
];

describe("generateCaption", () => {
  it("produces a non-empty caption for every style/tone combination", () => {
    for (const style of STYLES) {
      for (const tone of TONES) {
        const result = generateCaption({
          subject: "a red bicycle leaning against a brick wall",
          style,
          tone,
          length: "medium",
          hashtagCount: 5,
        });

        expect(result.caption.length).toBeGreaterThan(0);
      }
    }
  });

  it("includes a word derived from the subject in the caption (does not invent an unrelated subject)", () => {
    const result = generateCaption({
      subject: "a luxury perfume bottle",
      style: "product_highlight",
      tone: "luxurious",
      length: "short",
      hashtagCount: 0,
    });

    expect(result.caption.toLowerCase()).toContain("perfume");
  });

  it("is deterministic: the same input always produces the same output", () => {
    const input = {
      subject: "a mountain landscape at sunrise",
      style: "storytelling" as const,
      tone: "engaging_friendly" as const,
      length: "medium" as const,
      hashtagCount: 5,
    };

    const first = generateCaption(input);
    const second = generateCaption(input);

    expect(first.caption).toBe(second.caption);
    expect(first.hashtags).toEqual(second.hashtags);
  });

  it("produces a different caption for a different variant (Regenerate), same inputs otherwise", () => {
    const base = {
      subject: "a mountain landscape at sunrise",
      style: "storytelling" as const,
      tone: "engaging_friendly" as const,
      length: "medium" as const,
      hashtagCount: 5,
    };

    const first = generateCaption({ ...base, variant: 0 });
    const second = generateCaption({ ...base, variant: 1 });

    expect(first.caption).not.toBe(second.caption);
  });

  it("returns exactly hashtagCount hashtags when the requested count is below the available pool", () => {
    const result = generateCaption({
      subject: "a product shot",
      style: "promotional",
      tone: "playful",
      length: "short",
      hashtagCount: 2,
    });

    expect(result.hashtags).toHaveLength(2);
  });

  it("returns zero hashtags when hashtagCount is 0", () => {
    const result = generateCaption({
      subject: "a product shot",
      style: "educational",
      tone: "minimal",
      length: "short",
      hashtagCount: 0,
    });

    expect(result.hashtags).toEqual([]);
  });

  it("includes style-relevant hashtags in the output", () => {
    const result = generateCaption({
      subject: "a product shot",
      style: "lifestyle",
      tone: "minimal",
      length: "short",
      hashtagCount: 5,
    });

    expect(result.hashtags).toContain("LifestyleBrand");
  });

  it("appends the caller's own instructions verbatim (never silently drops them)", () => {
    const result = generateCaption({
      subject: "a product shot",
      style: "product_highlight",
      tone: "professional",
      length: "short",
      instructions: "Mention our 30-day guarantee.",
      hashtagCount: 0,
    });

    expect(result.caption).toContain("Mention our 30-day guarantee.");
  });

  it("truncates instructions to a safe maximum length rather than failing", () => {
    const longInstructions = "x".repeat(1000);

    const result = generateCaption({
      subject: "a product shot",
      style: "product_highlight",
      tone: "professional",
      length: "short",
      instructions: longInstructions,
      hashtagCount: 0,
    });

    expect(result.caption.length).toBeLessThan(1000 + 200);
  });

  it("caps an unusually long subject rather than producing an unbounded caption", () => {
    const longSubject = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");

    const result = generateCaption({
      subject: longSubject,
      style: "storytelling",
      tone: "engaging_friendly",
      length: "long",
      hashtagCount: 0,
    });

    expect(result.caption.split(" ").length).toBeLessThan(80);
  });

  it("produces a longer caption for length: long than length: short with the same inputs", () => {
    const base = {
      subject: "a mountain landscape at sunrise",
      style: "storytelling" as const,
      tone: "engaging_friendly" as const,
      hashtagCount: 0,
    };

    const short = generateCaption({ ...base, length: "short" });
    const long = generateCaption({ ...base, length: "long" });

    expect(long.caption.length).toBeGreaterThan(short.caption.length);
  });
});
