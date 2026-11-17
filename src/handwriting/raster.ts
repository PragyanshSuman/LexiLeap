import { IMAGE_SIZE } from './model';

export interface InkPoint {
  x: number;
  y: number;
}
export type InkStroke = InkPoint[];

/**
 * Size of the letter's longest side in the 28px image. EMNIST's box is 24px, but finger-drawn letters
 * read best at 20px (measured with scripts/evaluate-handwriting.py, see docs/HANDWRITING_METRICS.md).
 */
const CONTENT_SIZE = 20;
/** Draw at 4× and average down, for smooth strokes like the scanned EMNIST letters. */
const SUPERSAMPLE = 4;
/** Pen width in final pixels, about what EMNIST strokes measure. */
const PEN_WIDTH = 2.4;

/**
 * Turns strokes (any coordinate space, y pointing down) into a 28×28 upright image, 0 = paper and
 * 1 = ink, cropped and centred like EMNIST so the letter's size and position on the canvas don't matter.
 * Returns null when nothing was drawn.
 */
export function rasterize(strokes: InkStroke[]): Float32Array | null {
  const points = strokes.flat();
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...ys) - minY;
  const extent = Math.max(width, height, 1e-6);

  const big = IMAGE_SIZE * SUPERSAMPLE;
  // A single tap stays a dot instead of filling the box.
  const s = extent < 1 ? 1 : (CONTENT_SIZE * SUPERSAMPLE) / extent;
  const offsetX = (big - width * s) / 2;
  const offsetY = (big - height * s) / 2;
  const segments = strokes.map((stroke) => stroke.map((p) => ({ x: (p.x - minX) * s + offsetX, y: (p.y - minY) * s + offsetY })));

  const radius = (PEN_WIDTH * SUPERSAMPLE) / 2;
  const fine = new Float32Array(big * big);
  for (const stroke of segments) {
    for (let i = 0; i < stroke.length; i++) {
      const a = stroke[i];
      const b = stroke[i + 1] ?? a;
      const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - radius - 1));
      const x1 = Math.min(big - 1, Math.ceil(Math.max(a.x, b.x) + radius + 1));
      const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - radius - 1));
      const y1 = Math.min(big - 1, Math.ceil(Math.max(a.y, b.y) + radius + 1));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const coverage = Math.min(1, Math.max(0, radius + 0.5 - distanceToSegment(x + 0.5, y + 0.5, a, b)));
          if (coverage > fine[y * big + x]) fine[y * big + x] = coverage;
        }
      }
    }
  }

  const image = new Float32Array(IMAGE_SIZE * IMAGE_SIZE);
  const area = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < IMAGE_SIZE; y++) {
    for (let x = 0; x < IMAGE_SIZE; x++) {
      let sum = 0;
      for (let dy = 0; dy < SUPERSAMPLE; dy++) {
        for (let dx = 0; dx < SUPERSAMPLE; dx++) sum += fine[(y * SUPERSAMPLE + dy) * big + x * SUPERSAMPLE + dx];
      }
      image[y * IMAGE_SIZE + x] = sum / area;
    }
  }
  const max = Math.max(...image);
  return max > 0 ? image.map((v) => Math.min(1, v / max)) : null;
}

function distanceToSegment(px: number, py: number, a: InkPoint, b: InkPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSq));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/** EMNIST stores images transposed, and the model was trained on them as stored. */
export function toModelLayout(upright: Float32Array): Float32Array {
  const out = new Float32Array(upright.length);
  for (let y = 0; y < IMAGE_SIZE; y++) {
    for (let x = 0; x < IMAGE_SIZE; x++) out[x * IMAGE_SIZE + y] = upright[y * IMAGE_SIZE + x];
  }
  return out;
}

/** Mirror image (left ↔ right) of an upright image. */
export function mirror(upright: Float32Array): Float32Array {
  const out = new Float32Array(upright.length);
  for (let y = 0; y < IMAGE_SIZE; y++) {
    for (let x = 0; x < IMAGE_SIZE; x++) out[y * IMAGE_SIZE + (IMAGE_SIZE - 1 - x)] = upright[y * IMAGE_SIZE + x];
  }
  return out;
}

/** Upside-down copy (top ↔ bottom) of an upright image. */
export function flip(upright: Float32Array): Float32Array {
  const out = new Float32Array(upright.length);
  for (let y = 0; y < IMAGE_SIZE; y++) {
    out.set(upright.subarray(y * IMAGE_SIZE, (y + 1) * IMAGE_SIZE), (IMAGE_SIZE - 1 - y) * IMAGE_SIZE);
  }
  return out;
}
