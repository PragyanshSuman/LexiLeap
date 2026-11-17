import { scoreSpokenWord, SPEECH_TEST_WORDS, summarizeResults } from '@/engine/assessment';
import { PICTURES } from '@/content/words';

describe('speech assessment', () => {
  it('uses distinct words', () => {
    expect(new Set(SPEECH_TEST_WORDS).size).toBe(SPEECH_TEST_WORDS.length);
    expect(SPEECH_TEST_WORDS.length).toBeGreaterThanOrEqual(15);
    // Not required, but most test words have a picture for younger children.
    expect(SPEECH_TEST_WORDS.filter((w) => PICTURES[w]).length).toBeGreaterThan(10);
  });

  it('scores a spoken word sound by sound', () => {
    const right = scoreSpokenWord('ship', ['SH', 'IH', 'P'], ['SH', 'IH', 'P'], 'ship');
    expect(right).toEqual({ word: 'ship', score: 1, correct: true, heard: 'ship', missed: [], changed: [] });
    const swap = scoreSpokenWord('three', ['TH', 'R', 'IY'], ['F', 'R', 'IY'], 'free');
    expect(swap.correct).toBe(false);
    expect(swap.changed).toEqual([['TH', 'F']]);
    const close = scoreSpokenWord('elephant', ['EH', 'L', 'AH', 'F', 'AH', 'N', 'T'], ['EH', 'L', 'AH', 'F', 'AH', 'N'], 'elephan');
    expect(close.correct).toBe(true);
    expect(close.missed).toEqual(['T']);
  });

  it('summarises tricky sounds and common swaps', () => {
    const items = [
      scoreSpokenWord('three', ['TH', 'R', 'IY'], ['F', 'R', 'IY']),
      scoreSpokenWord('thumb', ['TH', 'AH', 'M'], ['F', 'AH', 'M']),
      scoreSpokenWord('cat', ['K', 'AE', 'T'], ['K', 'AE', 'T']),
      { word: 'dog', score: null, correct: true, missed: [], changed: [] },
    ];
    const summary = summarizeResults(items);
    expect(summary.wordsRight).toBe(2);
    expect(summary.wordsTotal).toBe(4);
    expect(summary.trickySounds[0]).toEqual({ phoneme: 'TH', count: 2 });
    expect(summary.substitutions[0]).toEqual({ target: 'TH', heard: 'F', count: 2 });
    expect(summary.soundAccuracy).toBeCloseTo((2 / 3 + 2 / 3 + 1) / 3);
  });

  it('has no sound accuracy when an adult marked every word', () => {
    expect(summarizeResults([{ word: 'cat', score: null, correct: true, missed: [], changed: [] }]).soundAccuracy).toBeNull();
  });
});
