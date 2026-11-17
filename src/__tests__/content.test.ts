import { areLookalikes, LETTER_EXAMPLES, LOOKALIKES, LOWERCASE } from '@/content/letters';
import { SOUND_COUNT_RANGE, SOUND_WORDS } from '@/content/phonemes';
import type { Level } from '@/engine/types';
import { createBackupData, parseBackup } from '@/store/backupFormat';
import { emptyProgress } from '@/engine/progress';
import { DEFAULT_PREFS } from '@/store/profile';
import { RHYME_FAMILIES } from '@/content/rhymes';
import { SYLLABLE_SPLITS, SYLLABLE_WORDS } from '@/content/syllables';
import { PICTURES, SIGHT_WORDS, SPEAKING_WORDS, SPELLING_WORDS } from '@/content/words';
import { matchSpokenWord } from '@/services/speechMatch';

describe('content integrity', () => {
  it('has a picture for every picture-based word', () => {
    const words = [
      ...RHYME_FAMILIES.flat(),
      ...SYLLABLE_WORDS.map((w) => w.word),
      ...Object.values(SPELLING_WORDS).flat(),
      ...Object.values(SPEAKING_WORDS).flat(),
      ...Object.values(SOUND_WORDS).flatMap((level) => Object.keys(level)),
    ];
    const missing = words.filter((w) => !PICTURES[w]);
    expect(missing).toEqual([]);
  });

  it('never repeats a word across rhyme families', () => {
    const all = RHYME_FAMILIES.flat();
    expect(new Set(all).size).toBe(all.length);
    RHYME_FAMILIES.forEach((f) => expect(f.length).toBeGreaterThanOrEqual(2));
  });

  it('splits multi-beat words into the right number of beats', () => {
    for (const { word, beats } of SYLLABLE_WORDS) {
      if (beats > 1) {
        expect(SYLLABLE_SPLITS[word]).toHaveLength(beats);
        expect(SYLLABLE_SPLITS[word].join('')).toBe(word);
      }
    }
  });

  it('uses lower-case letters with a matching example word', () => {
    for (const { letter, word } of LETTER_EXAMPLES) expect(word[0]).toBe(letter);
    for (const [letter, similar] of Object.entries(LOOKALIKES)) {
      expect(LOWERCASE).toContain(letter);
      similar.forEach((s) => expect(LOWERCASE).toContain(s));
      expect(similar).not.toContain(letter);
    }
  });

  it('splits sound-box words into sounds that spell the word, within the level range', () => {
    for (const [level, words] of Object.entries(SOUND_WORDS)) {
      const [min, max] = SOUND_COUNT_RANGE[Number(level) as Level];
      expect(Object.keys(words).length).toBeGreaterThanOrEqual(10);
      for (const [word, sounds] of Object.entries(words)) {
        expect(sounds.join('')).toBe(word);
        expect(sounds.length).toBeGreaterThanOrEqual(min);
        expect(sounds.length).toBeLessThanOrEqual(max);
      }
    }
  });

  it('has enough distinct words per level', () => {
    for (const list of [...Object.values(SIGHT_WORDS), ...Object.values(SPELLING_WORDS), ...Object.values(SPEAKING_WORDS)]) {
      expect(new Set(list).size).toBe(list.length);
      expect(list.length).toBeGreaterThanOrEqual(10);
    }
    for (const [level, list] of Object.entries(SPELLING_WORDS)) {
      list.forEach((w) => expect(w.length).toBe(Number(level) + 2));
    }
  });
});

describe('speech matching', () => {
  it('accepts the word inside a longer phrase and common recogniser alternates', () => {
    expect(matchSpokenWord('frog', ['a frog']).match).toBe('exact');
    expect(matchSpokenWord('sun', ['son']).match).toBe('exact');
    expect(matchSpokenWord('Butterfly', ['butter fly']).match).toBe('exact');
  });

  it('gives partial credit for near misses and rejects other words', () => {
    expect(matchSpokenWord('elephant', ['elefant']).match).toBe('close');
    expect(matchSpokenWord('pig', ['big']).match).toBe('none');
    expect(matchSpokenWord('cat', []).match).toBe('none');
  });
});

describe('look-alikes', () => {
  it('recognises mirror letters, reversals and look-alike swaps only', () => {
    expect(areLookalikes('b', 'd')).toBe(true);
    expect(areLookalikes('was', 'saw')).toBe(true);
    expect(areLookalikes('bad', 'dad')).toBe(true);
    expect(areLookalikes('b', 'b')).toBe(false);
    expect(areLookalikes('cat', 'hat')).toBe(false);
    expect(areLookalikes('o', 'x')).toBe(false);
    expect(areLookalikes('on', 'one')).toBe(false);
  });
});

describe('backups', () => {
  const profile = { id: 'k1', name: 'Ada', avatar: '🦊', age: 7, createdAt: '2026-01-01T00:00:00.000Z', prefs: { ...DEFAULT_PREFS } };

  it('round-trips children and progress without the parent PIN', () => {
    const progress = { k1: { ...emptyProgress(), stars: 42 } };
    const text = JSON.stringify(createBackupData([profile], progress));
    expect(text).not.toContain('pinHash');
    const restored = parseBackup(text);
    expect(restored.profiles).toEqual([profile]);
    expect(restored.progress.k1.stars).toBe(42);
  });

  it('fills in fields missing from older backups', () => {
    const old = { app: 'lexileap', version: 1, profiles: [{ id: 'k1', name: 'Ada', prefs: { font: 'atkinson' } }], progress: { k1: { stars: 3 } } };
    const restored = parseBackup(JSON.stringify(old));
    expect(restored.profiles[0].prefs).toEqual({ ...DEFAULT_PREFS, font: 'atkinson' });
    expect(restored.progress.k1).toEqual({ ...emptyProgress(), stars: 3 });
  });

  it('rejects files that are not LexiLeap backups, or from a newer version', () => {
    expect(() => parseBackup('not json')).toThrow("isn't a LexiLeap backup");
    expect(() => parseBackup(JSON.stringify({ app: 'other', profiles: [] }))).toThrow("isn't a LexiLeap backup");
    expect(() => parseBackup(JSON.stringify({ app: 'lexileap', version: 99, profiles: [profile] }))).toThrow('newer version');
    expect(() => parseBackup(JSON.stringify({ app: 'lexileap', version: 1, profiles: [] }))).toThrow('no children');
  });
});
