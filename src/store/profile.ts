import type { Level } from '@/engine/types';
import type { FontChoice } from '@/theme/fonts';
import type { OverlayName, ThemeName } from '@/theme/palettes';

/** Per-child preferences. Each child can have different reading needs. */
export interface Prefs {
  font: FontChoice;
  /** Multiplier for all text, 0.9–1.5. */
  textScale: number;
  /** 0 = normal, 1 = wide, 2 = extra wide letter and word spacing. */
  spacing: 0 | 1 | 2;
  theme: ThemeName;
  overlay: OverlayName;
  readingRuler: boolean;
  reduceMotion: boolean;
  sound: boolean;
  haptics: boolean;
  /** Speech rate for the voice, 0.6–1.1. */
  voiceRate: number;
  /** Daily screen-time limit in minutes, or null for none. Parent-controlled. */
  dailyLimitMin: number | null;
  /** Activities in the daily plan, 3–6. Parent-controlled. */
  dailyGoal: number;
  /**
   * Minutes of continuous play before the Wellness Advisor suggests a short break,
   * or null for never. Parent-controlled.
   */
  breakReminderMin: number | null;
  /**
   * Focus helper: during activities the front camera briefly checks for the child's face to notice
   * tiredness or distraction (on the device; no photo is kept). Off unless a parent turns it on.
   */
  focusHelper: boolean;
  /**
   * How quickly the app steps in when the child struggles (misses in a row before a calm break and an
   * easier level is offered). The original's "AI frustration sensitivity". Parent-controlled.
   */
  struggleSensitivity: StruggleSensitivity;
  /** Highest difficulty level activities may reach (the original's "max difficulty ceiling"). Parent-controlled. */
  maxLevel: Level;
}

export type StruggleSensitivity = 'gentle' | 'balanced' | 'quick';

export interface Profile {
  id: string;
  /** Shown in the app, and used (case-insensitively) as the login username. */
  name: string;
  avatar: string;
  age: number;
  createdAt: string;
  prefs: Prefs;
  /** Salted SHA-256 of the child's password; absent for profiles made without one. */
  passwordHash?: string;
  salt?: string;
}

export const MIN_PASSWORD_LENGTH = 4;

export const usernameKey = (name: string) => name.trim().toLowerCase();

export const DEFAULT_PREFS: Prefs = {
  font: 'lexend',
  textScale: 1,
  spacing: 1,
  theme: 'cream',
  overlay: 'none',
  readingRuler: false,
  reduceMotion: false,
  sound: true,
  haptics: true,
  voiceRate: 0.85,
  dailyLimitMin: 30,
  dailyGoal: 4,
  breakReminderMin: 20,
  focusHelper: false,
  struggleSensitivity: 'balanced',
  maxLevel: 3,
};

export const AVATARS = ['🦊', '🐼', '🐯', '🦁', '🐸', '🐵', '🐰', '🐻', '🐨', '🦄', '🐙', '🐢', '🦉', '🐳', '🐝', '🦖'];

export const MIN_AGE = 4;
export const MAX_AGE = 12;
export const MAX_NAME_LENGTH = 20;
export const MAX_PROFILES = 6;

export const SCREEN_TIME_OPTIONS: (number | null)[] = [15, 20, 30, 45, 60, 90, null];
export const BREAK_REMINDER_OPTIONS: (number | null)[] = [10, 15, 20, 30, null];
