import { alignPhonemes } from '@/speech/phonemes';
import type { SoundResult } from './types';

/** Words for the speech test: everyday, picture-able words covering every English sound. */
export const SPEECH_TEST_WORDS = [
  'cat', 'dog', 'sun', 'fish', 'ship', 'chair', 'three', 'feather', 'jump', 'van',
  'zebra', 'yellow', 'ring', 'lamp', 'rabbit', 'whale', 'goat', 'bread', 'spoon', 'treasure',
];

/** A spoken word counts as right when at least this share of its sounds match. */
export const WORD_PASS = 0.75;

/** Compares the sounds of what was heard with the target's sounds. */
export function scoreSpokenWord(word: string, target: string[], heardSounds: string[], heardText?: string): SoundResult {
  const alignment = alignPhonemes(target, heardSounds);
  return {
    word,
    score: Math.round(alignment.score * 100) / 100,
    correct: alignment.score >= WORD_PASS,
    heard: heardText,
    missed: alignment.sounds.filter((s) => s.status === 'missed').map((s) => s.phoneme),
    changed: alignment.sounds.filter((s) => s.status === 'changed').map((s) => [s.phoneme, s.heard!] as [string, string]),
  };
}

export interface AssessmentSummary {
  wordsRight: number;
  wordsTotal: number;
  /** Mean share of sounds right across scored words, or null if marked by an adult. */
  soundAccuracy: number | null;
  /** Sounds most often missed or changed, most frequent first. */
  trickySounds: { phoneme: string; count: number }[];
  /** Most common swaps, e.g. TH said as F. */
  substitutions: { target: string; heard: string; count: number }[];
}

export function summarizeResults(items: SoundResult[]): AssessmentSummary {
  const scored = items.filter((i) => i.score !== null);
  const tricky = new Map<string, number>();
  const swaps = new Map<string, number>();
  for (const item of items) {
    for (const p of item.missed) tricky.set(p, (tricky.get(p) ?? 0) + 1);
    for (const [target, heard] of item.changed) {
      tricky.set(target, (tricky.get(target) ?? 0) + 1);
      const key = `${target}>${heard}`;
      swaps.set(key, (swaps.get(key) ?? 0) + 1);
    }
  }
  return {
    wordsRight: items.filter((i) => i.correct).length,
    wordsTotal: items.length,
    soundAccuracy: scored.length ? scored.reduce((sum, i) => sum + (i.score ?? 0), 0) / scored.length : null,
    trickySounds: [...tricky].map(([phoneme, count]) => ({ phoneme, count })).sort((a, b) => b.count - a.count),
    substitutions: [...swaps]
      .map(([key, count]) => {
        const [target, heard] = key.split('>');
        return { target, heard, count };
      })
      .sort((a, b) => b.count - a.count),
  };
}

