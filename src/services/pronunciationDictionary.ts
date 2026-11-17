import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { ruleBasedPhonemes, spellingChunks, type SpellingChunk } from '@/speech/phonemes';
import dictionaryAsset from '../../assets/data/cmudict.txt';

export type PronunciationSource = 'dictionary' | 'rules';

export interface Pronunciation {
  word: string;
  phonemes: string[];
  source: PronunciationSource;
  /** Letter groups for each sound, when the spelling lines up with the sounds. */
  chunks: SpellingChunk[] | null;
}

let loading: Promise<Map<string, string[]>> | null = null;

/**
 * Loads the bundled CMU pronunciation dictionary (~117k words) once, on first use.
 * It's an asset rather than part of the JavaScript bundle, so app start-up stays fast.
 */
export function loadDictionary(): Promise<Map<string, string[]>> {
  if (!loading) {
    loading = (async () => {
      const [asset] = await Asset.loadAsync(dictionaryAsset);
      const text = await new File(asset.localUri ?? asset.uri).text();
      const map = new Map<string, string[]>();
      for (const line of text.split('\n')) {
        const space = line.indexOf(' ');
        if (space > 0) map.set(line.slice(0, space), line.slice(space + 1).split(' '));
      }
      return map;
    })().catch((error) => {
      loading = null; // allow a retry
      throw error;
    });
  }
  return loading;
}

export function cleanWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/g, '');
}

/** Dictionary pronunciation, or a rule-based guess when the word isn't listed (or the dictionary fails). */
export async function pronounce(rawWord: string): Promise<Pronunciation> {
  const word = cleanWord(rawWord);
  let phonemes: string[] | undefined;
  try {
    phonemes = (await loadDictionary()).get(word);
  } catch {
    phonemes = undefined;
  }
  const source: PronunciationSource = phonemes ? 'dictionary' : 'rules';
  const sounds = phonemes ?? ruleBasedPhonemes(word);
  return { word, phonemes: sounds, source, chunks: spellingChunks(word, sounds) };
}

/** The sounds of several words heard by the recogniser (first alternative that's known wins). */
export async function pronounceHeard(transcripts: string[]): Promise<string[]> {
  const dictionary = await loadDictionary().catch(() => new Map<string, string[]>());
  for (const transcript of transcripts) {
    const words = transcript.toLowerCase().split(/\s+/).map(cleanWord).filter(Boolean);
    if (words.length === 0) continue;
    return words.flatMap((w) => dictionary.get(w) ?? ruleBasedPhonemes(w));
  }
  return [];
}

/** Pronunciation of `word` for display; null while loading or when the word is empty. */
export function usePronunciation(word: string | null): Pronunciation | null {
  const [result, setResult] = useState<Pronunciation | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!word || !cleanWord(word)) return;
    pronounce(word).then((p) => {
      if (!cancelled) setResult(p);
    });
    return () => {
      cancelled = true;
    };
  }, [word]);
  return word && result?.word === cleanWord(word) ? result : null;
}
