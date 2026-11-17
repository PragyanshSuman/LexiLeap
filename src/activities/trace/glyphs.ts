import { arc, dot, join, line, type Point } from './geometry';

/**
 * Stroke paths for every letter, in standard handwriting order and direction.
 *
 * Coordinate box: x 0–100, y 0–130 (y grows downward).
 *   Capital letters: top y=10, baseline y=100.
 *   Small letters:   x-height y=50, ascenders from y=10, descenders down to y=125.
 */
export const GLYPH_BOX = { width: 100, height: 130, top: 10, midline: 50, baseline: 100, descender: 125 };

type Glyph = Point[][];

// A circle for a, d, g, q: starts at "2 o'clock" and goes anticlockwise, the way it's taught.
const smallCircle = () => arc(50, 75, 25, 25, -30, -390);

const UPPER: Record<string, Glyph> = {
  A: [line(50, 10, 15, 100), line(50, 10, 85, 100), line(28, 66, 72, 66)],
  B: [
    line(22, 10, 22, 100),
    join(line(22, 10, 55, 10), arc(55, 32.5, 22, 22.5, -90, 90), line(55, 55, 22, 55)),
    join(line(22, 55, 60, 55), arc(60, 77.5, 24, 22.5, -90, 90), line(60, 100, 22, 100)),
  ],
  C: [arc(56, 55, 38, 45, -40, -320)],
  D: [line(22, 10, 22, 100), join(line(22, 10, 42, 10), arc(42, 55, 40, 45, -90, 90), line(42, 100, 22, 100))],
  E: [line(25, 10, 25, 100), line(25, 10, 80, 10), line(25, 55, 70, 55), line(25, 100, 80, 100)],
  F: [line(25, 10, 25, 100), line(25, 10, 80, 10), line(25, 55, 70, 55)],
  G: [join(arc(55, 55, 38, 45, -40, -360), line(93, 55, 62, 55))],
  H: [line(20, 10, 20, 100), line(80, 10, 80, 100), line(20, 55, 80, 55)],
  I: [line(50, 10, 50, 100), line(28, 10, 72, 10), line(28, 100, 72, 100)],
  J: [line(45, 10, 85, 10), join(line(65, 10, 65, 75), arc(45, 75, 20, 25, 0, 180))],
  K: [line(25, 10, 25, 100), line(78, 10, 25, 62), line(42, 46, 80, 100)],
  L: [join(line(25, 10, 25, 100), line(25, 100, 78, 100))],
  M: [line(15, 10, 15, 100), join(line(15, 10, 50, 72), line(50, 72, 85, 10), line(85, 10, 85, 100))],
  N: [line(20, 10, 20, 100), join(line(20, 10, 80, 100), line(80, 100, 80, 10))],
  O: [arc(50, 55, 38, 45, -90, -450)],
  P: [line(22, 10, 22, 100), join(line(22, 10, 55, 10), arc(55, 32.5, 25, 22.5, -90, 90), line(55, 55, 22, 55))],
  Q: [arc(50, 55, 38, 45, -90, -450), line(60, 76, 88, 106)],
  R: [
    line(22, 10, 22, 100),
    join(line(22, 10, 55, 10), arc(55, 32.5, 25, 22.5, -90, 90), line(55, 55, 22, 55)),
    line(48, 55, 82, 100),
  ],
  S: [join(arc(50, 32.5, 30, 22.5, -30, -270), arc(50, 77.5, 30, 22.5, -90, 160))],
  T: [line(15, 10, 85, 10), line(50, 10, 50, 100)],
  U: [join(line(20, 10, 20, 70), arc(50, 70, 30, 30, 180, 0), line(80, 70, 80, 10))],
  V: [join(line(15, 10, 50, 100), line(50, 100, 85, 10))],
  W: [join(line(8, 10, 29, 100), line(29, 100, 50, 40), line(50, 40, 71, 100), line(71, 100, 92, 10))],
  X: [line(20, 10, 80, 100), line(80, 10, 20, 100)],
  Y: [join(line(20, 10, 50, 55), line(50, 55, 50, 100)), line(80, 10, 50, 55)],
  Z: [join(line(20, 10, 80, 10), line(80, 10, 20, 100), line(20, 100, 80, 100))],
};

const LOWER: Record<string, Glyph> = {
  a: [smallCircle(), line(75, 50, 75, 100)],
  b: [line(25, 10, 25, 100), arc(50, 75, 25, 25, 180, 540)],
  c: [arc(52, 75, 25, 25, -40, -320)],
  d: [smallCircle(), line(75, 10, 75, 100)],
  e: [join(line(26, 75, 75, 75), arc(50, 75, 25, 25, 0, -320))],
  f: [join(arc(64, 25, 14, 15, -20, -180), line(50, 25, 50, 100)), line(34, 50, 68, 50)],
  g: [smallCircle(), join(line(75, 50, 75, 110), arc(52, 110, 23, 15, 0, 160))],
  h: [line(25, 10, 25, 100), join(arc(50, 75, 25, 25, 180, 360), line(75, 75, 75, 100))],
  i: [line(50, 50, 50, 100), dot(50, 33)],
  j: [join(line(56, 50, 56, 110), arc(41, 110, 15, 15, 0, 160)), dot(56, 33)],
  k: [line(25, 10, 25, 100), line(70, 50, 25, 80), line(40, 70, 72, 100)],
  l: [line(50, 10, 50, 100)],
  m: [
    line(15, 50, 15, 100),
    join(arc(32.5, 67.5, 17.5, 17.5, 180, 360), line(50, 67.5, 50, 100)),
    join(arc(67.5, 67.5, 17.5, 17.5, 180, 360), line(85, 67.5, 85, 100)),
  ],
  n: [line(25, 50, 25, 100), join(arc(50, 75, 25, 25, 180, 360), line(75, 75, 75, 100))],
  o: [arc(50, 75, 25, 25, -90, -450)],
  p: [line(25, 50, 25, 125), arc(50, 75, 25, 25, 180, 540)],
  q: [smallCircle(), line(75, 50, 75, 125)],
  r: [line(30, 50, 30, 100), arc(55, 70, 25, 20, 180, 315)],
  s: [join(arc(50, 62.5, 20, 12.5, -30, -270), arc(50, 87.5, 20, 12.5, -90, 160))],
  t: [join(line(50, 20, 50, 90), arc(62, 90, 12, 10, 180, 30)), line(32, 50, 68, 50)],
  u: [join(line(25, 50, 25, 75), arc(50, 75, 25, 25, 180, 0)), line(75, 50, 75, 100)],
  v: [join(line(25, 50, 50, 100), line(50, 100, 75, 50))],
  w: [join(line(12, 50, 31, 100), line(31, 100, 50, 62), line(50, 62, 69, 100), line(69, 100, 88, 50))],
  x: [line(27, 50, 73, 100), line(73, 50, 27, 100)],
  y: [line(27, 50, 52, 96), line(75, 50, 35, 125)],
  z: [join(line(27, 50, 73, 50), line(73, 50, 27, 100), line(27, 100, 73, 100))],
};

export const GLYPHS: Record<string, Glyph> = { ...UPPER, ...LOWER };

export function glyphStrokes(glyph: string): Glyph {
  const strokes = GLYPHS[glyph];
  if (!strokes) throw new Error(`No tracing path for "${glyph}"`);
  return strokes;
}

export function isLowercase(glyph: string): boolean {
  return glyph !== glyph.toUpperCase();
}
