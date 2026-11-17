import { GLYPH_BOX, GLYPHS } from '@/activities/trace/glyphs';
import { resample, type Point } from '@/activities/trace/geometry';

/**
 * Letter geometry for the original app's guided tracer ("Scalable Alphabet Mode").
 *
 * Capital letters use the original 100×100 SVG stroke paths unchanged. Small letters (which the original
 * didn't have, but LexiLeap's Learning Path uses from level 2) are converted from LexiLeap's handwriting
 * glyphs into the same 100×100 box, so both render and trace the same way.
 */
export const SCALABLE_LETTERS: Record<string, string[]> = {
  A: ['M 50 10 L 20 90', 'M 50 10 L 80 90', 'M 32 60 L 68 60'],
  B: ['M 20 10 L 20 90', 'M 20 10 C 90 10, 90 50, 20 50', 'M 20 50 C 95 50, 95 90, 20 90'],
  C: ['M 85 20 C 65 -5, 10 5, 10 50 C 10 95, 65 105, 85 80'],
  D: ['M 25 10 L 25 90', 'M 25 10 C 85 10, 85 90, 25 90'],
  E: ['M 25 10 L 25 90', 'M 25 10 L 75 10', 'M 25 50 L 65 50', 'M 25 90 L 75 90'],
  F: ['M 25 10 L 25 90', 'M 25 10 L 75 10', 'M 25 50 L 65 50'],
  G: ['M 85 20 C 65 -5, 10 5, 10 50 C 10 95, 65 105, 85 80 L 85 55 L 45 55'],
  H: ['M 15 10 L 15 90', 'M 85 10 L 85 90', 'M 15 50 L 85 50'],
  I: ['M 50 10 L 50 90', 'M 15 10 L 85 10', 'M 15 90 L 85 90'],
  J: ['M 25 10 L 75 10', 'M 50 10 L 50 75 C 50 100, 20 100, 20 75'],
  K: ['M 25 10 L 25 90', 'M 75 10 L 25 50', 'M 25 50 L 75 90'],
  L: ['M 25 10 L 25 90', 'M 25 90 L 75 90'],
  M: ['M 15 90 L 15 10', 'M 15 10 L 50 50', 'M 50 50 L 85 10', 'M 85 10 L 85 90'],
  N: ['M 20 90 L 20 10', 'M 20 10 L 80 90', 'M 80 90 L 80 10'],
  O: ['M 50 10 C 72 10, 90 28, 90 50 C 90 72, 72 90, 50 90 C 28 90, 10 72, 10 50 C 10 28, 28 10, 50 10'],
  P: ['M 15 10 L 15 90', 'M 15 10 C 95 10, 95 50, 15 50'],
  Q: ['M 50 10 C 72 10, 90 28, 90 50 C 90 72, 72 90, 50 90 C 28 90, 10 72, 10 50 C 10 28, 28 10, 50 10', 'M 65 70 L 95 95'],
  R: ['M 15 10 L 15 90', 'M 15 10 C 95 10, 95 50, 15 50', 'M 15 50 L 85 90'],
  S: ['M 75 25 C 75 5, 25 5, 25 30 C 25 50, 75 50, 75 70 C 75 95, 25 95, 25 75'],
  T: ['M 20 10 L 80 10', 'M 50 10 L 50 90'],
  U: ['M 25 10 L 25 70 C 25 100, 75 100, 75 70 L 75 10'],
  V: ['M 20 10 L 50 90', 'M 50 90 L 80 10'],
  W: ['M 10 10 L 30 90', 'M 30 90 L 50 40', 'M 50 40 L 70 90', 'M 70 90 L 90 10'],
  X: ['M 25 10 L 75 90', 'M 75 10 L 25 90'],
  Y: ['M 25 10 L 50 50', 'M 75 10 L 50 50', 'M 50 50 L 50 90'],
  Z: ['M 25 10 L 75 10', 'M 75 10 L 25 90', 'M 25 90 L 75 90'],
};

export const ALPHABET = Object.keys(SCALABLE_LETTERS);

/** A small letter a–z (traced with the handwriting shapes, in the original tracer's style). */
export const SMALL_ALPHABET = ALPHABET.map((l) => l.toLowerCase());

/** The letter to trace from a route parameter: a capital A–Z or a small a–z; otherwise `fallback`. */
export function traceLetterFromParam(param: unknown, fallback = 'A'): string {
  const letter = typeof param === 'string' ? param.trim() : '';
  return letter.length === 1 && (ALPHABET.includes(letter) || SMALL_ALPHABET.includes(letter)) ? letter : fallback;
}

/** The capital letter named in a route parameter, if it is one of `valid`; otherwise `fallback`. */
export function letterFromParam(param: unknown, valid: Record<string, unknown>, fallback = 'A'): string {
  const letter = typeof param === 'string' ? param.trim().toUpperCase() : '';
  return letter in valid ? letter : fallback;
}

/** The original layout was designed for a 420 × 630 pt canvas; everything scales from it. */
export const DESIGN_WIDTH = 420;
const ASPECT = 1.5;
/** Biggest canvas on large tablets, so the letter stays comfortably within arm's reach. */
const MAX_WIDTH = 720;
/** From this width (tablets, not iPad Split View) the canvas grows beyond the original phone size. */
const TABLET_WIDTH = 600;
const SAMPLES_PER_CURVE = 60;
/** Small-letter strokes are resampled to about the same density as the original's curves. */
const SMALL_LETTER_SPACING = 1.33;

export interface TracePoint {
  x: number;
  y: number;
  /** Direction of travel at this point, in degrees. */
  angle: number;
}

export interface TraceSegment {
  /** SVG path through the points. */
  d: string;
  pts: TracePoint[];
  end: TracePoint;
}

export interface TraceCanvas {
  width: number;
  height: number;
  /** Scale relative to the original design (1 on phones, larger on tablets). */
  k: number;
}

/**
 * The canvas size for the space available. Phones get the original 420-wide layout (or the screen width
 * if narrower); tablets scale the whole thing up while keeping its 2:3 shape.
 */
export function canvasFor(availableWidth: number, availableHeight: number): TraceCanvas {
  const maxWidth = availableWidth >= TABLET_WIDTH ? MAX_WIDTH : DESIGN_WIDTH;
  const width = Math.max(200, Math.floor(Math.min(availableWidth, availableHeight / ASPECT, maxWidth)));
  // On narrow phones the original kept the letter size and let it touch the edges; scale down a little instead.
  const k = width >= DESIGN_WIDTH ? width / DESIGN_WIDTH : Math.min(1, width / 380);
  return { width, height: Math.round(width * ASPECT), k };
}

/** Parses the original M / L / C path strings into sampled points in the 100×100 box. */
function sampleSvgPath(svg: string): Point[] {
  const regex = /M\s+([-\d.]+)\s+([-\d.]+)|C\s+([-\d.]+)\s+([-\d.]+),\s*([-\d.]+)\s+([-\d.]+),\s*([-\d.]+)\s+([-\d.]+)|L\s+([-\d.]+)\s+([-\d.]+)/g;
  const points: Point[] = [];
  let x = 0;
  let y = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(svg)) !== null) {
    if (match[1] !== undefined) {
      x = Number(match[1]);
      y = Number(match[2]);
      if (points.length === 0) points.push({ x, y });
    } else if (match[3] !== undefined) {
      const [c1x, c1y, c2x, c2y, ex, ey] = match.slice(3, 9).map(Number);
      for (let i = 1; i <= SAMPLES_PER_CURVE; i++) {
        const t = i / SAMPLES_PER_CURVE;
        const u = 1 - t;
        points.push({
          x: u ** 3 * x + 3 * u ** 2 * t * c1x + 3 * u * t ** 2 * c2x + t ** 3 * ex,
          y: u ** 3 * y + 3 * u ** 2 * t * c1y + 3 * u * t ** 2 * c2y + t ** 3 * ey,
        });
      }
      x = ex;
      y = ey;
    } else if (match[9] !== undefined) {
      const ex = Number(match[9]);
      const ey = Number(match[10]);
      for (let i = 1; i <= SAMPLES_PER_CURVE; i++) {
        const t = i / SAMPLES_PER_CURVE;
        points.push({ x: x + (ex - x) * t, y: y + (ey - y) * t });
      }
      x = ex;
      y = ey;
    }
  }
  return points;
}

/** A small letter's strokes, moved from the handwriting box (GLYPH_BOX) into the original 100×100 box. */
function smallLetterStrokes(glyph: string): Point[][] {
  return (GLYPHS[glyph] ?? []).map((stroke) => {
    // The handwriting box's top-to-baseline (capital height) becomes the original's 10–90.
    const mapped = stroke.map((p) => ({ x: p.x, y: 10 + ((p.y - GLYPH_BOX.top) * 80) / (GLYPH_BOX.baseline - GLYPH_BOX.top) }));
    // A dot (i, j) becomes a short tap-and-drag so it can be traced like any other stroke.
    if (mapped.length === 1) return [mapped[0], { x: mapped[0].x, y: mapped[0].y + 3 }];
    return resample(mapped, SMALL_LETTER_SPACING);
  });
}

const NARROW: Record<string, number> = { C: 0.88, G: 0.88, M: 0.88, N: 0.88, P: 0.88, O: 0.84, Q: 0.84, R: 0.84, H: 0.78, I: 0.78 };
const SHIFT_RIGHT = new Set(['C', 'P', 'R']);

/**
 * The letter's strokes in canvas coordinates, placed exactly as in the original: scaled by 4.6 (times k),
 * centred, raised by 50, with the original's per-letter narrowing and centring shifts.
 */
export function buildSegments(glyph: string, canvas: TraceCanvas): TraceSegment[] {
  const { width, height, k } = canvas;
  const scale = 4.6 * k;
  const tX = (width - 100 * scale) / 2;
  const tY = (height - 100 * scale) / 2 - 50 * k;
  const strokes = SCALABLE_LETTERS[glyph] ? SCALABLE_LETTERS[glyph].map(sampleSvgPath) : smallLetterStrokes(glyph);
  const narrow = NARROW[glyph] ?? 1;
  const shift = SHIFT_RIGHT.has(glyph) ? 18 * k : 0;

  return strokes
    .filter((stroke) => stroke.length > 0)
    .map((stroke) => {
      const pts: TracePoint[] = stroke.map((p) => {
        const x = p.x * scale + tX;
        return { x: width / 2 + (x - width / 2) * narrow + shift, y: p.y * scale + tY, angle: 0 };
      });
      for (let i = 0; i < pts.length - 1; i++) {
        pts[i].angle = (Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x) * 180) / Math.PI;
      }
      if (pts.length > 1) pts[pts.length - 1].angle = pts[pts.length - 2].angle;
      const d = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
      return { d, pts, end: pts[pts.length - 1] };
    });
}

/** Index of the path point nearest to `p`, and the squared distance to it. */
export function nearestIndex(pts: TracePoint[], p: { x: number; y: number }): { index: number; dist2: number } {
  let index = 0;
  let dist2 = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = (pts[i].x - p.x) ** 2 + (pts[i].y - p.y) ** 2;
    if (d < dist2) {
      dist2 = d;
      index = i;
    }
  }
  return { index, dist2 };
}

/** Finger distance from the path (in original units) that still counts as on track. */
export const TOLERANCE = 35;

export interface SegmentProgress {
  /** Furthest point reached along the path. */
  index: number;
  /** Path points the finger has passed close to. */
  visited: boolean[];
  moves: number;
  offTrackMoves: number;
}

export const startProgress = (segment: TraceSegment): SegmentProgress => ({ index: 0, visited: segment.pts.map(() => false), moves: 0, offTrackMoves: 0 });

/**
 * One finger movement along a segment, with the original's rules: the finger must stay within the
 * tolerance; progress moves forward at most 40 points at a time and may step back a little; a closed
 * shape (O, Q) completes when the finger comes back round to the start.
 */
export function moveAlong(segment: TraceSegment, progress: SegmentProgress, p: { x: number; y: number }, k: number): { progress: SegmentProgress; onTrack: boolean } {
  const tolerance = TOLERANCE * k;
  const { index, dist2 } = nearestIndex(segment.pts, p);
  const moves = progress.moves + 1;
  if (dist2 > tolerance * tolerance) return { progress: { ...progress, moves, offTrackMoves: progress.offTrackMoves + 1 }, onTrack: false };
  const last = segment.pts.length - 1;
  let next = progress.index;
  if (progress.index > segment.pts.length - 30 && index < 20) next = last;
  else if (index <= progress.index + 40) next = Math.max(progress.index - 15, index);
  const visited = progress.visited.slice();
  for (let i = 0; i < segment.pts.length; i++) {
    if (!visited[i] && (segment.pts[i].x - p.x) ** 2 + (segment.pts[i].y - p.y) ** 2 <= tolerance * tolerance) visited[i] = true;
  }
  return { progress: { index: Math.max(0, next), visited, moves, offTrackMoves: progress.offTrackMoves }, onTrack: true };
}

export const isSegmentDone = (segment: TraceSegment, progress: SegmentProgress) => progress.index >= segment.pts.length - 2;

/**
 * How neatly a segment was traced, 0.1–1: the share of the path the finger actually passed over, less a
 * penalty for time spent off the path. (The original scored by the furthest point reached, which is
 * always 100% once a segment is finished.)
 */
export function segmentScore(progress: SegmentProgress): number {
  const covered = progress.visited.filter(Boolean).length / Math.max(1, progress.visited.length);
  const offTrack = progress.moves > 0 ? progress.offTrackMoves / progress.moves : 0;
  return Math.max(0.1, Math.min(1, covered - 0.5 * offTrack));
}
