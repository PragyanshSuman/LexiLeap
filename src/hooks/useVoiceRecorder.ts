import { createAudioPlayer, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { markInteraction } from '@/services/interaction';
import { restoreAudioMode } from '@/services/sounds';

/** A spoken word is short; stop by itself after this long. */
const MAX_RECORDING_MS = 5000;

export type RecorderStatus = 'idle' | 'recording' | 'recorded' | 'denied';

/**
 * Records the child saying a word with the device microphone (works everywhere, including Expo Go) and
 * plays it back, so a grown-up can listen and mark it where the app has no speech recogniser.
 * The recording is kept only until the next one; it is never uploaded.
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [uri, setUri] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  const release = () => {
    try {
      player.current?.remove();
    } catch {
      // Already released.
    }
    player.current = null;
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      release();
    },
    [],
  );

  const stop = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    try {
      await recorder.stop();
    } catch {
      // Not recording.
    }
    // Back to playback so sounds and the voice are at full volume again.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    restoreAudioMode();
    setUri(recorder.uri);
    setStatus(recorder.uri ? 'recorded' : 'idle');
    markInteraction();
  }, [recorder]);

  const start = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync().catch(() => ({ granted: false }));
    if (!permission.granted) {
      setStatus('denied');
      return;
    }
    release();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setStatus('recording');
    markInteraction();
    timer.current = setTimeout(() => void stop(), MAX_RECORDING_MS);
  }, [recorder, stop]);

  const play = useCallback(() => {
    if (!uri) return;
    release();
    const p = createAudioPlayer(uri);
    player.current = p;
    p.volume = 1;
    p.play();
  }, [uri]);

  const reset = useCallback(() => {
    release();
    setUri(null);
    setStatus('idle');
  }, []);

  return { status, start, stop, play, reset };
}
