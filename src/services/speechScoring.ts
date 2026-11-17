import { scoreSpokenWord } from '@/engine/assessment';
import type { SoundResult } from '@/engine/types';
import { pronounce, pronounceHeard } from './pronunciationDictionary';
import { matchSpokenWordBySound } from './speechMatch';

/**
 * Scores a spoken word sound by sound, like the original's phoneme check: the target word's sounds
 * (CMU dictionary, ARPAbet) are aligned with the sounds of what the recogniser heard, giving the share
 * of sounds said right plus each missed or swapped sound. A word heard as itself or a homophone
 * (sun / son) scores every sound right.
 */
export async function scoreSpeech(word: string, transcripts: string[]): Promise<SoundResult> {
  const target = await pronounce(word);
  const { match } = await matchSpokenWordBySound(word, transcripts, async (w) => (await pronounce(w)).phonemes);
  const heard = match === 'exact' ? target.phonemes : await pronounceHeard(transcripts);
  return scoreSpokenWord(word, target.phonemes, heard, transcripts[0]);
}
