import type { DayKey } from '@/lib/date';
import { ACTIVITIES } from './catalog';
import type { ActivityId } from './types';

/**
 * Focus helper: on-device signals from the front camera (opt-in, per child), replacing the original
 * server-side emotion tracker. A face detector reports head angle, eye openness and smiling; this
 * module turns those into an expression and a 0–100 concentration score. No photo is ever kept.
 */

/** What the face detector saw in one photo, or null when no face was found. */
export interface FaceReading {
  /** Left/right head turn in degrees (0 = facing the screen). */
  yaw: number;
  /** Up/down head tilt in degrees. */
  pitch: number;
  /** 0–1, when the detector could tell. */
  smiling?: number;
  leftEyeOpen?: number;
  rightEyeOpen?: number;
}

export type Expression = 'happy' | 'focused' | 'tired' | 'looking-away' | 'away';

/** Where in the app a sample was taken: an activity id or a studio such as "writing". */
export type FocusFeature = ActivityId | Studio;

/** Screens outside the activity runner that the Focus helper also watches. */
export const STUDIOS = {
  writing: '🏆',
  'phonic-check': '🎤',
  magic: '✨',
  visual: '🧠',
  'speech-test': '🩺',
  'spelling-test': '✍️',
} as const;
export type Studio = keyof typeof STUDIOS;

export const isActivityFeature = (feature: FocusFeature): feature is ActivityId => feature in ACTIVITIES;
// Falls back for readings saved by an older version with a feature that no longer exists.
export const featureEmoji = (feature: FocusFeature): string => (isActivityFeature(feature) ? ACTIVITIES[feature].emoji : (STUDIOS[feature] ?? '📚'));

export interface FocusSample {
  /** Milliseconds since the epoch. */
  at: number;
  day: DayKey;
  feature: FocusFeature;
  expression: Expression;
  /** 0–100. */
  concentration: number;
}

/** Head turned further than this counts as looking away from the screen. */
const LOOK_AWAY_DEGREES = 30;
/** Average eye openness below this counts as tired (or eyes closing). */
const TIRED_EYES = 0.35;
const HAPPY_SMILE = 0.6;

/** 1 when facing the screen, falling to 0 as the head turns past LOOK_AWAY_DEGREES. */
function facing(reading: FaceReading): number {
  const angle = Math.max(Math.abs(reading.yaw), Math.abs(reading.pitch));
  return Math.max(0, Math.min(1, 1 - (angle - 10) / (LOOK_AWAY_DEGREES - 10)));
}

/**
 * The original "positive engagement minus half the distraction" score, from the camera's signals:
 * engagement is facing the screen with eyes open; distraction is turning away or eyes closing.
 */
export function analyzeFace(reading: FaceReading | null): { expression: Expression; concentration: number } {
  if (!reading) return { expression: 'away', concentration: 0 };
  const eyes = reading.leftEyeOpen !== undefined && reading.rightEyeOpen !== undefined ? (reading.leftEyeOpen + reading.rightEyeOpen) / 2 : 1;
  const engagement = facing(reading) * Math.min(1, eyes / 0.7);
  const distraction = 1 - engagement;
  const concentration = Math.round(Math.max(0, engagement - distraction * 0.5) * 100);
  const expression: Expression =
    facing(reading) === 0 ? 'looking-away' : eyes < TIRED_EYES ? 'tired' : (reading.smiling ?? 0) >= HAPPY_SMILE ? 'happy' : 'focused';
  return { expression, concentration };
}

/** Concentration below this, several times in a row, suggests the child needs a break. */
export const LOW_FOCUS = 35;
const LOW_FOCUS_SAMPLES = 3;
/** Samples further apart than this don't count as "in a row". */
const SAMPLE_GAP_MS = 20_000;

/** True when the latest few samples for a feature all show low concentration. */
export function needsFocusBreak(samples: FocusSample[], feature: FocusFeature, now: number): boolean {
  const recent = samples.filter((s) => s.feature === feature).slice(-LOW_FOCUS_SAMPLES);
  if (recent.length < LOW_FOCUS_SAMPLES) return false;
  const fresh = now - recent[recent.length - 1].at < SAMPLE_GAP_MS;
  const inARow = recent.every((s, i) => i === 0 || s.at - recent[i - 1].at < SAMPLE_GAP_MS);
  return fresh && inARow && recent.every((s) => s.concentration < LOW_FOCUS);
}

export type FocusBand = 'high' | 'medium' | 'low';
export const focusBand = (concentration: number): FocusBand => (concentration > 70 ? 'high' : concentration > 45 ? 'medium' : 'low');

export interface FocusSummary {
  feature: FocusFeature;
  samples: number;
  /** Mean concentration, 0–100. */
  concentration: number;
  expressions: Partial<Record<Expression, number>>;
  /** Most frequent expression. */
  dominant: Expression;
}

/** Per-feature focus for the Mood Track report, most-used features first. */
export function summarizeFocus(samples: FocusSample[]): FocusSummary[] {
  const groups = new Map<FocusFeature, FocusSample[]>();
  for (const s of samples) groups.set(s.feature, [...(groups.get(s.feature) ?? []), s]);
  return [...groups]
    .map(([feature, list]) => {
      const expressions: Partial<Record<Expression, number>> = {};
      for (const s of list) expressions[s.expression] = (expressions[s.expression] ?? 0) + 1;
      const dominant = (Object.entries(expressions) as [Expression, number][]).sort((a, b) => b[1] - a[1])[0][0];
      return { feature, samples: list.length, concentration: Math.round(list.reduce((sum, s) => sum + s.concentration, 0) / list.length), expressions, dominant };
    })
    .sort((a, b) => b.samples - a.samples);
}

/** Mean concentration per day (oldest first), for the journey heatmap. */
export function focusByDay(samples: FocusSample[], days: DayKey[]): { day: DayKey; concentration: number | null }[] {
  return days.map((day) => {
    const list = samples.filter((s) => s.day === day);
    return { day, concentration: list.length ? Math.round(list.reduce((sum, s) => sum + s.concentration, 0) / list.length) : null };
  });
}
