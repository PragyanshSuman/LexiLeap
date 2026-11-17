import { readFileSync } from 'fs';
import { join } from 'path';
import { parseModel, runModel, type HandwritingModel } from '@/handwriting/model';
import { flip, mirror, rasterize, toModelLayout, type InkStroke } from '@/handwriting/raster';
import { CLASSES, checkLetter, readLetter } from '@/handwriting/recognize';

const root = join(__dirname, '..', '..');
const file = readFileSync(join(root, 'assets', 'models', 'handwriting.bin'));
const model: HandwritingModel = parseModel(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
const vectors: { label: number; pixels: number[]; logits: number[]; orientation: number[]; risk: number }[] = JSON.parse(
  readFileSync(join(root, 'jest', 'handwritingVectors.json'), 'utf8'),
);

/** A polyline through the given points, densely sampled like a finger on a screen. */
function line(...points: [number, number][]): InkStroke {
  const out: InkStroke = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    for (let t = 0; t < 1; t += 0.05) out.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t });
  }
  const [lx, ly] = points[points.length - 1];
  out.push({ x: lx, y: ly });
  return out;
}

function arc(cx: number, cy: number, r: number, from: number, to: number): InkStroke {
  const out: InkStroke = [];
  for (let a = from; a <= to; a += 0.1) out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  return out;
}

// Child-sized letters drawn on a 300×300 canvas (y points down).
const LETTERS: Record<string, InkStroke[]> = {
  L: [line([90, 40], [90, 260], [220, 260])],
  T: [line([60, 50], [240, 50]), line([150, 50], [150, 260])],
  E: [line([210, 40], [90, 40], [90, 260], [210, 260]), line([90, 150], [190, 150])],
  H: [line([80, 40], [80, 260]), line([220, 40], [220, 260]), line([80, 150], [220, 150])],
  O: [arc(150, 150, 100, 0, Math.PI * 2 + 0.1)],
  b: [line([100, 30], [100, 260]), arc(150, 200, 55, -Math.PI, Math.PI + 0.1)],
};

describe('handwriting model', () => {
  it('matches the Python reference outputs', () => {
    for (const v of vectors) {
      const out = runModel(model, Float32Array.from(v.pixels, (p) => p / 255));
      out.logits.forEach((value, i) => expect(value).toBeCloseTo(v.logits[i], 2));
      out.orientation.forEach((value, i) => expect(value).toBeCloseTo(v.orientation[i], 2));
      expect(out.risk).toBeCloseTo(v.risk, 3);
      expect(CLASSES[out.logits.indexOf(Math.max(...out.logits))]).toBe(CLASSES[v.logits.indexOf(Math.max(...v.logits))]);
    }
  });

  it('rejects a file in the wrong format', () => {
    expect(() => parseModel(new ArrayBuffer(16))).toThrow();
  });
});

describe('rasterizing strokes', () => {
  it('crops and centres the letter in the EMNIST frame', () => {
    const small = rasterize([line([10, 10], [10, 40])])!;
    const big = rasterize([line([100, 100], [100, 400])])!;
    expect(Array.from(small)).toEqual(Array.from(big));
    const column = (img: Float32Array, x: number) => Array.from({ length: 28 }, (_, y) => img[y * 28 + x]);
    expect(Math.max(...column(small, 14))).toBe(1);
    expect(Math.max(...column(small, 2))).toBe(0);
  });

  it('returns null for an empty canvas and handles a single tap', () => {
    expect(rasterize([])).toBeNull();
    expect(rasterize([[{ x: 5, y: 5 }]])).not.toBeNull();
  });

  it('transposes, mirrors and flips images', () => {
    const img = new Float32Array(28 * 28);
    img[1] = 1; // row 0, column 1
    expect(toModelLayout(img)[28]).toBe(1);
    expect(mirror(img)[26]).toBe(1);
    expect(flip(img)[27 * 28 + 1]).toBe(1);
  });
});

describe('reading letters', () => {
  it.each(Object.keys(LETTERS))('recognises a drawn %s', (letter) => {
    const check = checkLetter(model, LETTERS[letter], letter)!;
    expect(check.read.toLowerCase()).toBe(letter.toLowerCase());
    expect(check.reversal).toBeNull();
  });

  it('spots a mirrored letter (b written as d)', () => {
    const d = LETTERS.b.map((stroke) => stroke.map((p) => ({ x: 300 - p.x, y: p.y })));
    const check = checkLetter(model, d, 'b')!;
    expect(check.correct).toBe(false);
    expect(check.reversal).toBe('mirrored');
  });

  it('merges capital and small forms when case does not matter', () => {
    const reading = readLetter(model, LETTERS.O, { caseless: true })!;
    expect(reading.guesses[0].letter).toBe('o');
    expect(reading.guesses.every((g) => g.letter === g.letter.toLowerCase())).toBe(true);
  });
});
