import { daysBetween, type DayKey } from '@/lib/date';
import type { StreakState } from './types';

export function emptyStreak(): StreakState {
  return { count: 0, best: 0, lastDay: null };
}

/** Registers learning on `day`. Consecutive days grow the streak; a gap restarts it. */
export function recordStreakDay(streak: StreakState, day: DayKey): StreakState {
  if (streak.lastDay === day) return streak;
  const gap = streak.lastDay ? daysBetween(streak.lastDay, day) : null;
  if (gap !== null && gap < 0) return streak; // clock moved backwards: ignore
  const count = gap === 1 ? streak.count + 1 : 1;
  return { count, best: Math.max(streak.best, count), lastDay: day };
}

/** The streak as it should be shown today: still alive if the child learned today or yesterday. */
export function currentStreak(streak: StreakState, today: DayKey): number {
  if (!streak.lastDay) return 0;
  const gap = daysBetween(streak.lastDay, today);
  return gap === 0 || gap === 1 ? streak.count : 0;
}
