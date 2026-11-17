import { rhymesWith } from '@/content/rhymes';
import { PHONEMES } from './phonemes';

/** Unstressed-sounding vowels: a word ending in one rhymes on the syllable before it too (tiger ≠ letter). */
const WEAK_VOWELS = new Set(['AH', 'ER', 'IH']);

const isVowel = (phoneme: string) => PHONEMES[phoneme]?.vowel ?? false;

/** The part of a word that has to match for a rhyme: its last vowel sound and everything after it. */
export function rhymeTail(phonemes: string[]): string[] {
  const vowels = phonemes.map((p, i) => (isVowel(p) ? i : -1)).filter((i) => i >= 0);
  if (vowels.length === 0) return phonemes;
  let start = vowels[vowels.length - 1];
  if (WEAK_VOWELS.has(phonemes[start]) && vowels.length > 1) start = vowels[vowels.length - 2];
  return phonemes.slice(start);
}

/** True when two different words rhyme (cat / hat, moon / balloon), by their sounds. */
export function soundsRhyme(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  // The same sounds throughout is the same word (or a homophone), not a rhyme.
  if (a.join(' ') === b.join(' ')) return false;
  return rhymeTail(a).join(' ') === rhymeTail(b).join(' ');
}

export interface SpokenRhyme {
  /** The rhyming word the child said, or null when none of the words heard rhymes. */
  rhyme: string | null;
  /** The best transcript, to show what was heard. */
  heard: string;
}

const clean = (w: string) => w.toLowerCase().replace(/[^a-z]/g, '');

/**
 * Looks through everything the recogniser heard for a word that rhymes with `target`. Uses the
 * picture rhyme families first, then the pronunciation dictionary (`pronounce` is injected so this
 * stays testable without loading the 117k-word dictionary).
 */
export async function findSpokenRhyme(target: string, transcripts: string[], pronounce: (word: string) => Promise<string[]>): Promise<SpokenRhyme> {
  const word = clean(target);
  const heard = transcripts[0]?.trim() ?? '';
  const candidates = [...new Set(transcripts.flatMap((t) => t.split(/\s+/).map(clean)).filter((w) => w && w !== word))];
  for (const candidate of candidates) {
    if (rhymesWith(word, candidate)) return { rhyme: candidate, heard };
  }
  const targetSounds = await pronounce(word);
  for (const candidate of candidates) {
    if (soundsRhyme(targetSounds, await pronounce(candidate))) return { rhyme: candidate, heard };
  }
  return { rhyme: null, heard };
}
