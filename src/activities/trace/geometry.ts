export interface Point {
  x: number;
  y: number;
}

export const line = (x1: number, y1: number, x2: number, y2: number): Point[] => [
  { x: x1, y: y1 },
  { x: x2, y: y2 },
];

/**
 * Points along an elliptical arc. Angles are in degrees in screen space:
 * 0 = right, 90 = down, 180 = left, -90 (or 270) = up. Going from start to end
 * with end < start draws anticlockwise on screen; end > start draws clockwise.
 */
export function arc(cx: number, cy: number, rx: number, ry: number, startDeg: number, endDeg: number): Point[] {
  const steps = Math.max(2, Math.ceil(Math.abs(endDeg - startDeg) / 6));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const deg = startDeg + ((endDeg - startDeg) * i) / steps;
    const rad = (deg * Math.PI) / 180;
    return { x: cx + rx * Math.cos(rad), y: cy + ry * Math.sin(rad) };
  });
}

export const dot = (x: number, y: number): Point[] => [{ x, y }];

/** Joins consecutive segments into one stroke, dropping duplicated join points. */
export function join(...segments: Point[][]): Point[] {
  const out: Point[] = [];
  for (const seg of segments) {
    for (const p of seg) {
      const last = out[out.length - 1];
      if (!last || distance(last, p) > 0.01) out.push(p);
    }
  }
  return out;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export function distanceToPolyline(p: Point, points: Point[]): number {
  if (points.length === 1) return distance(p, points[0]);
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    best = Math.min(best, distanceToSegment(p, points[i - 1], points[i]));
  }
  return best;
}

export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

/** Evenly spaced points along a polyline, always including both ends. */
export function resample(points: Point[], spacing: number): Point[] {
  if (points.length <= 1) return [...points];
  const total = polylineLength(points);
  const count = Math.max(1, Math.round(total / spacing));
  const step = total / count;
  const out: Point[] = [points[0]];
  let segIndex = 1;
  let segStart = points[0];
  let travelled = 0; // distance along the polyline at segStart
  for (let n = 1; n < count; n++) {
    const target = n * step;
    while (segIndex < points.length) {
      const segLen = distance(segStart, points[segIndex]);
      if (travelled + segLen >= target) {
        const t = segLen === 0 ? 0 : (target - travelled) / segLen;
        const end = points[segIndex];
        out.push({ x: segStart.x + (end.x - segStart.x) * t, y: segStart.y + (end.y - segStart.y) * t });
        break;
      }
      travelled += segLen;
      segStart = points[segIndex];
      segIndex++;
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

export function toSvgPath(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  const fmt = (n: number) => Math.round(n * 10) / 10;
  return `M${fmt(first.x)} ${fmt(first.y)}` + rest.map((p) => ` L${fmt(p.x)} ${fmt(p.y)}`).join('');
}
