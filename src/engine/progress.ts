import type { DayKey } from '@/lib/date';
import { emptyActivityProgress, mean, nextLevel, RECENT_WINDOW, starsFor, updateMastery } from './adaptive';
import { newlyEarnedBadges } from './badges';
import { ACTIVITIES } from './catalog';
import { applyPathSession, emptyPath } from './path';
import { markPlanItem } from './plan';
import { emptyStreak, recordStreakDay } from './streak';
import type { Level, ProgressState, SessionOutcome, SessionRecord, SessionResult } from './types';

/** Older sessions are dropped beyond this to keep storage small; aggregates live elsewhere. */
export const MAX_SESSIONS = 400;
/** Bonus stars for finishing a whole daily plan. */
export const PLAN_BONUS_STARS = 5;
/** Usage and mood history is kept for this many days. */
export const HISTORY_DAYS = 120;

export function emptyProgress(): ProgressState {
  return {
    activities: {},
    skills: {},
    letters: {},
    sessions: [],
    stars: 0,
    streak: emptyStreak(),
    badges: {},
    plan: null,
    plansCompleted: 0,
    usage: {},
    bonusMinutes: {},
    moods: {},
    confusions: {},
    path: emptyPath(),
    toursSeen: {},
    speechChecks: [],
    assessments: [],
    writing: [],
    focus: [],
    mastery: [],
    rhymeVault: {},
  };
}

/** Order-independent key for a mix-up between two look-alikes. */
export function confusionKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/** The most frequent mix-ups, most common first. */
export function topConfusions(state: ProgressState, limit = 5): { pair: [string, string]; count: number }[] {
  return Object.entries(state.confusions ?? {})
    .map(([key, count]) => ({ pair: key.split('|') as [string, string], count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Folds a finished session into the child's progress. Pure: returns new state plus a
 * summary of what changed (stars, level change, badges, plan completion) for the UI.
 */
export function applySession(
  state: ProgressState,
  result: SessionResult,
  context: { id: string; day: DayKey; nowIso: string; maxLevel?: Level },
): { state: ProgressState; outcome: SessionOutcome } {
  const accuracy = Math.max(0, Math.min(1, mean(result.roundScores)));
  const stars = starsFor(accuracy);
  const meta = ACTIVITIES[result.activityId];

  const session: SessionRecord = {
    id: context.id,
    activityId: result.activityId,
    level: result.level,
    accuracy: Math.round(accuracy * 1000) / 1000,
    rounds: result.roundScores.length,
    firstTry: result.firstTry,
    durationSec: Math.round(result.durationSec),
    startedAt: result.startedAt,
    day: context.day,
    struggles: result.struggles,
    stars,
    ...(result.avgResponseSec !== undefined ? { avgResponseSec: Math.round(result.avgResponseSec * 10) / 10 } : {}),
  };

  // Activity level & history.
  const previous = state.activities[result.activityId] ?? emptyActivityProgress();
  // Adapt from the level actually played (a session can be eased mid-way).
  const decision = nextLevel({ ...previous, level: result.level }, accuracy, result.struggles, context.maxLevel);
  const levelChanged = decision.level !== previous.level;
  const levelChange = decision.level > previous.level ? 'up' : decision.level < previous.level ? 'down' : null;
  const activity = {
    level: decision.level,
    sessions: previous.sessions + 1,
    levelSessions: levelChanged ? 0 : previous.levelSessions + 1,
    lastPlayed: context.day,
    recent: [...previous.recent, accuracy].slice(-RECENT_WINDOW),
    best: Math.max(previous.best, accuracy),
  };

  // Letter tracing details.
  let letters = state.letters;
  if (result.letterScores) {
    letters = { ...state.letters };
    for (const [glyph, score] of Object.entries(result.letterScores)) {
      const prev = letters[glyph] ?? { attempts: 0, best: 0, last: 0 };
      letters[glyph] = { attempts: prev.attempts + 1, best: Math.max(prev.best, score), last: score };
    }
  }

  let confusions = state.confusions ?? {};
  if (result.confusions?.length) {
    confusions = { ...confusions };
    for (const [a, b] of result.confusions) {
      if (a === b) continue;
      const key = confusionKey(a, b);
      confusions[key] = (confusions[key] ?? 0) + 1;
    }
  }

  const planResult = markPlanItem(state.plan, result.activityId, context.day);
  const pathResult = applyPathSession(state.path ?? emptyPath(), session, context.maxLevel);
  const starsEarned = stars + (planResult.planCompleted ? PLAN_BONUS_STARS : 0);

  const next: ProgressState = {
    ...state,
    activities: { ...state.activities, [result.activityId]: activity },
    skills: {
      ...state.skills,
      [meta.skill]: updateMastery(state.skills[meta.skill], accuracy, result.level),
    },
    letters,
    confusions,
    path: pathResult.path,
    sessions: [...state.sessions, session].slice(-MAX_SESSIONS),
    stars: state.stars + starsEarned,
    streak: recordStreakDay(state.streak, context.day),
    plan: planResult.plan,
    plansCompleted: state.plansCompleted + (planResult.planCompleted ? 1 : 0),
  };

  const newBadges = newlyEarnedBadges(next, session);
  if (newBadges.length > 0) {
    next.badges = { ...next.badges };
    for (const id of newBadges) next.badges[id] = context.nowIso;
  }

  return {
    state: next,
    outcome: {
      session,
      starsEarned,
      levelChange,
      newLevel: decision.level,
      newBadges,
      planItemCompleted: planResult.itemCompleted,
      planCompleted: planResult.planCompleted,
      pathNodesCompleted: pathResult.completed,
      pathXp: pathResult.xpEarned,
    },
  };
}

/** Drops per-day history older than HISTORY_DAYS (day keys sort lexicographically). */
export function pruneHistory<T>(record: Record<DayKey, T>, oldestKept: DayKey): Record<DayKey, T> {
  const out: Record<DayKey, T> = {};
  for (const [day, value] of Object.entries(record)) {
    if (day >= oldestKept) out[day] = value;
  }
  return out;
}

/** Minutes allowed today, or null when there is no limit. */
export function allowedMinutes(limitMinutes: number | null, state: ProgressState, day: DayKey): number | null {
  if (limitMinutes === null) return null;
  return limitMinutes + (state.bonusMinutes[day] ?? 0);
}

export function isOverLimit(limitMinutes: number | null, state: ProgressState, day: DayKey): boolean {
  const allowed = allowedMinutes(limitMinutes, state, day);
  if (allowed === null) return false;
  return (state.usage[day] ?? 0) >= allowed * 60;
}
