/**
 * Face detection in plain TypeScript: OpenCV's frontal-face Haar cascade (Viola–Jones), the detector the
 * original app's `fer` package uses by default. It lets the Focus helper find faces where Google ML Kit
 * isn't available (Expo Go) or fails. The cascade is exported by scripts/export-face-cascade.py and a
 * test checks the detections against OpenCV's own. Licence: assets/models/OPENCV-LICENSE.txt.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Feature {
  /** [x, y, w, h, weight] per rectangle, in window coordinates. */
  rects: number[][];
}

interface Stump {
  feature: number;
  threshold: number;
  left: number;
  right: number;
}

interface Stage {
  threshold: number;
  stumps: Stump[];
}

export interface FaceCascade {
  width: number;
  height: number;
  stages: Stage[];
  features: Feature[];
}

const MAGIC = 'LXHC';
const VERSION = 1;

/** Reads the cascade file; throws if it's not the expected format. */
export function parseCascade(buffer: ArrayBuffer): FaceCascade {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== MAGIC || view.getUint32(4, true) !== VERSION) throw new Error('Unknown face cascade format');
  const width = view.getUint16(8, true);
  const height = view.getUint16(10, true);
  const stageCount = view.getUint16(12, true);
  const featureCount = view.getUint16(14, true);
  let o = 16;
  const features: Feature[] = [];
  for (let f = 0; f < featureCount; f++) {
    const n = view.getUint8(o);
    o += 1;
    const rects: number[][] = [];
    for (let r = 0; r < n; r++) {
      rects.push([view.getUint8(o), view.getUint8(o + 1), view.getUint8(o + 2), view.getUint8(o + 3), view.getFloat32(o + 4, true)]);
      o += 8;
    }
    features.push({ rects });
  }
  const stages: Stage[] = [];
  for (let s = 0; s < stageCount; s++) {
    const n = view.getUint16(o, true);
    const threshold = view.getFloat32(o + 2, true);
    o += 6;
    const stumps: Stump[] = [];
    for (let i = 0; i < n; i++) {
      stumps.push({ feature: view.getUint16(o, true), threshold: view.getFloat32(o + 2, true), left: view.getFloat32(o + 6, true), right: view.getFloat32(o + 10, true) });
      o += 14;
    }
    stages.push({ threshold, stumps });
  }
  if (o !== buffer.byteLength) throw new Error('Face cascade file has unexpected size');
  return { width, height, stages, features };
}

/** Bilinear resize of a grayscale image (pixel centres aligned, as OpenCV's INTER_LINEAR). */
export function resizeGray(src: ArrayLike<number>, w: number, h: number, nw: number, nh: number): Float32Array {
  const out = new Float32Array(nw * nh);
  const sx = w / nw;
  const sy = h / nh;
  for (let y = 0; y < nh; y++) {
    const fy = Math.min(h - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(h - 1, y0 + 1);
    const ay = fy - y0;
    for (let x = 0; x < nw; x++) {
      const fx = Math.min(w - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(w - 1, x0 + 1);
      const ax = fx - x0;
      const top = src[y0 * w + x0] * (1 - ax) + src[y0 * w + x1] * ax;
      const bottom = src[y1 * w + x0] * (1 - ax) + src[y1 * w + x1] * ax;
      out[y * nw + x] = top * (1 - ay) + bottom * ay;
    }
  }
  return out;
}

/** Summed-area tables of the image and of its squares, (w+1) × (h+1). */
function integrals(img: Float32Array, w: number, h: number) {
  const W = w + 1;
  const sum = new Float64Array(W * (h + 1));
  const sq = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    let rowSq = 0;
    for (let x = 0; x < w; x++) {
      const v = Math.round(img[y * w + x]);
      row += v;
      rowSq += v * v;
      sum[(y + 1) * W + x + 1] = sum[y * W + x + 1] + row;
      sq[(y + 1) * W + x + 1] = sq[y * W + x + 1] + rowSq;
    }
  }
  return { sum, sq, W };
}

export interface DetectOptions {
  scaleFactor?: number;
  minNeighbors?: number;
  /** Smallest face, in pixels. */
  minSize?: number;
}

/**
 * Finds faces in a grayscale image (0–255, row-major), like OpenCV's detectMultiScale: the image is
 * shrunk step by step and a 24×24 window slides over each size; overlapping hits are grouped.
 */
export function detectFaces(gray: ArrayLike<number>, w: number, h: number, cascade: FaceCascade, { scaleFactor = 1.2, minNeighbors = 3, minSize = 30 }: DetectOptions = {}): Rect[] {
  const { width: ww, height: wh, stages, features } = cascade;
  const area = (ww - 2) * (wh - 2);
  const hits: Rect[] = [];
  for (let factor = 1; w / factor >= ww && h / factor >= wh; factor *= scaleFactor) {
    if (ww * factor < minSize) continue;
    const sw = Math.round(w / factor);
    const sh = Math.round(h / factor);
    const { sum, sq, W } = integrals(resizeGray(gray, w, h, sw, sh), sw, sh);
    const rs = (t: Float64Array, x: number, y: number, rw: number, rh: number) => t[(y + rh) * W + x + rw] - t[y * W + x + rw] - t[(y + rh) * W + x] + t[y * W + x];
    const step = factor > 2 ? 1 : 2;
    for (let y = 0; y + wh <= sh; y += step) {
      for (let x = 0; x + ww <= sw; x += step) {
        const s = rs(sum, x + 1, y + 1, ww - 2, wh - 2);
        const q = rs(sq, x + 1, y + 1, ww - 2, wh - 2);
        const v = area * q - s * s;
        const norm = v > 0 ? 1 / Math.sqrt(v) : 1;
        let face = true;
        for (const stage of stages) {
          let total = 0;
          for (const stump of stage.stumps) {
            let value = 0;
            for (const r of features[stump.feature].rects) value += r[4] * rs(sum, x + r[0], y + r[1], r[2], r[3]);
            total += value * norm < stump.threshold ? stump.left : stump.right;
          }
          if (total < stage.threshold) {
            face = false;
            break;
          }
        }
        if (face) hits.push({ x: Math.round(x * factor), y: Math.round(y * factor), width: Math.round(ww * factor), height: Math.round(wh * factor) });
      }
    }
  }
  return groupRectangles(hits, minNeighbors, 0.2);
}

/** OpenCV's groupRectangles: clusters of similar boxes with more than `threshold` members become one box. */
export function groupRectangles(rects: Rect[], threshold: number, eps: number): Rect[] {
  if (threshold <= 0 || rects.length === 0) return rects;
  // Union–find over "similar" boxes.
  const parent = rects.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const similar = (a: Rect, b: Rect) => {
    const delta = eps * (Math.min(a.width, b.width) + Math.min(a.height, b.height)) * 0.5;
    return (
      Math.abs(a.x - b.x) <= delta &&
      Math.abs(a.y - b.y) <= delta &&
      Math.abs(a.x + a.width - b.x - b.width) <= delta &&
      Math.abs(a.y + a.height - b.y - b.height) <= delta
    );
  };
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (similar(rects[i], rects[j])) parent[find(i)] = find(j);
  const clusters = new Map<number, { x: number; y: number; width: number; height: number; n: number }>();
  rects.forEach((r, i) => {
    const c = clusters.get(find(i)) ?? { x: 0, y: 0, width: 0, height: 0, n: 0 };
    clusters.set(find(i), { x: c.x + r.x, y: c.y + r.y, width: c.width + r.width, height: c.height + r.height, n: c.n + 1 });
  });
  const groups = [...clusters.values()].map((c) => ({
    rect: { x: Math.round(c.x / c.n), y: Math.round(c.y / c.n), width: Math.round(c.width / c.n), height: Math.round(c.height / c.n) },
    n: c.n,
  }));
  // Keep strong groups, dropping any that sit inside a stronger one.
  return groups
    .filter((g, i) => {
      if (g.n <= threshold) return false;
      const dx = Math.round(g.rect.width * eps);
      const dy = Math.round(g.rect.height * eps);
      return !groups.some((o, j) => {
        if (j === i || o.n <= threshold) return false;
        const r1 = g.rect;
        const r2 = o.rect;
        const inside = r1.x >= r2.x - dx && r1.y >= r2.y - dy && r1.x + r1.width <= r2.x + r2.width + dx && r1.y + r1.height <= r2.y + r2.height + dy;
        return inside && (o.n > Math.max(3, g.n) || g.n < 3);
      });
    })
    .map((g) => g.rect);
}

/** The biggest face found (the child closest to the screen), or null. */
export function largestFace(faces: Rect[]): Rect | null {
  return faces.reduce<Rect | null>((best, f) => (!best || f.width * f.height > best.width * best.height ? f : best), null);
}
