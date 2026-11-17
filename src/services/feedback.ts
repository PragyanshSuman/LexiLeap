import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { LANGUAGES, stripEmoji, translate, useLanguage, type Language, type TranslationKey, type Vars } from '@/i18n';
import { useChildPrefs } from '@/theme/useTheme';
import { playSound } from './sounds';
import { hasVoiceFor, speak, stopSpeaking } from './speech';

export interface Feedback {
  tap: () => void;
  correct: () => void;
  tryAgain: () => void;
  complete: () => void;
  /** Speaks English learning content (words, letters, prompts). */
  speak: (text: string, onDone?: () => void) => void;
  /**
   * Speaks a UI phrase in the app language when the device has a voice for it,
   * otherwise in English. Several keys are spoken one after another; emoji are skipped.
   */
  say: (keys: TranslationKey | TranslationKey[], vars?: Vars) => void;
  stopSpeaking: () => void;
}

const ignore = () => undefined;

/** Sound, haptic and voice feedback that respects the active child's preferences. */
export function useFeedback(): Feedback {
  const { sound, haptics, voiceRate } = useChildPrefs();
  const language = useLanguage();
  return useMemo(() => {
    const haptic = (fn: () => Promise<void>) => {
      if (haptics) fn().catch(ignore);
    };
    return {
      tap: () => {
        haptic(() => Haptics.selectionAsync());
        if (sound) playSound('tap');
      },
      correct: () => {
        haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
        if (sound) playSound('correct');
      },
      tryAgain: () => {
        haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
        if (sound) playSound('tryAgain');
      },
      complete: () => {
        haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
        if (sound) playSound('complete');
      },
      // The voice is part of the learning (prompts, words), so it isn't tied to the sound-effects switch.
      speak: (text, onDone) => speak(text, { rate: voiceRate, onDone }),
      say: (keys, vars) => {
        const list = Array.isArray(keys) ? keys : [keys];
        const phrase = (lang: Language) => stripEmoji(list.map((k) => translate(lang, k, vars)).join('. '));
        if (language === 'en') return speak(phrase('en'), { rate: voiceRate });
        const tag = LANGUAGES.find((l) => l.code === language)?.speechTag ?? 'en-US';
        void hasVoiceFor(tag).then((available) =>
          available ? speak(phrase(language), { rate: voiceRate, language: tag }) : speak(phrase('en'), { rate: voiceRate }),
        );
      },
      stopSpeaking,
    };
  }, [sound, haptics, voiceRate, language]);
}
