import { describe, expect, it } from "vitest";
import { enhancePrompt } from "../src/services/ai/promptEnhancer.js";

describe("enhancePrompt", () => {
  it("preserves the original user prompt verbatim in the Subject section", () => {
    const result = enhancePrompt("a red bicycle leaning against a brick wall");

    expect(result.originalPrompt).toBe(
      "a red bicycle leaning against a brick wall"
    );
    expect(result.text).toContain(
      "Subject: a red bicycle leaning against a brick wall."
    );
  });

  it("trims whitespace from the original prompt", () => {
    const result = enhancePrompt("  a cat on a windowsill  ");

    expect(result.originalPrompt).toBe("a cat on a windowsill");
  });

  it("includes all required structuring sections", () => {
    const result = enhancePrompt("a mountain landscape at sunrise");

    expect(result.text).toMatch(/Subject:/);
    expect(result.text).toMatch(/Materials and colors:/);
    expect(result.text).toMatch(/Background:/);
    expect(result.text).toMatch(/Lighting:/);
    expect(result.text).toMatch(/Composition:/);
    expect(result.text).toMatch(/Style:/);
    expect(result.text).toMatch(/Quality:/);
    expect(result.text).toMatch(/Additional constraints:/);
  });

  it("includes generic negative-constraint phrasing (no dedicated API field exists for this model)", () => {
    const result = enhancePrompt("a portrait of a woman");

    expect(result.text.toLowerCase()).toContain("avoid");
    expect(result.text.toLowerCase()).toContain("blurr");
  });

  it("contains exactly one Style section, not duplicate or conflicting style directives", () => {
    const result = enhancePrompt("a city skyline");

    const styleSectionCount = (result.text.match(/Style:/g) ?? []).length;

    expect(styleSectionCount).toBe(1);
  });

  it("stays within the model's 2048-character prompt limit for a maximum-length input", () => {
    const maxLengthPrompt = "a".repeat(1000);

    const result = enhancePrompt(maxLengthPrompt);

    expect(result.text.length).toBeLessThanOrEqual(2048);
  });

  it("stays within the model's 2048-character limit even for a max-length prompt dense with detected colors and materials", () => {
    // Regression test: an earlier version of this function threw on
    // this input (a full 1000-character subject combined with 5
    // detected colors + 5 detected materials pushed the structured
    // text to ~2167 characters). The function now drops lower-priority
    // sections instead of failing.
    const colorAndMaterialHeavyPrompt = (
      "aubergine marigold silver gold golden glass metal wood leather ceramic " +
      "x".repeat(1000)
    ).slice(0, 1000);

    const result = enhancePrompt(colorAndMaterialHeavyPrompt);

    expect(result.text.length).toBeLessThanOrEqual(2048);
    expect(result.text).toContain("Subject:");
  });

  it("throws a clear error only if the prompt cannot fit even after dropping optional sections", () => {
    // Not reachable via the real API (which caps input at 1000
    // chars), but verifies the safety net itself works correctly for
    // a genuinely unfittable input.
    const veryLongPrompt = "a".repeat(5000);

    expect(() => enhancePrompt(veryLongPrompt)).toThrow(/2048-character limit/);
  });

  it("is deterministic: the same input always produces the same output", () => {
    const first = enhancePrompt("a wooden chair in a sunlit room");
    const second = enhancePrompt("a wooden chair in a sunlit room");

    expect(first.text).toBe(second.text);
  });

  describe("explicit color preservation (regression: aubergine background became red-orange/pink in a real generation)", () => {
    it("detects a single user-specified color and reports it", () => {
      const result = enhancePrompt("a perfume bottle on a deep aubergine background");

      expect(result.detectedColors).toContain("aubergine");
    });

    it("gives the detected color explicit priority phrasing in the Background section", () => {
      const result = enhancePrompt("a perfume bottle on a deep aubergine background");

      expect(result.text).toMatch(/Background:.*aubergine.*dominant/i);
    });

    it("gives the detected color explicit priority phrasing in the Materials and colors section", () => {
      const result = enhancePrompt("a perfume bottle on a deep aubergine background");

      expect(result.text).toMatch(
        /Materials and colors:.*aubergine.*must be the dominant/i
      );
    });

    it("detects multiple user-specified colors (aubergine background, marigold-gold accents)", () => {
      const result = enhancePrompt(
        "a perfume bottle with a deep aubergine background and restrained marigold gold accents"
      );

      expect(result.detectedColors).toEqual(
        expect.arrayContaining(["aubergine", "marigold", "gold"])
      );
    });

    it("does not introduce an unrequested color into the Background/Materials priority sections", () => {
      const result = enhancePrompt("a perfume bottle on a deep aubergine background");

      // "red" and "pink" must not appear as part of the structured
      // guidance sections — only whatever the user actually wrote.
      const structuredSections = result.text
        .split(/(?=Background:|Materials and colors:)/)
        .filter((s) => s.startsWith("Background:") || s.startsWith("Materials"));

      for (const section of structuredSections) {
        expect(section.toLowerCase()).not.toContain("red-orange");
        expect(section.toLowerCase()).not.toContain(" pink");
      }
    });

    it("falls back to generic, non-color-specific phrasing when no known color or material word is present", () => {
      const result = enhancePrompt("a cat sitting on a windowsill");

      expect(result.detectedColors).toEqual([]);
      expect(result.text).toContain(
        "Background: simple, uncluttered, supporting the subject without distracting from it."
      );
      expect(result.text).toContain(
        "Materials and colors: coherent with the subject described above, natural and consistent color palette."
      );
    });

    it("gives material-only priority phrasing (no color detected) without the generic color-agnostic filler", () => {
      const result = enhancePrompt("a wooden chair in a sunlit room");

      expect(result.detectedColors).toEqual([]);
      expect(result.text).toContain("materials consistent with: wooden");
      expect(result.text).not.toContain(
        "coherent with the subject described above, natural and consistent color palette"
      );
    });

    it("caps the number of colors echoed in priority phrasing so the instruction stays coherent", () => {
      const manyColorsPrompt =
        "aubergine marigold silver gold golden red orange pink purple blue product shot";

      const result = enhancePrompt(manyColorsPrompt);

      expect(result.detectedColors.length).toBeLessThanOrEqual(5);
    });
  });

  describe("no-text/no-logo exclusion preservation (regression: garbled lettering appeared on a product in a real generation)", () => {
    it("includes an explicit, dedicated text/logo exclusion instruction", () => {
      const result = enhancePrompt("a perfume bottle product photo");

      expect(result.text).toMatch(
        /do not include any text, letters, words, numbers, captions, signage, watermarks, logos, or brand marks/i
      );
    });

    it("explicitly mentions product surfaces and labels, where the observed garbled text appeared", () => {
      const result = enhancePrompt("a perfume bottle product photo");

      expect(result.text.toLowerCase()).toContain("product surfaces");
      expect(result.text.toLowerCase()).toContain("labels");
    });

    it("does not claim the exclusion is guaranteed", () => {
      const result = enhancePrompt("a perfume bottle product photo");

      expect(result.text.toLowerCase()).toContain("not a guarantee");
    });

    it("includes the exclusion regardless of whether the user already mentioned 'no text'", () => {
      const withExplicitAsk = enhancePrompt(
        "a perfume bottle product photo, no text, watermark, or logo"
      );
      const withoutExplicitAsk = enhancePrompt("a perfume bottle product photo");

      expect(withExplicitAsk.text).toMatch(/do not include any text/i);
      expect(withoutExplicitAsk.text).toMatch(/do not include any text/i);
    });
  });

  describe("contradictory or competing default phrasing", () => {
    it("does not pair a user-specified color with generic 'natural and consistent color palette' filler for the same prompt", () => {
      const result = enhancePrompt("a perfume bottle on a deep aubergine background");

      // The generic fallback phrasing is only used when no color was
      // detected — it should not appear alongside the color-priority
      // phrasing, which would read as two different instructions.
      expect(result.text).not.toContain(
        "Materials and colors: coherent with the subject described above, natural and consistent color palette."
      );
    });

    it("does not pair a user-specified color with the generic color-agnostic Background filler for the same prompt", () => {
      const result = enhancePrompt("a perfume bottle on a deep aubergine background");

      expect(result.text).not.toContain(
        "Background: simple, uncluttered, supporting the subject without distracting from it."
      );
    });

    it("never asserts both the generic and color-specific background phrasing together", () => {
      const withColor = enhancePrompt("a red car");
      const withoutColor = enhancePrompt("a car");

      const backgroundSectionCount = (text: string) =>
        (text.match(/Background:/g) ?? []).length;

      expect(backgroundSectionCount(withColor.text)).toBe(1);
      expect(backgroundSectionCount(withoutColor.text)).toBe(1);
    });
  });
});
