import * as Speech from 'expo-speech';

export interface SpeakOptions {
  rate?: number;
  /** BCP-47 voice language. Learning content is always spoken in English. */
  language?: string;
  onDone?: () => void;
}

/** Speaks `text`, interrupting anything already being said so prompts never pile up. */
export function speak(text: string, { rate = 0.85, language = 'en-US', onDone }: SpeakOptions = {}): void {
  Speech.stop().catch(() => undefined);
  Speech.speak(text, {
    language,
    rate,
    pitch: 1.05,
    onDone,
    onStopped: onDone,
    onError: onDone,
  });
}

export function stopSpeaking(): void {
  Speech.stop().catch(() => undefined);
}

const voiceChecks = new Map<string, Promise<boolean>>();

/** Whether the device has a voice for `languageTag` (e.g. "hi-IN"). Cached per language. */
export function hasVoiceFor(languageTag: string): Promise<boolean> {
  const prefix = languageTag.split('-')[0].toLowerCase();
  let check = voiceChecks.get(prefix);
  if (!check) {
    // Any failure (no voice list on this platform) falls back to English, never crashes.
    check = Promise.resolve()
      .then(() => Speech.getAvailableVoicesAsync())
      .then((voices) => voices.some((v) => v.language.toLowerCase().startsWith(prefix)))
      .catch(() => false);
    voiceChecks.set(prefix, check);
  }
  return check;
}
