import { classifySpelling, pickSpellingWords, scoreSpelling, SPELLING_POOLS, spellingRecommendations, summarizeSpelling, TRICKY_WORDS } from '@/engine/spelling';
import { createRng } from '@/lib/random';

describe('spelling test', () => {
  it('picks the original screening mix, easiest first, with no repeats', () => {
    const words = pickSpellingWords(createRng(3));
    expect(words).toHaveLength(10);
    expect(new Set(words).size).toBe(10);
    expect(words.slice(0, 3).every((w) => (SPELLING_POOLS.easy as readonly string[]).includes(w))).toBe(true);
    expect(TRICKY_WORDS.has(words[9])).toBe(true);
  });

  it.each([
    ['dog', 'dog', []],
    ['dog', '', ['blank']],
    ['bed', 'deb', ['reversal']],
    ['dog', 'bog', ['reversal']],
    ['frog', 'from', ['substitution']],
    ['ship', 'sihp', ['transposition']],
    ['plant', 'plat', ['omission']],
    ['cup', 'cupp', ['insertion']],
    ['pocket', 'qocket', ['reversal']],
  ] as const)('classifies %s written as "%s"', (target, written, errors) => {
    expect(classifySpelling(target, written)).toEqual(errors);
  });

  it('scores similarity and summarises with the original thresholds', () => {
    expect(scoreSpelling('dog', 'DOG', 4.04)).toEqual({ word: 'dog', written: 'dog', accuracy: 1, errors: [], seconds: 4 });
    expect(scoreSpelling('frog', 'fog', 3).accuracy).toBe(0.75);
    expect(scoreSpelling('frog', '', 3).accuracy).toBe(0);

    const items = [scoreSpelling('dog', 'dog', 2), scoreSpelling('bed', 'deb', 3), scoreSpelling('said', 'sed', 5)];
    const summary = summarizeSpelling(items);
    expect(summary.wordsRight).toBe(1);
    expect(summary.errorCounts.reversal).toBe(1);
    expect(summary.trickyAccuracy).toBe(0.5);
    expect(summary.flag).toBe('monitor');
    expect(spellingRecommendations(summary).join(' ')).toMatch(/Mirror-letter/);
    expect(summarizeSpelling([scoreSpelling('dog', 'dog', 1)]).flag).toBe('on-track');
    expect(summarizeSpelling([scoreSpelling('dog', 'xyz', 1)]).flag).toBe('high-risk');
  });
});
