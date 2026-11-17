/**
 * Round generators for every activity. Pure functions of (level, rng, progress) so they
 * can be unit-tested and so every round is guaranteed to be answerable.
 */
import { EASY_PAIRS, LETTER_EXAMPLES, LOOKALIKES, LOWERCASE, MIRROR_PAIRS, UPPERCASE, WORD_PAIRS, lookalikesOf } from '@/content/letters';
import { SOUND_WORDS } from '@/content/phonemes';
import { RHYME_FAMILIES } from '@/content/rhymes';
import { SYLLABLE_WORDS } from '@/content/syllables';
import { pictureFor, SIGHT_WORDS, SPEAKING_WORDS, SPELLING_WORDS } from '@/content/words';
import type { Level, ProgressState } from '@/engine/types';
import { pick, randomInt, sample, sampleCycling, shuffle, type Rng } from '@/lib/random';
import { similarity } from '@/lib/text';

// ── Tracing ──────────────────────────────────────────────────────────────────

export interface TraceRound {
  glyph: string;
  /** Faded guide: only the start dot is clearly shown. */
  faded: boolean;
}

export function generateTraceRounds(level: Level, rng: Rng, progress: ProgressState, count: number, focus?: string): TraceRound[] {
  if (focus) {
    // A child-chosen letter: twice with full guidance, then once from memory.
    return [
      { glyph: focus, faded: false },
      { glyph: focus, faded: false },
      { glyph: focus, faded: true },
    ];
  }
  const pool = level === 1 ? UPPERCASE : level === 2 ? LOWERCASE : [...UPPERCASE, ...LOWERCASE];
  const ranked = pool
    .map((glyph) => {
      const p = progress.letters[glyph];
      const priority = (p ? 1 - p.best : 1.5) + rng() * 0.6;
      return { glyph, priority };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, count);
  return shuffle(rng, ranked).map(({ glyph }) => ({ glyph, faded: level === 3 }));
}

// ── Sound Match ──────────────────────────────────────────────────────────────

export interface SoundMatchRound {
  mode: 'name' | 'first-sound';
  target: string;
  word?: string;
  emoji?: string;
  options: string[];
}

/** Letters that are NOT easily confused with `letter` (for gentle levels). */
function distinctFrom(letter: string): string[] {
  const avoid = new Set([letter, ...lookalikesOf(letter)]);
  return LOWERCASE.filter((l) => !avoid.has(l) && !(LOOKALIKES[l] ?? []).includes(letter));
}

export function generateSoundMatchRounds(level: Level, rng: Rng, count: number): SoundMatchRound[] {
  if (level === 1) {
    return sampleCycling(rng, LOWERCASE, count).map((target) => ({
      mode: 'name',
      target,
      options: shuffle(rng, [target, ...sample(rng, distinctFrom(target), 2)]),
    }));
  }
  return sampleCycling(rng, LETTER_EXAMPLES, count).map(({ letter, word, emoji }) => {
    let distractors: string[];
    if (level === 3) {
      const tricky = sample(rng, lookalikesOf(letter), 2);
      const others = sample(
        rng,
        LOWERCASE.filter((l) => l !== letter && !tricky.includes(l)),
        3 - tricky.length,
      );
      distractors = [...tricky, ...others];
    } else {
      distractors = sample(rng, distinctFrom(letter), 3);
    }
    return { mode: 'first-sound', target: letter, word, emoji, options: shuffle(rng, [letter, ...distractors]) };
  });
}

// ── Say It ───────────────────────────────────────────────────────────────────

export interface SayItRound {
  word: string;
  emoji: string;
}

export function generateSayItRounds(level: Level, rng: Rng, count: number): SayItRound[] {
  return sampleCycling(rng, SPEAKING_WORDS[level], count).map((word) => ({ word, emoji: pictureFor(word) }));
}

/** The original app's confusion pairs (Spot It and Letter Sorting). */
export const SORT_PAIRS: [string, string][] = [
  ['b', 'd'],
  ['p', 'q'],
  ['m', 'w'],
  ['n', 'u'],
];

// ── Odd One Out ──────────────────────────────────────────────────────────────

export interface OddOneOutRound {
  cells: string[];
  oddIndex: number;
  columns: number;
}

/** Parses a "b|d" focus into a known confusion pair, or null. */
export function parseFocusPair(focus: string | undefined): [string, string] | null {
  if (!focus) return null;
  const [a, b] = focus.split('|');
  return SORT_PAIRS.find(([x, y]) => (x === a && y === b) || (x === b && y === a)) ?? null;
}

export function generateOddOneOutRounds(level: Level, rng: Rng, count: number, focus?: [string, string] | null): OddOneOutRound[] {
  return Array.from({ length: count }, (_, i) => {
    let pair: [string, string];
    let columns: number;
    let size: number;
    if (focus) {
      // A chosen pair: grid size still grows with the level.
      pair = focus;
      columns = level + 2;
      size = columns * columns;
    } else if (level === 1) {
      pair = pick(rng, EASY_PAIRS);
      columns = 3;
      size = 9;
    } else if (level === 2) {
      pair = pick(rng, MIRROR_PAIRS);
      columns = 4;
      size = 16;
    } else if (i % 2 === 1) {
      pair = pick(rng, WORD_PAIRS);
      columns = 3;
      size = 12;
    } else {
      pair = pick(rng, MIRROR_PAIRS);
      columns = 5;
      size = 25;
    }
    const [common, odd] = rng() < 0.5 ? pair : ([pair[1], pair[0]] as [string, string]);
    const oddIndex = randomInt(rng, size);
    const cells = Array.from({ length: size }, (_, c) => (c === oddIndex ? odd : common));
    return { cells, oddIndex, columns };
  });
}

// ── Letter Hunt ──────────────────────────────────────────────────────────────

export interface LetterHuntRound {
  target: string;
  cells: string[];
  columns: number;
}

const HUNT_TARGETS = ['b', 'd', 'p', 'q', 'm', 'n', 'u', 'f', 't', 's', 'g', 'h'];

export function generateLetterHuntRounds(level: Level, rng: Rng, count: number): LetterHuntRound[] {
  const config = {
    1: { columns: 4, size: 16, targets: 4, trickyShare: 0 },
    2: { columns: 5, size: 25, targets: 5, trickyShare: 0.5 },
    3: { columns: 6, size: 36, targets: 7, trickyShare: 0.8 },
  }[level];
  return sampleCycling(rng, HUNT_TARGETS, count).map((target) => {
    const tricky = lookalikesOf(target);
    const plain = distinctFrom(target);
    const fillers = config.size - config.targets;
    const cells = [
      ...Array.from({ length: config.targets }, () => target),
      ...Array.from({ length: fillers }, () =>
        tricky.length > 0 && rng() < config.trickyShare ? pick(rng, tricky) : pick(rng, plain),
      ),
    ];
    return { target, cells: shuffle(rng, cells), columns: config.columns };
  });
}

// ── Memory Lights ────────────────────────────────────────────────────────────

export interface MemoryRound {
  pad: string[];
  sequence: string[];
}

export function generateMemoryRounds(level: Level, rng: Rng, count: number): MemoryRound[] {
  const span = level + 2; // 3, 4, 5
  const padSize = level === 1 ? 4 : 6;
  return Array.from({ length: count }, () => {
    let pad: string[];
    if (level === 3) {
      // Include a look-alike pair to make visual memory matter.
      const [a, b] = pick(rng, MIRROR_PAIRS);
      const rest = sample(rng, LOWERCASE.filter((l) => l !== a && l !== b), padSize - 2);
      pad = shuffle(rng, [a, b, ...rest]);
    } else {
      pad = sample(rng, LOWERCASE.filter((l) => !['b', 'd', 'p', 'q'].includes(l)), padSize);
    }
    return { pad, sequence: sample(rng, pad, span) };
  });
}

// ── Rhyme Time ───────────────────────────────────────────────────────────────

export interface RhymeRound {
  target: string;
  answer: string;
  options: string[];
}

export function generateRhymeRounds(level: Level, rng: Rng, count: number): RhymeRound[] {
  const optionCount = level + 1; // 2, 3, 4
  return sampleCycling(rng, RHYME_FAMILIES, count).map((family) => {
    const [target, answer] = sample(rng, family, 2);
    const otherWords = RHYME_FAMILIES.filter((f) => f !== family).flat();
    let distractors: string[];
    if (level === 3) {
      // Sound-alikes: same first letter as the target but a different ending.
      const sameStart = otherWords.filter((w) => w[0] === target[0]);
      const tricky = sample(rng, sameStart, 1);
      distractors = [...tricky, ...sample(rng, otherWords.filter((w) => !tricky.includes(w)), optionCount - 1 - tricky.length)];
    } else {
      distractors = sample(rng, otherWords, optionCount - 1);
    }
    return { target, answer, options: shuffle(rng, [answer, ...distractors]) };
  });
}

// ── Rhyme Train ──────────────────────────────────────────────────────────────

export interface RhymeTrainRound {
  /** The word on the engine. */
  engine: string;
  /** Every carriage word that rhymes with it. */
  answers: string[];
  /** All carriage words, in the order shown. */
  options: string[];
}

/**
 * Load the train: find every carriage that rhymes with the engine's word.
 * Level 1: 2 rhymes among 4 carriages. Level 2: 2–3 rhymes among 5. Level 3: among 6, with
 * sound-alikes that start like the engine word but don't rhyme.
 */
export function generateRhymeTrainRounds(level: Level, rng: Rng, count: number): RhymeTrainRound[] {
  const families = RHYME_FAMILIES.filter((f) => f.length >= 3);
  const total = { 1: 4, 2: 5, 3: 6 }[level];
  return sampleCycling(rng, families, count).map((family) => {
    const rhymeCount = level === 1 ? 2 : Math.min(family.length - 1, 3);
    const [engine, ...rest] = sample(rng, family, family.length);
    const answers = rest.slice(0, rhymeCount);
    const others = RHYME_FAMILIES.filter((f) => f !== family).flat();
    const tricky = level === 3 ? sample(rng, others.filter((w) => w[0] === engine[0]), 2) : [];
    const distractors = [...tricky, ...sample(rng, others.filter((w) => !tricky.includes(w)), total - answers.length - tricky.length)];
    return { engine, answers, options: shuffle(rng, [...answers, ...distractors]) };
  });
}

// ── Voice Vault ──────────────────────────────────────────────────────────────

export interface VoiceVaultRound {
  word: string;
  /** Picture words that rhyme with it, offered as hints and shown when revealed. */
  rhymes: string[];
}

/** Say a rhyme out loud. Level 1 uses the biggest rhyme families (easiest to find a rhyme for). */
export function generateVoiceVaultRounds(level: Level, rng: Rng, count: number): VoiceVaultRound[] {
  const minSize = { 1: 3, 2: 2, 3: 2 }[level];
  const pool = RHYME_FAMILIES.filter((f) => f.length >= minSize);
  return sampleCycling(rng, pool, count).map((family) => {
    const [word] = sample(rng, family, 1);
    return { word, rhymes: family.filter((w) => w !== word) };
  });
}

// ── Clap the Beats ───────────────────────────────────────────────────────────

export interface SyllableRound {
  word: string;
  beats: number;
}

export function generateSyllableRounds(level: Level, rng: Rng, count: number): SyllableRound[] {
  const range = { 1: [1, 2], 2: [1, 3], 3: [2, 4] }[level];
  const pool = SYLLABLE_WORDS.filter((w) => w.beats >= range[0] && w.beats <= range[1]);
  return sampleCycling(rng, pool, count).map(({ word, beats }) => ({ word, beats }));
}

// ── Sound Boxes ──────────────────────────────────────────────────────────────

export interface SoundBoxRound {
  word: string;
  /** The word's sounds, spelled: ship → sh, i, p. */
  sounds: string[];
}

export function generateSoundBoxRounds(level: Level, rng: Rng, count: number): SoundBoxRound[] {
  const words = Object.entries(SOUND_WORDS[level]);
  return sampleCycling(rng, words, count).map(([word, sounds]) => ({ word, sounds }));
}

// ── Word Ninja ───────────────────────────────────────────────────────────────

/** One Word Ninja round: three floating words, one of which is the target. */
export interface NinjaRound {
  target: string;
  words: string[];
}

/** Words that look most like `word`: same letters reversed, similar spelling, same start. */
export function similarWords(word: string, pool: string[], count: number, rng: Rng): string[] {
  const reversed = word.split('').reverse().join('');
  return pool
    .filter((w) => w !== word)
    .map((w) => ({
      w,
      score: (w === reversed ? 2 : 0) + similarity(w, word) + (w[0] === word[0] ? 0.2 : 0) + rng() * 0.15,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ w }) => w);
}

/**
 * As in the original game, distractors don't share the target's first letter, which keeps
 * fast-moving words from overloading young readers. At the top level one distractor is a
 * deliberate look-alike (was/saw) to train careful reading.
 */
export function generateNinjaRounds(level: Level, rng: Rng, count: number): NinjaRound[] {
  const words = SIGHT_WORDS[level];
  const allWords = [...new Set([...SIGHT_WORDS[1], ...SIGHT_WORDS[2], ...SIGHT_WORDS[3]])];
  return sampleCycling(rng, words, count).map((target) => {
    const differentStart = words.filter((w) => w !== target && w[0] !== target[0]);
    const lookalike = level === 3 ? similarWords(target, allWords, 1, rng) : [];
    const rest = sample(rng, differentStart.filter((w) => !lookalike.includes(w)), 2 - lookalike.length);
    return { target, words: shuffle(rng, [target, ...lookalike, ...rest]) };
  });
}

// ── Letter Sorting ───────────────────────────────────────────────────────────

/** One letter to feed to the right monster. `left`/`right` say which monster eats which letter. */
export interface SortRound {
  letter: string;
  left: string;
  right: string;
}

export function generateSortRounds(level: Level, rng: Rng, count: number, focus?: [string, string] | null): SortRound[] {
  const pair = focus ?? (level === 1 ? SORT_PAIRS[0] : pick(rng, SORT_PAIRS));
  const rounds: SortRound[] = [];
  for (let i = 0; i < count; i++) {
    // Never more than two of the same letter in a row, so guessing a pattern doesn't work.
    const lastTwo = rounds.slice(-2).map((r) => r.letter);
    const letter = lastTwo.length === 2 && lastTwo[0] === lastTwo[1] ? pair.find((l) => l !== lastTwo[0])! : pick(rng, pair);
    const swap = level === 3 && rng() < 0.5;
    rounds.push({ letter, left: swap ? pair[1] : pair[0], right: swap ? pair[0] : pair[1] });
  }
  return rounds;
}

// ── Word Builder ─────────────────────────────────────────────────────────────

export interface WordBuilderRound {
  word: string;
  emoji: string;
  tiles: string[];
}

export function generateWordBuilderRounds(level: Level, rng: Rng, count: number): WordBuilderRound[] {
  const extraCount = level === 1 ? 1 : 2;
  return sampleCycling(rng, SPELLING_WORDS[level], count).map((word) => {
    const letters = word.split('');
    const tricky = [...new Set(letters.flatMap(lookalikesOf))].filter((l) => !letters.includes(l));
    const extras = sample(rng, tricky.length >= extraCount ? tricky : LOWERCASE.filter((l) => !letters.includes(l)), extraCount);
    let tiles = shuffle(rng, [...letters, ...extras]);
    // Never hand the child the answer already in order.
    for (let tries = 0; tiles.slice(0, letters.length).join('') === word && tries < 10; tries++) {
      tiles = shuffle(rng, tiles);
    }
    return { word, emoji: pictureFor(word), tiles };
  });
}
