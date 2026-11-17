import { daysBetween, type DayKey } from '@/lib/date';
import { createRng, hashString } from '@/lib/random';
import { ACTIVITIES, ACTIVITY_ORDER, SKILLS } from './catalog';
import type { ActivityId, DailyPlan, Mood, ProgressState, SkillId } from './types';

export interface PlanOptions {
  day: DayKey;
  profileId: string;
  age: number;
  /** Number of activities the parent wants per day (3–6). */
  goal: number;
  mood?: Mood;
}

/** Weakness assumed for a skill that hasn't been measured yet: encourages exploring it. */
const UNMEASURED_WEAKNESS = 0.8;

interface Candidate {
  id: ActivityId;
  skill: SkillId;
  score: number;
  weakness: number;
  daysAway: number | null;
}

export function skillWeakness(state: ProgressState, skill: SkillId): number {
  const mastery = state.skills[skill];
  return mastery === undefined ? UNMEASURED_WEAKNESS : 1 - mastery / 100;
}

/**
 * Builds a day's plan, deterministic for a given child, day and progress.
 *
 * Each candidate activity is scored by:
 *  - how weak its skill area is (biggest factor),
 *  - novelty (never tried),
 *  - spaced review (not practised for several days),
 *  - a small seeded jitter so plans vary day to day.
 * Picks are spread across skill areas, then ordered as: confident warm-up → focus work → fun finish.
 * A low mood shortens the plan and front-loads easier, game-like activities.
 */
export function buildDailyPlan(state: ProgressState, options: PlanOptions): DailyPlan {
  const { day, profileId, age, mood } = options;
  const rng = createRng(hashString(`${profileId}:${day}`));
  const lowMood = mood === 'tired' || mood === 'upset';
  const size = Math.max(2, Math.min(6, Math.round(options.goal)) - (lowMood ? 1 : 0));

  const eligible = ACTIVITY_ORDER.filter((id) => ACTIVITIES[id].minAge <= Math.max(age, 4));
  const candidates: Candidate[] = eligible.map((id) => {
    const meta = ACTIVITIES[id];
    const progress = state.activities[id];
    const weakness = skillWeakness(state, meta.skill);
    const daysAway = progress?.lastPlayed ? daysBetween(progress.lastPlayed, day) : null;

    let score = weakness;
    if (!progress || progress.sessions === 0) score += 0.3;
    if (daysAway !== null) {
      if (daysAway >= 7) score += 0.4;
      else if (daysAway >= 3) score += 0.25;
      else if (daysAway <= 1) score -= 0.1;
    }
    if (lowMood && meta.isGame) score += 0.3;
    score += rng() * 0.15;
    return { id, skill: meta.skill, score, weakness, daysAway };
  });

  // Greedy pick, penalising skill areas already chosen so the plan stays varied.
  const picked: Candidate[] = [];
  const pool = [...candidates];
  while (picked.length < size && pool.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    pool.forEach((c, i) => {
      const repeats = picked.filter((p) => p.skill === c.skill).length;
      const adjusted = c.score - repeats * 0.6;
      if (adjusted > bestScore) {
        bestScore = adjusted;
        bestIndex = i;
      }
    });
    picked.push(pool.splice(bestIndex, 1)[0]);
  }

  const ordered = orderForEngagement(picked, lowMood);
  return {
    day,
    items: ordered.map((c) => ({ activityId: c.id, done: false })),
    reason: explainPlan(ordered, state, lowMood),
    completed: false,
  };
}

function orderForEngagement(picked: Candidate[], lowMood: boolean): Candidate[] {
  if (picked.length <= 1) return picked;
  const byWeaknessDesc = [...picked].sort((a, b) => b.weakness - a.weakness);
  // Warm up with the child's strongest pick (or a game when they're feeling low).
  const warmUp = lowMood
    ? (byWeaknessDesc.find((c) => ACTIVITIES[c.id].isGame) ?? byWeaknessDesc[byWeaknessDesc.length - 1])
    : byWeaknessDesc[byWeaknessDesc.length - 1];
  const rest = byWeaknessDesc.filter((c) => c !== warmUp);
  // Finish on something fun if there is one.
  const finisherIndex = rest.map((c) => ACTIVITIES[c.id].isGame).lastIndexOf(true);
  if (finisherIndex !== -1 && finisherIndex !== rest.length - 1) {
    const [finisher] = rest.splice(finisherIndex, 1);
    rest.push(finisher);
  }
  return [warmUp, ...rest];
}

function explainPlan(ordered: Candidate[], state: ProgressState, lowMood: boolean): string {
  const parts: string[] = [];
  const measured = (Object.keys(state.skills) as SkillId[]).filter((s) => state.skills[s] !== undefined);

  if (measured.length === 0) {
    parts.push('A first look across different skills, so the app can learn where to help most.');
  } else {
    const focus = [...ordered].sort((a, b) => b.weakness - a.weakness)[0];
    parts.push(`Today focuses on ${SKILLS[focus.skill].focusPhrase}, where recent results show the most room to grow.`);
  }

  const review = ordered.filter((c) => c.daysAway !== null && c.daysAway >= 3);
  if (review.length > 0) {
    const names = review.map((c) => ACTIVITIES[c.id].title).join(' and ');
    parts.push(`${names} ${review.length === 1 ? 'is' : 'are'} back for review after a few days away. Spaced practice helps skills stick.`);
  }

  if (lowMood) {
    parts.push('Your child said they were not feeling their best, so the plan is shorter and starts with a game.');
  } else {
    parts.push('It starts with a confident warm-up and ends with something fun.');
  }
  return parts.join(' ');
}

/** Marks the first unfinished plan item for `activityId` as done. */
export function markPlanItem(
  plan: DailyPlan | null,
  activityId: ActivityId,
  day: DayKey,
): { plan: DailyPlan | null; itemCompleted: boolean; planCompleted: boolean } {
  if (!plan || plan.day !== day || plan.completed) {
    return { plan, itemCompleted: false, planCompleted: false };
  }
  const index = plan.items.findIndex((item) => item.activityId === activityId && !item.done);
  if (index === -1) return { plan, itemCompleted: false, planCompleted: false };
  const items = plan.items.map((item, i) => (i === index ? { ...item, done: true } : item));
  const completed = items.every((item) => item.done);
  return { plan: { ...plan, items, completed }, itemCompleted: true, planCompleted: completed };
}

export function nextPlanItem(plan: DailyPlan | null): ActivityId | null {
  return plan?.items.find((item) => !item.done)?.activityId ?? null;
}
