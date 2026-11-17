import type { Emotion, EmotionScores } from '@/emotion/model';
import type { DayKey } from '@/lib/date';
import { ACTIVITIES } from './catalog';
import type { ActivityId } from './types';

/**
 * Focus helper: on-device signals from the front camera (opt-in, per child), replacing the original
 * server-side emotion tracker. A face detector reports head angle, eye openness and smiling, and the
 * original 7-expression model (angry, disgust, fear, happy, sad, surprise, neutral) reads the face;
 * this module turns those into an expression and a 0–100 concentration score. No photo is ever kept.
 *
 * Fallbacks, best first: camera with expressions → camera with attention only (if the expression
 * model can't run) → touch activity (when the face isn't in view, the camera is off or not allowed,
 * or the app runs without the face detector, e.g. Expo Go). Each reading records its source.
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
  /** Where the face is in the photo, in photo pixels (used to read the expression). */
  box?: { x: number; y: number; width: number; height: number };
}

/**
 * camera: happy, focused, surprised, frustrated, sad, worried, tired, looking-away.
 * touch fallback: active (busy with the app but not seen), away (no face and no activity).
 */
export type Expression = 'happy' | 'focused' | 'surprised' | 'frustrated' | 'sad' | 'worried' | 'tired' | 'looking-away' | 'active' | 'away';
export type FocusSource = 'camera' | 'touch';

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
  /** Where the reading came from; missing in readings saved before fallbacks existed (camera). */
  source?: FocusSource;
  /** The expression model's strongest emotion, when it ran. */
  emotion?: Emotion;
}

export const sourceOf = (sample: Pick<FocusSample, 'source'>): FocusSource => sample.source ?? 'camera';

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

/** The emotions behind each camera expression. */
const EMOTION_EXPRESSION: Record<Emotion, Expression> = {
  happy: 'happy',
  neutral: 'focused',
  surprise: 'surprised',
  angry: 'frustrated',
  disgust: 'frustrated',
  sad: 'sad',
  fear: 'worried',
};
/** The expression model has to be at least this sure before its emotion is used. */
const EMOTION_CONFIDENCE = 0.4;

/**
 * The original server's emotional "concentration index": neutral and happy faces count as engaged,
 * surprise half, and sad, angry, fearful or disgusted faces subtract. 0–100.
 */
export function emotionIndex(e: EmotionScores): number {
  const positive = e.neutral * 100 + e.happy * 70 + e.surprise * 50;
  const negative = e.sad * 80 + e.angry * 100 + e.fear * 100 + e.disgust * 100;
  return Math.max(0, Math.min(100, positive - negative * 0.5));
}

export const dominantEmotion = (e: EmotionScores): Emotion => (Object.entries(e) as [Emotion, number][]).sort((a, b) => b[1] - a[1])[0][0];

/**
 * A camera reading: attention ("positive engagement minus half the distraction", from facing the
 * screen with eyes open) adjusted by the expression model when it ran: a neutral face keeps the full
 * score, a frustrated or upset one halves it. Looking away and tired eyes come first; otherwise the
 * expression model's emotion (when sure enough), or the face detector's smile.
 */
export function analyzeFace(reading: FaceReading | null, emotions?: EmotionScores | null): { expression: Expression; concentration: number; emotion?: Emotion } {
  if (!reading) return { expression: 'away', concentration: 0 };
  const eyes = reading.leftEyeOpen !== undefined && reading.rightEyeOpen !== undefined ? (reading.leftEyeOpen + reading.rightEyeOpen) / 2 : 1;
  const engagement = facing(reading) * Math.min(1, eyes / 0.7);
  const distraction = 1 - engagement;
  const attention = Math.max(0, engagement - distraction * 0.5) * 100;
  const emotion = emotions ? dominantEmotion(emotions) : undefined;
  const concentration = Math.round(emotions ? attention * (0.5 + emotionIndex(emotions) / 200) : attention);
  let expression: Expression;
  if (facing(reading) === 0) expression = 'looking-away';
  else if (eyes < TIRED_EYES) expression = 'tired';
  else if (emotions && emotion && emotions[emotion] >= EMOTION_CONFIDENCE) expression = EMOTION_EXPRESSION[emotion];
  else expression = (reading.smiling ?? 0) >= HAPPY_SMILE ? 'happy' : 'focused';
  return emotion ? { expression, concentration, emotion } : { expression, concentration };
}

/** Touches or speech this recent count as being busy with the app. */
export const ACTIVE_WITHIN_MS = 20_000;
/**
 * Touch-activity readings can't see attention, so being busy with the app counts as moderately
 * focused, and no activity at all as away. Clearly labelled as touch readings in every report.
 */
export const ACTIVE_SCORE = 65;

/** A reading from touch and speech activity, when the camera can't see the child. */
export function analyzeActivity(msSinceInteraction: number): { expression: Expression; concentration: number } {
  return msSinceInteraction <= ACTIVE_WITHIN_MS ? { expression: 'active', concentration: ACTIVE_SCORE } : { expression: 'away', concentration: 0 };
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
  /** Readings from the camera and from touch activity. */
  sources: Record<FocusSource, number>;
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
      const sources: Record<FocusSource, number> = { camera: 0, touch: 0 };
      for (const s of list) sources[sourceOf(s)] += 1;
      return { feature, samples: list.length, concentration: Math.round(list.reduce((sum, s) => sum + s.concentration, 0) / list.length), expressions, dominant, sources };
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
