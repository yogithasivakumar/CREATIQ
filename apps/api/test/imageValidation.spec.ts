import { describe, expect, it } from "vitest";
import { validateJpegOutput } from "../src/services/ai/imageValidation.js";

// Builds a minimal, structurally valid JPEG buffer (SOI, a baseline
// SOF0 header carrying the given dimensions, then padding + EOI) —
// not a real photo, just enough bytes to exercise the magic-byte and
// dimension-parsing logic the way a real Cloudflare response would.
function buildMinimalJpeg(width: number, height: number): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);

  // SOF0 marker (0xFFC0), length=17 (0x0011), precision=8,
  // height(2 bytes), width(2 bytes), components=1, component data (3 bytes)
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

  // Padding to stay above the minimum byte-length threshold.
  const padding = Buffer.alloc(600, 0x00);
  const eoi = Buffer.from([0xff, 0xd9]);

  return Buffer.concat([soi, sof0, padding, eoi]);
}

describe("validateJpegOutput", () => {
  it("accepts a well-formed JPEG and returns its dimensions", () => {
    const jpeg = buildMinimalJpeg(512, 512);
    const base64 = jpeg.toString("base64");

    const result = validateJpegOutput(base64);

    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
    expect(result.byteLength).toBe(jpeg.length);
  });

  it("accepts non-square dimensions correctly", () => {
    const jpeg = buildMinimalJpeg(768, 1024);
    const base64 = jpeg.toString("base64");

    const result = validateJpegOutput(base64);

    expect(result.width).toBe(768);
    expect(result.height).toBe(1024);
  });

  it("rejects an empty string", () => {
    expect(() => validateJpegOutput("")).toThrow(/empty image payload/);
  });

  it("rejects a payload that is too small to be a real image", () => {
    const tinyBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

    expect(() => validateJpegOutput(tinyBuffer.toString("base64"))).toThrow(
      /too small/
    );
  });

  it("rejects a payload with the wrong start marker", () => {
    const wrongHeader = Buffer.concat([
      Buffer.from([0x00, 0x00]),
      Buffer.alloc(600, 0x00),
      Buffer.from([0xff, 0xd9]),
    ]);

    expect(() => validateJpegOutput(wrongHeader.toString("base64"))).toThrow(
      /does not start with a valid JPEG header/
    );
  });

  it("rejects a payload missing a valid end marker (truncated output)", () => {
    const jpeg = buildMinimalJpeg(512, 512);
    const truncated = jpeg.subarray(0, jpeg.length - 2);

    expect(() => validateJpegOutput(truncated.toString("base64"))).toThrow(
      /missing a valid JPEG end marker/
    );
  });

  it("rejects non-base64 garbage that happens to decode to junk bytes", () => {
    const garbage = "not-valid-base64-content-!!!!";

    expect(() => validateJpegOutput(garbage)).toThrow();
  });
});
