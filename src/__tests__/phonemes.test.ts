import { alignPhonemes, PHONEMES, ruleBasedPhonemes, soundOf, spellingChunks } from '@/speech/phonemes';

describe('phoneme alignment', () => {
  it('marks a perfect match', () => {
    const a = alignPhonemes(['SH', 'IH', 'P'], ['SH', 'IH', 'P']);
    expect(a.score).toBe(1);
    expect(a.sounds.every((s) => s.status === 'correct')).toBe(true);
  });

  it('finds a swapped sound (tree for three)', () => {
    const a = alignPhonemes(['TH', 'R', 'IY'], ['T', 'R', 'IY']);
    expect(a.sounds).toEqual([
      { phoneme: 'TH', status: 'changed', heard: 'T' },
      { phoneme: 'R', status: 'correct' },
      { phoneme: 'IY', status: 'correct' },
    ]);
    expect(a.score).toBeCloseTo(2 / 3);
  });

  it('finds a missed sound and an extra one', () => {
    const missed = alignPhonemes(['F', 'R', 'AA', 'G'], ['F', 'AA', 'G']);
    expect(missed.sounds.map((s) => s.status)).toEqual(['correct', 'missed', 'correct', 'correct']);
    const extra = alignPhonemes(['K', 'AE', 'T'], ['K', 'AE', 'T', 'S']);
    expect(extra.extra).toEqual(['S']);
    expect(extra.sounds.every((s) => s.status === 'correct')).toBe(true);
  });

  it('handles empty input', () => {
    expect(alignPhonemes(['K', 'AE', 'T'], []).sounds.every((s) => s.status === 'missed')).toBe(true);
    expect(alignPhonemes([], []).score).toBe(1);
  });
});

describe('spelling chunks', () => {
  const chunks = (word: string, phones: string) => spellingChunks(word, phones.split(' '))?.map((c) => c.letters);

  it('groups digraphs, trigraphs and doubled letters', () => {
    expect(chunks('ship', 'SH IH P')).toEqual(['sh', 'i', 'p']);
    expect(chunks('night', 'N AY T')).toEqual(['n', 'igh', 't']);
    expect(chunks('bell', 'B EH L')).toEqual(['b', 'e', 'll']);
    expect(chunks('duck', 'D AH K')).toEqual(['d', 'u', 'ck']);
    expect(chunks('three', 'TH R IY')).toEqual(['th', 'r', 'ee']);
  });

  it('keeps silent letters attached (magic e, kn)', () => {
    expect(chunks('cake', 'K EY K')).toEqual(['c', 'a', 'ke']);
    expect(chunks('knee', 'N IY')).toEqual(['kn', 'ee']);
  });

  it('spells every letter exactly once', () => {
    for (const [word, phones] of [['elephant', 'EH L AH F AH N T'], ['rainbow', 'R EY N B OW'], ['station', 'S T EY SH AH N']] as const) {
      expect(chunks(word, phones)?.join('')).toBe(word);
    }
  });

  it('returns null when the spelling cannot be explained', () => {
    expect(spellingChunks('xyz', ['B'])).toBeNull();
  });
});

describe('rule-based fallback', () => {
  it('reads regular words sensibly', () => {
    expect(ruleBasedPhonemes('ship')).toEqual(['SH', 'IH', 'P']);
    expect(ruleBasedPhonemes('kite')).toEqual(['K', 'AY', 'T']);
    expect(ruleBasedPhonemes('bell')).toEqual(['B', 'EH', 'L']);
    expect(ruleBasedPhonemes('night')).toEqual(['N', 'AY', 'T']);
  });

  it('has a child-friendly name for every phoneme', () => {
    Object.values(PHONEMES).forEach((p) => expect(p.sound.length).toBeGreaterThan(0));
    expect(soundOf('TH')).toEqual({ sound: 'th', example: 'three', vowel: false });
  });
});
