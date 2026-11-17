import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { ExpoSpeechRecognitionErrorCode } from 'expo-speech-recognition';
import { markInteraction } from './interaction';

type RecognitionModule = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;

/**
 * The native module only exists in development/production builds, not in Expo Go.
 * Loading it lazily lets the rest of the app run anywhere; "Say It" falls back to a
 * listen-and-check mode when recognition is unavailable.
 */
let cached: RecognitionModule | null | undefined;
function getModule(): RecognitionModule | null {
  if (cached !== undefined) return cached;
  // Ask first: loading the package in Expo Go throws while the module is being set up, and the
  // development error screen reports that even when it is caught.
  if (!requireOptionalNativeModule('ExpoSpeechRecognition')) return (cached = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-speech-recognition').ExpoSpeechRecognitionModule as RecognitionModule;
  } catch {
    cached = null;
  }
  return cached;
}

export function isSpeechRecognitionAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  const mod = getModule();
  if (!mod) return false;
  try {
    return mod.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export type ListenError = 'permission' | 'no-speech' | 'unavailable' | 'other';

export interface ListenHandlers {
  onStart?: () => void;
  /** Called once with the final alternatives, best first. */
  onResult: (transcripts: string[]) => void;
  onError: (error: ListenError) => void;
}

function toListenError(code: ExpoSpeechRecognitionErrorCode): ListenError {
  switch (code) {
    case 'not-allowed':
      return 'permission';
    case 'no-speech':
    case 'speech-timeout':
      return 'no-speech';
    case 'service-not-allowed':
    case 'language-not-supported':
      return 'unavailable';
    default:
      return 'other';
  }
}

function supportsOnDevice(mod: RecognitionModule): boolean {
  try {
    return mod.supportsOnDeviceRecognition();
  } catch {
    return false;
  }
}

/** Listens for one word. Returns a function that cancels listening. */
export async function listenForWord(word: string, handlers: ListenHandlers): Promise<() => void> {
  const mod = getModule();
  if (!mod) {
    handlers.onError('unavailable');
    return () => undefined;
  }

  const permission = await mod.requestPermissionsAsync();
  if (!permission.granted) {
    handlers.onError('permission');
    return () => undefined;
  }

  let settled = false;
  // Some recognisers (e.g. Google's on Xiaomi tablets) put the words only in interim results and then
  // send an empty final result, so the latest words heard are kept and used if the final one is empty.
  let heard: string[] = [];
  const subscriptions: { remove: () => void }[] = [];
  const cleanup = () => subscriptions.splice(0).forEach((s) => s.remove());
  const settle = (fn: () => void) => {
    if (settled) return;
    settled = true;
    cleanup();
    fn();
  };

  subscriptions.push(
    mod.addListener('start', () => handlers.onStart?.()),
    mod.addListener('result', (event) => {
      const transcripts = event.results.map((r) => r.transcript.trim()).filter(Boolean);
      if (transcripts.length) {
        heard = transcripts;
        // Speaking to the app counts as being busy with it (the Focus helper's fallback signal).
        markInteraction();
      }
      if (event.isFinal && heard.length) settle(() => handlers.onResult(heard));
    }),
    mod.addListener('error', (event) => {
      if (event.error === 'aborted') return settle(() => undefined);
      if (heard.length) return settle(() => handlers.onResult(heard));
      settle(() => handlers.onError(toListenError(event.error)));
    }),
    // Recognition ended: use what was heard, if anything.
    mod.addListener('end', () => settle(() => (heard.length ? handlers.onResult(heard) : handlers.onError('no-speech')))),
  );

  try {
    mod.start({
      lang: 'en-US',
      interimResults: true,
      maxAlternatives: 5,
      continuous: false,
      contextualStrings: [word],
      // On the device whenever it can (offline, private, free); otherwise the platform's own service.
      requiresOnDeviceRecognition: supportsOnDevice(mod),
      // Short single-word answers.
      iosTaskHint: 'confirmation',
      androidIntentOptions: { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1500 },
    });
  } catch {
    settle(() => handlers.onError('other'));
  }

  return () =>
    settle(() => {
      try {
        mod.abort();
      } catch {
        // already stopped
      }
    });
}
