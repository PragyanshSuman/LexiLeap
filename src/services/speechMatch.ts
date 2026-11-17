import { SPEECH_ALTERNATES } from '@/content/words';
import { normalizeSpeech, similarity } from '@/lib/text';

export type SpeechMatch = 'exact' | 'close' | 'none';

/** Similarity needed for partial credit. Only applied to longer words (see below). */
const CLOSE_SIMILARITY = 0.75;
/** For short words one wrong letter is a different word (pig/big), so no partial credit. */
const MIN_LENGTH_FOR_CLOSE = 5;

/**
 * Compares what the recogniser heard with the target word.
 * `transcripts` are the recogniser's alternatives, best first.
 */
export function matchSpokenWord(target: string, transcripts: string[]): { match: SpeechMatch; heard: string } {
  const goal = normalizeSpeech(target);
  const accepted = new Set([goal, ...(SPEECH_ALTERNATES[goal] ?? [])]);
  let best: { match: SpeechMatch; heard: string } = { match: 'none', heard: normalizeSpeech(transcripts[0] ?? '') };

  for (const transcript of transcripts) {
    const heard = normalizeSpeech(transcript);
    if (!heard) continue;
    const candidates = [...heard.split(' '), heard.replace(/ /g, '')];
    if (candidates.some((c) => accepted.has(c))) return { match: 'exact', heard };
    if (
      best.match === 'none' &&
      goal.length >= MIN_LENGTH_FOR_CLOSE &&
      candidates.some((c) => similarity(c, goal) >= CLOSE_SIMILARITY)
    ) {
      best = { match: 'close', heard };
    }
  }
  return best;
}
