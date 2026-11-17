import {
  generateLetterHuntRounds,
  generateMemoryRounds,
  generateOddOneOutRounds,
  generateRhymeRounds,
  generateSayItRounds,
  generateNinjaRounds,
  parseFocusPair,
  generateSortRounds,
  generateSoundBoxRounds,
  generateSoundMatchRounds,
  generateSyllableRounds,
  generateTraceRounds,
  generateWordBuilderRounds,
} from '@/activities/generators';
import { GLYPHS } from '@/activities/trace/glyphs';
import { lookalikesOf } from '@/content/letters';
import { rhymesWith } from '@/content/rhymes';
import { emptyProgress } from '@/engine/progress';
import type { Level } from '@/engine/types';
import { createRng } from '@/lib/random';

const LEVELS: Level[] = [1, 2, 3];
const SEEDS = [1, 7, 42, 99, 2026];
const cases = LEVELS.flatMap((level) => SEEDS.map((seed) => [level, seed] as const));

const unique = (items: string[]) => new Set(items).size === items.length;

describe('generators', () => {
  it.each(cases)('trace rounds use real glyphs (level %i, seed %i)', (level, seed) => {
    const rounds = generateTraceRounds(level, createRng(seed), emptyProgress(), 5);
    expect(rounds).toHaveLength(5);
    expect(unique(rounds.map((r) => r.glyph))).toBe(true);
    rounds.forEach((r) => expect(GLYPHS[r.glyph]).toBeDefined());
    if (level === 1) rounds.forEach((r) => expect(r.glyph).toBe(r.glyph.toUpperCase()));
    if (level === 2) rounds.forEach((r) => expect(r.glyph).toBe(r.glyph.toLowerCase()));
    rounds.forEach((r) => expect(r.faded).toBe(level === 3));
  });

  it('trace prioritises letters the child has not mastered', () => {
    const progress = emptyProgress();
    for (const l of 'ABCDEFGHIJKLMNOPQRSTUVW') progress.letters[l] = { attempts: 3, best: 1, last: 1 };
    const rounds = generateTraceRounds(1, createRng(3), progress, 3);
    expect(rounds.map((r) => r.glyph).sort()).toEqual(['X', 'Y', 'Z']);
  });

  it.each(cases)('sound match always includes the answer once (level %i, seed %i)', (level, seed) => {
    const rounds = generateSoundMatchRounds(level, createRng(seed), 12);
    for (const r of rounds) {
      expect(r.options.filter((o) => o === r.target)).toHaveLength(1);
      expect(unique(r.options)).toBe(true);
      expect(r.options).toHaveLength(level === 1 ? 3 : 4);
      if (level < 3) r.options.filter((o) => o !== r.target).forEach((o) => expect(lookalikesOf(r.target)).not.toContain(o));
      if (r.mode === 'first-sound') expect(r.word?.[0]).toBe(r.target);
    }
  });

  it.each(cases)('say it words have pictures (level %i, seed %i)', (level, seed) => {
    generateSayItRounds(level, createRng(seed), 8).forEach((r) => expect(r.emoji).not.toBe(''));
  });

  it.each(cases)('odd one out has exactly one different cell (level %i, seed %i)', (level, seed) => {
    for (const r of generateOddOneOutRounds(level, createRng(seed), 8)) {
      const odd = r.cells[r.oddIndex];
      expect(r.cells.filter((c) => c === odd)).toHaveLength(1);
      expect(new Set(r.cells).size).toBe(2);
      expect(r.cells.length % r.columns).toBe(0);
    }
  });

  it.each(cases)('letter hunt hides the right number of targets (level %i, seed %i)', (level, seed) => {
    const expected = { 1: 4, 2: 5, 3: 7 }[level];
    for (const r of generateLetterHuntRounds(level, createRng(seed), 3)) {
      expect(r.cells.filter((c) => c === r.target)).toHaveLength(expected);
      expect(r.cells.length % r.columns).toBe(0);
    }
  });

  it.each(cases)('memory sequences come from the pad without repeats (level %i, seed %i)', (level, seed) => {
    for (const r of generateMemoryRounds(level, createRng(seed), 5)) {
      expect(r.sequence).toHaveLength(level + 2);
      expect(unique(r.sequence)).toBe(true);
      expect(unique(r.pad)).toBe(true);
      r.sequence.forEach((l) => expect(r.pad).toContain(l));
    }
  });

  it.each(cases)('rhyme rounds have exactly one rhyming option (level %i, seed %i)', (level, seed) => {
    for (const r of generateRhymeRounds(level, createRng(seed), 10)) {
      expect(r.options).toHaveLength(level + 1);
      expect(unique(r.options)).toBe(true);
      expect(r.options.filter((o) => rhymesWith(r.target, o))).toEqual([r.answer]);
      expect(r.options).not.toContain(r.target);
    }
  });

  it.each(cases)('syllable rounds stay within the level range (level %i, seed %i)', (level, seed) => {
    const [min, max] = { 1: [1, 2], 2: [1, 3], 3: [2, 4] }[level];
    for (const r of generateSyllableRounds(level, createRng(seed), 8)) {
      expect(r.beats).toBeGreaterThanOrEqual(min);
      expect(r.beats).toBeLessThanOrEqual(max);
    }
  });

  it.each(cases)('sound boxes stay within the level range (level %i, seed %i)', (level, seed) => {
    const [min, max] = { 1: [2, 3], 2: [3, 4], 3: [4, 5] }[level];
    for (const r of generateSoundBoxRounds(level, createRng(seed), 8)) {
      expect(r.sounds.join('')).toBe(r.word);
      expect(r.sounds.length).toBeGreaterThanOrEqual(min);
      expect(r.sounds.length).toBeLessThanOrEqual(max);
    }
  });

  it.each(cases)('word ninja floats the target with two different words (level %i, seed %i)', (level, seed) => {
    for (const r of generateNinjaRounds(level, createRng(seed), 10)) {
      expect(r.words).toHaveLength(3);
      expect(unique(r.words)).toBe(true);
      expect(r.words.filter((w) => w === r.target)).toHaveLength(1);
      // Below the top level, distractors never share the target's first letter.
      if (level < 3) r.words.filter((w) => w !== r.target).forEach((w) => expect(w[0]).not.toBe(r.target[0]));
    }
  });

  it.each(cases)('letter sorting uses one confusable pair without long streaks (level %i, seed %i)', (level, seed) => {
    const rounds = generateSortRounds(level, createRng(seed), 12);
    const pair = new Set([rounds[0].left, rounds[0].right]);
    expect(pair.size).toBe(2);
    if (level === 1) expect([...pair].sort()).toEqual(['b', 'd']);
    rounds.forEach((r, i) => {
      expect(new Set([r.left, r.right])).toEqual(pair);
      expect([r.left, r.right]).toContain(r.letter);
      if (i >= 2) expect(r.letter === rounds[i - 1].letter && r.letter === rounds[i - 2].letter).toBe(false);
      if (level < 3) expect(r.left).toBe(rounds[0].left);
    });
  });

  it.each(cases)('word builder tiles can spell the word (level %i, seed %i)', (level, seed) => {
    for (const r of generateWordBuilderRounds(level, createRng(seed), 8)) {
      const remaining = [...r.tiles];
      for (const letter of r.word) {
        const i = remaining.indexOf(letter);
        expect(i).toBeGreaterThanOrEqual(0);
        remaining.splice(i, 1);
      }
      expect(remaining).toHaveLength(level === 1 ? 1 : 2);
      expect(r.tiles.slice(0, r.word.length).join('')).not.toBe(r.word);
      expect(r.emoji).not.toBe('');
    }
  });

  it('uses a pair chosen on the Spot It dashboard, and ignores unknown pairs', () => {
    expect(parseFocusPair('q|p')).toEqual(['p', 'q']);
    expect(parseFocusPair('a|z')).toBeNull();
    expect(parseFocusPair(undefined)).toBeNull();
    for (const level of LEVELS) {
      for (const r of generateOddOneOutRounds(level, createRng(level), 6, ['m', 'w'])) {
        expect(new Set(r.cells)).toEqual(new Set(['m', 'w']));
        expect(r.columns).toBe(level + 2);
      }
      for (const r of generateSortRounds(level, createRng(level), 6, ['n', 'u'])) expect(['n', 'u']).toContain(r.letter);
    }
  });
});
