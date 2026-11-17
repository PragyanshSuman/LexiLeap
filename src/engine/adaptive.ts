import type { ActivityProgress, Level } from './types';

export const RECENT_WINDOW = 5;

/** Accuracy needed to move up a level, and the floor below which we step down. */
export const LEVEL_UP_ACCURACY = 0.85;
export const LEVEL_DOWN_ACCURACY = 0.5;
/** A very strong session levels up straight away; otherwise two strong sessions are needed. */
export const INSTANT_LEVEL_UP_ACCURACY = 0.95;

export function emptyActivityProgress(): ActivityProgress {
  return { level: 1, sessions: 0, levelSessions: 0, lastPlayed: null, recent: [], best: 0 };
}

export function clampLevel(level: number): Level {
  return Math.max(1, Math.min(3, Math.round(level))) as Level;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Decides the next level after a session.
 * - Strong performance (≥85%) twice at a level, or once at ≥95%, moves up.
 * - Weak performance (<50%), or struggling with a below-par score, moves down.
 * Moving down is never a punishment in the UI; it is framed as "warming up".
 */
export function nextLevel(
  current: ActivityProgress,
  accuracy: number,
  struggles: number,
  /** A parent's ceiling: never move above this level (and come down to it if above). */
  maxLevel: Level = 3,
): { level: Level; change: 'up' | 'down' | null } {
  const { level } = current;
  if (level > maxLevel) return { level: maxLevel, change: 'down' };
  // `levelSessions` resets on every level change, so this only looks at the current level.
  const previousWasStrong =
    current.levelSessions >= 1 && (current.recent[current.recent.length - 1] ?? 0) >= LEVEL_UP_ACCURACY;
  if (
    level < maxLevel &&
    (accuracy >= INSTANT_LEVEL_UP_ACCURACY || (accuracy >= LEVEL_UP_ACCURACY && previousWasStrong))
  ) {
    return { level: clampLevel(level + 1), change: 'up' };
  }
  if (level > 1 && (accuracy < LEVEL_DOWN_ACCURACY || (struggles >= 2 && accuracy < 0.65))) {
    return { level: clampLevel(level - 1), change: 'down' };
  }
  return { level, change: null };
}

/**
 * Mastery (0–100) is an exponential moving average of accuracy, weighted by level,
 * so 100 is only reachable with consistently strong sessions at the hardest level.
 */
export function updateMastery(previous: number | undefined, accuracy: number, level: Level): number {
  const levelWeight = 0.55 + 0.15 * level; // L1 → 0.70, L2 → 0.85, L3 → 1.00
  const sample = Math.max(0, Math.min(1, accuracy)) * levelWeight * 100;
  const value = previous === undefined ? sample : previous * 0.7 + sample * 0.3;
  return Math.round(value * 10) / 10;
}

/** 1–3 stars for a session. Every finished session earns at least one star for effort. */
export function starsFor(accuracy: number): number {
  if (accuracy >= 0.9) return 3;
  if (accuracy >= 0.7) return 2;
  return 1;
}

/** Score for a multiple-choice round: full marks first try, partial after a retry, none if revealed. */
export function choiceRoundScore(wrongAttempts: number, revealed: boolean): number {
  if (revealed) return 0;
  if (wrongAttempts === 0) return 1;
  if (wrongAttempts === 1) return 0.5;
  return 0.25;
}

/** Misses in a row before the runner offers a calm break and an easier level, per sensitivity. */
export const MISSES_BEFORE_BREAK = { gentle: 4, balanced: 3, quick: 2 } as const;
