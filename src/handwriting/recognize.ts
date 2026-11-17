import { runModel, softmax, type HandwritingModel } from './model';
import { flip, mirror, rasterize, toModelLayout, type InkStroke } from './raster';

/** The model's 62 classes, in EMNIST ByClass order. */
export const CLASSES = [
  ...'0123456789',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'abcdefghijklmnopqrstuvwxyz',
];
const FIRST_LETTER = 10;

/** Letters whose capital and small forms have the same shape, so only size tells them apart. */
const SAME_SHAPE = new Set([...'cklmopsuvwxyz']);
/**
 * Readings that also count for a letter because the model can't tell them apart in finger-drawn letters:
 * capital I and small l are both one straight line, and a small f is nearly always read as F.
 */
const LOOK_ALIKE: Record<string, string> = { I: 'l', l: 'I', f: 'F' };

export type Reversal = 'mirrored' | 'upside-down' | 'rotated';

export interface LetterGuess {
  letter: string;
  probability: number;
}

export interface LetterReading {
  /** Most likely letters, best first. */
  guesses: LetterGuess[];
  /** The model's own sense that the letter was drawn reversed (0–1). */
  reversedLikelihood: number;
  /** Dyslexia-risk score from the model's risk head (0–1). */
  risk: number;
}

/** Reads one handwritten letter. `caseless` merges capital and small forms (for spelling). */
export function readLetter(model: HandwritingModel, strokes: InkStroke[], { caseless = false } = {}): LetterReading | null {
  const image = rasterize(strokes);
  if (!image) return null;
  return readImage(model, image, caseless);
}

function readImage(model: HandwritingModel, upright: Float32Array, caseless: boolean): LetterReading {
  const output = runModel(model, toModelLayout(upright));
  const probabilities = softmax(output.logits.subarray(FIRST_LETTER));
  const byLetter = new Map<string, number>();
  probabilities.forEach((p, i) => {
    const letter = caseless ? CLASSES[FIRST_LETTER + i].toLowerCase() : CLASSES[FIRST_LETTER + i];
    byLetter.set(letter, (byLetter.get(letter) ?? 0) + p);
  });
  const guesses = [...byLetter].map(([letter, probability]) => ({ letter, probability })).sort((a, b) => b.probability - a.probability);
  return { guesses: guesses.slice(0, 5), reversedLikelihood: softmax(output.orientation)[1], risk: output.risk };
}

export interface LetterCheck {
  target: string;
  /** What the model read. */
  read: string;
  correct: boolean;
  /** How sure the model is that this is the target letter (0–1). */
  confidence: number;
  /** Set when the letter was written mirrored or upside down. */
  reversal: Reversal | null;
  /** When reversed: how sure the model is that the turned copy is the target letter (0–1); else 0. */
  reversalConfidence: number;
  /** The model's best readings of the letter as written, best first. */
  guesses: LetterGuess[];
}

/** Same letter, allowing capital/small mix-ups where the two look the same. */
function matches(read: string, target: string): boolean {
  return read === target || LOOK_ALIKE[target] === read || (SAME_SHAPE.has(target.toLowerCase()) && read.toLowerCase() === target.toLowerCase());
}

/** How sure the model is that `reading` is the target letter, counting look-alike capital/small forms. */
const targetProbability = (reading: LetterReading, target: string) =>
  reading.guesses.filter((g) => matches(g.letter, target)).reduce((sum, g) => sum + g.probability, 0);

/**
 * A turned copy counts as the intended letter when the model is at least this sure of it, and this much
 * surer than of the letter as written. Chosen with scripts/evaluate-handwriting.py (see
 * docs/HANDWRITING_METRICS.md), balancing reversals caught against false alarms on normal letters.
 */
const REVERSAL_FLOOR = 0.25;
const REVERSAL_MARGIN = 0.25;

const TURNS: [(image: Float32Array) => Float32Array, Reversal][] = [
  [mirror, 'mirrored'],
  [flip, 'upside-down'],
  [(image) => mirror(flip(image)), 'rotated'],
];

/**
 * Checks a handwritten letter against the one asked for, like the original Writing Challenge, and spots
 * reversals: if the mirrored, upside-down or turned-round copy looks clearly more like the target than
 * the letter as written (b written as d, a backwards S or J), the letter was reversed. This also catches
 * reversals the model still reads as the right letter.
 */
export function checkLetter(model: HandwritingModel, strokes: InkStroke[], target: string): LetterCheck | null {
  const image = rasterize(strokes);
  if (!image) return null;
  const reading = readImage(model, image, false);
  const best = reading.guesses[0];
  const confidence = targetProbability(reading, target);
  let reversal: Reversal | null = null;
  let strongestReversal = 0;
  // When the letter is already this clearly right, no turned copy can beat it by the margin: skip the work.
  if (confidence < 1 - REVERSAL_MARGIN) {
    let strongest = Math.max(REVERSAL_FLOOR, confidence + REVERSAL_MARGIN);
    for (const [turn, kind] of TURNS) {
      const p = targetProbability(readImage(model, turn(image), false), target);
      if (p > strongest) {
        strongest = p;
        strongestReversal = p;
        reversal = kind;
      }
    }
  }
  return {
    target,
    read: best.letter,
    correct: matches(best.letter, target) && reversal === null,
    confidence,
    reversal,
    reversalConfidence: reversal ? strongestReversal : 0,
    guesses: reading.guesses,
  };
}
