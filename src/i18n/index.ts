import { useCallback } from 'react';
import { isActivityFeature, type FocusFeature, type Studio } from '@/engine/focus';
import type { PathNode, UnitId } from '@/engine/path';
import type { ActivityId, Level, SkillId } from '@/engine/types';
import { useAppStore } from '@/store/appStore';
import { en, type Dictionary, type TranslationKey } from './en';
import { hi } from './hi';
import { ta } from './ta';

export type Language = 'en' | 'ta' | 'hi';
export type { TranslationKey };

export const LANGUAGES: { code: Language; label: string; flag: string; speechTag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧', speechTag: 'en-US' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳', speechTag: 'ta-IN' },
  { code: 'hi', label: 'हिंदी', flag: '🇮🇳', speechTag: 'hi-IN' },
];

const DICTIONARIES: Record<Language, Dictionary> = { en, ta, hi };

export type Vars = Record<string, string | number>;

export function translate(language: Language, key: TranslationKey, vars?: Vars): string {
  const template = DICTIONARIES[language]?.[key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export type T = (key: TranslationKey, vars?: Vars) => string;

/** Translation function for the app's current language. */
export function useT(): { t: T; language: Language } {
  const language = useAppStore((s) => s.language);
  const t = useCallback<T>((key, vars) => translate(language, key, vars), [language]);
  return { t, language };
}

export function useLanguage(): Language {
  return useAppStore((s) => s.language);
}

/** Scripts that need extra line height and no added letter spacing (to keep joined letters intact). */
export function isComplexScript(language: Language): boolean {
  return language === 'ta' || language === 'hi';
}

// Typed helpers for catalog text, so callers never build keys by hand.
export const activityKey = (id: ActivityId, part: 'title' | 'tagline' | 'instructions') => `act_${id}_${part}` as TranslationKey;
export const levelKey = (id: ActivityId, level: Level) => `act_${id}_level${level}` as TranslationKey;
export const skillKey = (id: SkillId) => `skill_${id}` as TranslationKey;
export const badgeKey = (id: string, part: 'title' | 'desc') => `badge_${id}_${part}` as TranslationKey;
export const unitKey = (id: UnitId, part: 'title' | 'subtitle') => `unit_${id}_${part}` as TranslationKey;

/** A path node's display name, e.g. "Odd One Out Challenge". */
export function nodeTitle(t: T, node: PathNode): string {
  return t(`node_${node.variant}` as TranslationKey, { activity: t(activityKey(node.activityId, 'title')) });
}

const STUDIO_TITLES: Record<Studio, TranslationKey> = {
  writing: 'write_title',
  'phonic-check': 'phonic_title',
  magic: 'magic_title',
  visual: 'visual_title',
  'speech-test': 'assess_title',
  'spelling-test': 'spell_title',
};

/** The display name of an activity or studio, for focus reports. */
export function featureTitle(t: T, feature: FocusFeature): string {
  if (isActivityFeature(feature)) return t(activityKey(feature, 'title'));
  return STUDIO_TITLES[feature] ? t(STUDIO_TITLES[feature]) : feature;
}

/** Removes emoji so the voice doesn't read them aloud. */
export function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
