import { sample, shuffle, type Rng } from '@/lib/random';
import { similarity } from '@/lib/text';
import type { SpellingError, SpellingResult } from './types';

/** Word pools for the Write Test, from easy CVC words to irregular "tricky" words. */
export const SPELLING_POOLS = {
  easy: ['bed', 'dog', 'cup', 'pig', 'bus', 'sun', 'hat', 'red', 'big', 'top'],
  medium: ['frog', 'ship', 'duck', 'desk', 'bump', 'nest', 'drum', 'chip', 'plum', 'brick'],
  hard: ['garden', 'thunder', 'dragon', 'bridge', 'planet', 'window', 'pocket', 'basket'],
  tricky: ['said', 'was', 'they', 'come', 'does', 'friend', 'people', 'could'],
} as const;

/** Irregular words that can't be sounded out, scored separately in the report. */
export const TRICKY_WORDS = new Set<string>(SPELLING_POOLS.tricky);

/** The original screening mix: 3 easy, 4 medium, 2 hard and 1 tricky word, easiest first. */
export function pickSpellingWords(rng: Rng): string[] {
  return [
    ...sample(rng, SPELLING_POOLS.easy, 3),
    ...sample(rng, SPELLING_POOLS.medium, 4),
    ...sample(rng, SPELLING_POOLS.hard, 2),
    ...shuffle(rng, SPELLING_POOLS.tricky).slice(0, 1),
  ];
}

/** Look-alike letters children commonly reverse. */
const REVERSALS: [string, string][] = [
  ['b', 'd'],
  ['p', 'q'],
  ['n', 'u'],
  ['m', 'w'],
];

const unreverse = (word: string) => REVERSALS.reduce((w, [a, b]) => w.replaceAll(b, a), word);

/** True when `written` is `target` with exactly two neighbouring letters swapped (frist → first). */
function isTransposition(target: string, written: string): boolean {
  if (target.length !== written.length) return false;
  const diffs = [...target].flatMap((c, i) => (c === written[i] ? [] : [i]));
  return diffs.length === 2 && diffs[1] === diffs[0] + 1 && target[diffs[0]] === written[diffs[1]] && target[diffs[1]] === written[diffs[0]];
}

/** Classifies spelling errors the way the original Write Test did. An empty list means correct. */
export function classifySpelling(target: string, written: string): SpellingError[] {
  const a = target.toLowerCase();
  const b = written.toLowerCase();
  if (b === '') return ['blank'];
  if (a === b) return [];
  const errors: SpellingError[] = [];
  if (unreverse(a) === unreverse(b)) errors.push('reversal');
  if (isTransposition(a, b)) errors.push('transposition');
  else if (b.length < a.length) errors.push('omission');
  else if (b.length > a.length) errors.push('insertion');
  if (errors.length === 0) errors.push('substitution');
  return errors;
}

export function scoreSpelling(word: string, written: string, seconds: number): SpellingResult {
  const clean = written.toLowerCase();
  return {
    word,
    written: clean,
    accuracy: clean ? Math.round(similarity(word, clean) * 100) / 100 : 0,
    errors: classifySpelling(word, clean),
    seconds: Math.round(seconds * 10) / 10,
  };
}

export type SpellingFlag = 'on-track' | 'monitor' | 'high-risk';

export interface SpellingSummary {
  wordsRight: number;
  wordsTotal: number;
  /** Mean similarity to the target words (0–1). */
  accuracy: number;
  /** Mean accuracy on irregular words, or null if none were tested. */
  trickyAccuracy: number | null;
  errorCounts: Record<SpellingError, number>;
  flag: SpellingFlag;
}

export function summarizeSpelling(items: SpellingResult[]): SpellingSummary {
  const errorCounts: Record<SpellingError, number> = { reversal: 0, transposition: 0, omission: 0, insertion: 0, substitution: 0, blank: 0 };
  for (const item of items) for (const e of item.errors) errorCounts[e] += 1;
  const mean = (list: SpellingResult[]) => (list.length ? list.reduce((s, i) => s + i.accuracy, 0) / list.length : 0);
  const tricky = items.filter((i) => TRICKY_WORDS.has(i.word));
  const accuracy = mean(items);
  return {
    wordsRight: items.filter((i) => i.errors.length === 0).length,
    wordsTotal: items.length,
    accuracy,
    trickyAccuracy: tricky.length ? mean(tricky) : null,
    errorCounts,
    // The original thresholds: 80% and above on track, 55% and above worth monitoring.
    flag: accuracy >= 0.8 ? 'on-track' : accuracy >= 0.55 ? 'monitor' : 'high-risk',
  };
}

/** Practice ideas for the grown-up, from the original report (English, parent-facing). */
export function spellingRecommendations(summary: SpellingSummary): string[] {
  const tips: string[] = [];
  const { errorCounts: e } = summary;
  if (e.reversal) tips.push('Mirror-letter games (b/d, p/q): Letter Sorting, Odd One Out and tracing with the bee.');
  if (e.omission) tips.push('Sound segmenting: tap a finger for each sound while writing (Sound Boxes).');
  if (e.transposition) tips.push('Syllable-by-syllable dictation to practise letter order.');
  if (e.substitution) tips.push('Multisensory spelling: see it, hear it, say it, write it, check it.');
  if (summary.trickyAccuracy !== null && summary.trickyAccuracy < 0.6) tips.push('A "heart word" wall for irregular words, practised a little every day.');
  if (tips.length === 0) tips.push('Keep up the current practice and test again in about 8 weeks.');
  return tips;
}
