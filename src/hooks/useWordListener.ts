import { useCallback, useEffect, useRef, useState } from 'react';
import { restoreAudioMode } from '@/services/sounds';
import { isSpeechRecognitionAvailable, listenForWord, type ListenError } from '@/services/speechRecognition';

/** Stop listening after this long if the recogniser never reports back. */
const LISTEN_TIMEOUT_MS = 9000;

export type ListenOutcome = { transcripts: string[] } | { error: ListenError };

/**
 * Listens for one spoken word at a time with the device's speech recogniser.
 * Handles the timeout, cancelling on unmount and restoring the audio session afterwards.
 */
export function useWordListener() {
  const [available] = useState(isSpeechRecognitionAvailable);
  const [listening, setListening] = useState(false);
  const cancel = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      cancel.current?.();
      cancel.current = null;
    },
    [],
  );

  const listen = useCallback(async (word: string): Promise<ListenOutcome> => {
    setListening(true);
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const outcome = await new Promise<ListenOutcome>((resolve) => {
      const finish = (result: ListenOutcome) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve(result);
      };
      timer = setTimeout(() => {
        cancel.current?.();
        finish({ error: 'no-speech' });
      }, LISTEN_TIMEOUT_MS);
      void listenForWord(word, {
        onResult: (transcripts) => finish({ transcripts }),
        onError: (error) => finish({ error }),
      }).then((stop) => {
        cancel.current = stop;
        if (settled) stop();
      });
    });
    cancel.current = null;
    setListening(false);
    restoreAudioMode();
    return outcome;
  }, []);

  return { available, listening, listen };
}
