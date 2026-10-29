// Validates that a base64 image payload is a structurally real JPEG
// before it's returned to the client — not just "a non-empty string".
// This checks technical validity (decodable, correct magic bytes,
// plausible dimensions) only. It cannot and does not check whether
// the image actually matches the prompt; that's a visual-adherence
// question no automated check here can honestly answer.

export interface ValidatedImage {
  width: number;
  height: number;
  byteLength: number;
}

export class InvalidImageOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidImageOutputError";
  }
}

const JPEG_SOI = 0xffd8; // Start Of Image marker
const JPEG_EOI = [0xff, 0xd9]; // End Of Image marker bytes
const MIN_BYTE_LENGTH = 512; // A real JPEG is never this small.

// SOF (Start Of Frame) marker range that carries width/height.
// 0xC0–0xCF except the DHT (0xC4), JPG ext (0xC8), and DAC (0xCC)
// markers, which share the range but aren't frame headers.
function isSofMarker(marker: number): boolean {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    marker !== 0xc4 &&
    marker !== 0xc8 &&
    marker !== 0xcc
  );
}

function readJpegDimensions(buffer: Buffer): { width: number; height: number } {
  let offset = 2; // skip the SOI marker already checked by the caller

  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];

    if (isSofMarker(marker)) {
      // Segment layout: FF xx, length(2 bytes), precision(1 byte),
      // height(2 bytes), width(2 bytes), ...
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }

    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      // Markers with no payload length to skip.
      offset += 2;
      continue;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }

  throw new InvalidImageOutputError(
    "Could not find a valid JPEG frame header to read image dimensions."
  );
}

// Decodes the base64 payload and verifies it is a plausible,
// non-empty JPEG with readable dimensions. Throws
// InvalidImageOutputError on any failure.
export function validateJpegOutput(base64Image: string): ValidatedImage {
  if (!base64Image || base64Image.trim().length === 0) {
    throw new InvalidImageOutputError(
      "The provider returned an empty image payload."
    );
  }

  // Node's Buffer.from(..., "base64") does not throw on malformed
  // input — it decodes whatever it can. Invalid or garbage input is
  // instead caught below by the size/magic-byte/dimension checks.
  const buffer = Buffer.from(base64Image, "base64");

  if (buffer.length < MIN_BYTE_LENGTH) {
    throw new InvalidImageOutputError(
      `The decoded image is too small to be valid (${buffer.length} bytes).`
    );
  }

  const startMarker = buffer.readUInt16BE(0);

  if (startMarker !== JPEG_SOI) {
    throw new InvalidImageOutputError(
      "The decoded image does not start with a valid JPEG header."
    );
  }

  const lastTwoBytes = [
    buffer[buffer.length - 2],
    buffer[buffer.length - 1],
  ];

  if (lastTwoBytes[0] !== JPEG_EOI[0] || lastTwoBytes[1] !== JPEG_EOI[1]) {
    throw new InvalidImageOutputError(
      "The decoded image is missing a valid JPEG end marker and may be truncated."
    );
  }

  const { width, height } = readJpegDimensions(buffer);

  if (width <= 0 || height <= 0) {
    throw new InvalidImageOutputError(
      `The decoded image reports invalid dimensions (${width}x${height}).`
    );
  }

  return { width, height, byteLength: buffer.length };
}
