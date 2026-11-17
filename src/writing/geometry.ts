import type { GuidelinePoint, IdealPathData, PathSegment, Point } from './types';

export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

export function bezierPoint(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const mt = 1 - t;
  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
  };
}

function perpendicularNormal(a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

function sampleSegment(segment: PathSegment, samples: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    if (segment.type === 'bezier' && segment.control1 && segment.control2) {
      points.push(bezierPoint(t, segment.start, segment.control1, segment.control2, segment.end));
    } else {
      points.push({ x: segment.start.x + t * (segment.end.x - segment.start.x), y: segment.start.y + t * (segment.end.y - segment.start.y) });
    }
  }
  return points;
}

/** The letter's ideal path: evenly sampled points for every stroke, with where each stroke starts. */
export function generateIdealPath(strokes: PathSegment[][], samplesPerSegment = 30): IdealPathData {
  const points: GuidelinePoint[] = [];
  const strokeBoundaries = [0];
  let totalLength = 0;
  for (const stroke of strokes) {
    for (const segment of stroke) {
      const sampled = sampleSegment(segment, samplesPerSegment);
      sampled.forEach((p, i) => {
        const prev = sampled[Math.max(0, i - 1)];
        const next = sampled[Math.min(sampled.length - 1, i + 1)];
        const normal = perpendicularNormal(prev === p ? p : prev, next === p ? p : next);
        points.push({ x: p.x, y: p.y, index: points.length, normalX: normal.x, normalY: normal.y });
        if (i > 0) totalLength += distance(sampled[i - 1], p);
      });
    }
    strokeBoundaries.push(points.length);
  }
  return { points, totalLength, strokeBoundaries };
}

export function svgPath(points: Point[]): string {
  if (points.length === 0) return '';
  return `M ${points[0].x} ${points[0].y}` + points.slice(1).map((p) => ` L ${p.x} ${p.y}`).join('');
}
