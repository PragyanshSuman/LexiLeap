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

/** Sounds of a word, from the pronunciation dictionary (injected so this stays testable). */
export type Pronouncer = (word: string) => Promise<string[]>;

/** Share of sounds two pronunciations have in common, 0–1 (edit distance over the sounds). */
export function soundSimilarity(a: string[], b: string[]): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = curr;
  }
  return 1 - prev[b.length] / longest;
}

/** Sound similarity needed for partial credit, for words of at least this many sounds. */
const CLOSE_SOUNDS = 0.75;
const MIN_SOUNDS_FOR_CLOSE = 4;

/**
 * Like matchSpokenWord, but also listens to the sounds: a word heard with the same sounds as the target
 * (sun / son, pear / pair, bee / be) is right, and a longer word with nearly the same sounds gets
 * partial credit. Recognisers often type a homophone or a near spelling of a child's word.
 */
export async function matchSpokenWordBySound(target: string, transcripts: string[], pronounce: Pronouncer): Promise<{ match: SpeechMatch; heard: string }> {
  const byText = matchSpokenWord(target, transcripts);
  if (byText.match === 'exact') return byText;
  const goal = await pronounce(normalizeSpeech(target));
  if (goal.length === 0) return byText;
  let best = byText;
  for (const transcript of transcripts) {
    const heard = normalizeSpeech(transcript);
    for (const word of heard.split(' ').filter(Boolean)) {
      const sounds = await pronounce(word);
      if (sounds.length === 0) continue;
      if (sounds.join(' ') === goal.join(' ')) return { match: 'exact', heard };
      if (best.match === 'none' && goal.length >= MIN_SOUNDS_FOR_CLOSE && soundSimilarity(sounds, goal) >= CLOSE_SOUNDS) best = { match: 'close', heard };
    }
  }
  return best;
}
