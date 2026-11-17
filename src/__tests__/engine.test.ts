import { choiceRoundScore, emptyActivityProgress, MISSES_BEFORE_BREAK, nextLevel, starsFor, updateMastery } from '@/engine/adaptive';
import { applyPathSession, NODE_MAP, PATH_NODES } from '@/engine/path';
import { ACTIVITY_ORDER } from '@/engine/catalog';
import { buildDailyPlan, markPlanItem } from '@/engine/plan';
import { applySession, emptyProgress, isOverLimit, PLAN_BONUS_STARS, topConfusions } from '@/engine/progress';
import { currentStreak, emptyStreak, recordStreakDay } from '@/engine/streak';
import type { ActivityId, ProgressState, SessionResult } from '@/engine/types';
import { addDays, daysBetween, dayKey } from '@/lib/date';

const DAY = '2026-10-30';

function result(activityId: ActivityId, scores: number[], overrides: Partial<SessionResult> = {}): SessionResult {
  return {
    activityId,
    level: 1,
    roundScores: scores,
    firstTry: scores.filter((s) => s === 1).length,
    durationSec: 60,
    struggles: 0,
    startedAt: `${DAY}T10:00:00.000Z`,
    ...overrides,
  };
}

let counter = 0;
const ctx = (day = DAY) => ({ id: `s${++counter}`, day, nowIso: `${day}T10:00:00.000Z` });

describe('dates', () => {
  it('counts days across month and year boundaries', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-03-01', '2026-02-27')).toBe(-2);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('adaptive levels', () => {
  it('levels up straight away after an excellent session', () => {
    expect(nextLevel(emptyActivityProgress(), 1, 0)).toEqual({ level: 2, change: 'up' });
  });

  it('needs two strong sessions in a row otherwise', () => {
    const p = emptyActivityProgress();
    expect(nextLevel(p, 0.88, 0).change).toBeNull();
    expect(nextLevel({ ...p, levelSessions: 1, recent: [0.88] }, 0.88, 0)).toEqual({ level: 2, change: 'up' });
    expect(nextLevel({ ...p, levelSessions: 1, recent: [0.6] }, 0.88, 0).change).toBeNull();
  });

  it('steps down on a weak or struggling session, never below 1 or above 3', () => {
    expect(nextLevel({ ...emptyActivityProgress(), level: 2 }, 0.4, 0)).toEqual({ level: 1, change: 'down' });
    expect(nextLevel({ ...emptyActivityProgress(), level: 2 }, 0.6, 2)).toEqual({ level: 1, change: 'down' });
    expect(nextLevel(emptyActivityProgress(), 0, 5)).toEqual({ level: 1, change: null });
    expect(nextLevel({ ...emptyActivityProgress(), level: 3 }, 1, 0)).toEqual({ level: 3, change: null });
  });

  it('weights mastery by level so 100 needs the hardest level', () => {
    expect(updateMastery(undefined, 1, 1)).toBe(70);
    expect(updateMastery(undefined, 1, 3)).toBe(100);
    expect(updateMastery(50, 1, 3)).toBe(65);
  });

  it('awards stars and round scores fairly', () => {
    expect(starsFor(0.95)).toBe(3);
    expect(starsFor(0.75)).toBe(2);
    expect(starsFor(0)).toBe(1);
    expect(choiceRoundScore(0, false)).toBe(1);
    expect(choiceRoundScore(1, false)).toBe(0.5);
    expect(choiceRoundScore(2, true)).toBe(0);
  });
});

describe('streaks', () => {
  it('grows on consecutive days and restarts after a gap', () => {
    let s = recordStreakDay(emptyStreak(), '2026-10-01');
    s = recordStreakDay(s, '2026-10-01');
    s = recordStreakDay(s, '2026-10-02');
    s = recordStreakDay(s, '2026-10-03');
    expect(s.count).toBe(3);
    s = recordStreakDay(s, '2026-10-06');
    expect(s).toEqual({ count: 1, best: 3, lastDay: '2026-10-06' });
  });

  it('shows a streak as alive until a full day is missed', () => {
    const s = { count: 4, best: 4, lastDay: '2026-10-05' };
    expect(currentStreak(s, '2026-10-05')).toBe(4);
    expect(currentStreak(s, '2026-10-06')).toBe(4);
    expect(currentStreak(s, '2026-10-07')).toBe(0);
  });
});

describe('daily plan', () => {
  const options = { day: DAY, profileId: 'kid-1', age: 7, goal: 4 };

  it('is deterministic, sized to the goal and has no duplicates', () => {
    const a = buildDailyPlan(emptyProgress(), options);
    const b = buildDailyPlan(emptyProgress(), options);
    expect(a).toEqual(b);
    expect(a.items).toHaveLength(4);
    expect(new Set(a.items.map((i) => i.activityId)).size).toBe(4);
    expect(a.reason.length).toBeGreaterThan(20);
  });

  it('spreads across different skill areas', () => {
    const plan = buildDailyPlan(emptyProgress(), { ...options, goal: 6 });
    const { ACTIVITIES } = jest.requireActual('@/engine/catalog');
    const skills = plan.items.map((i) => ACTIVITIES[i.activityId].skill);
    expect(new Set(skills).size).toBe(6);
  });

  it('targets the weakest skill', () => {
    const state: ProgressState = {
      ...emptyProgress(),
      skills: { letters: 90, sounds: 90, visual: 90, focus: 90, phonological: 10, words: 90 },
    };
    const plan = buildDailyPlan(state, { ...options, goal: 3 });
    const ids = plan.items.map((i) => i.activityId);
    const { ACTIVITIES } = jest.requireActual('@/engine/catalog');
    expect(ids.some((id) => ACTIVITIES[id].skill === 'phonological')).toBe(true);
    expect(plan.reason).toContain('rhymes, syllables and sounds');
  });

  it('respects age and shortens when the child feels low', () => {
    const young = buildDailyPlan(emptyProgress(), { ...options, age: 4, goal: 6 });
    expect(young.items.map((i) => i.activityId)).not.toContain('word-builder');
    const tired = buildDailyPlan(emptyProgress(), { ...options, mood: 'tired' });
    expect(tired.items).toHaveLength(3);
  });

  it('marks items done once each and completes the plan', () => {
    let plan = buildDailyPlan(emptyProgress(), { ...options, goal: 3 });
    for (const item of [...plan.items]) {
      const r = markPlanItem(plan, item.activityId, DAY);
      expect(r.itemCompleted).toBe(true);
      plan = r.plan!;
    }
    expect(plan.completed).toBe(true);
    expect(markPlanItem(plan, plan.items[0].activityId, DAY).itemCompleted).toBe(false);
  });

  it('never marks an item on a plan from another day', () => {
    const plan = buildDailyPlan(emptyProgress(), options);
    expect(markPlanItem(plan, plan.items[0].activityId, addDays(DAY, 1)).itemCompleted).toBe(false);
  });
});

describe('applySession', () => {
  it('records the session, stars, mastery, streak and first badge', () => {
    const { state, outcome } = applySession(emptyProgress(), result('rhyme', [1, 1, 0.5, 1]), ctx());
    expect(outcome.session.accuracy).toBeCloseTo(0.875);
    expect(outcome.starsEarned).toBe(2);
    expect(state.stars).toBe(2);
    expect(state.skills.phonological).toBeGreaterThan(0);
    expect(state.streak.count).toBe(1);
    expect(outcome.newBadges).toContain('first-steps');
    expect(state.badges['first-steps']).toBeDefined();
    expect(state.activities.rhyme?.sessions).toBe(1);
  });

  it('levels up after an excellent session and reports it', () => {
    const { state, outcome } = applySession(emptyProgress(), result('rhyme', [1, 1, 1, 1, 1]), ctx());
    expect(outcome.levelChange).toBe('up');
    expect(state.activities.rhyme?.level).toBe(2);
    expect(state.activities.rhyme?.levelSessions).toBe(0);
  });

  it('reports a level change when a session was eased mid-way', () => {
    const start = emptyProgress();
    start.activities.rhyme = { ...emptyActivityProgress(), level: 2 };
    const { outcome } = applySession(start, result('rhyme', [0.6, 0.7], { level: 1 }), ctx());
    expect(outcome.newLevel).toBe(1);
    expect(outcome.levelChange).toBe('down');
  });

  it('adds the plan bonus when the last plan item is finished', () => {
    let state: ProgressState = { ...emptyProgress(), plan: buildDailyPlan(emptyProgress(), { day: DAY, profileId: 'k', age: 7, goal: 2 }) };
    const [first, second] = state.plan!.items.map((i) => i.activityId);
    state = applySession(state, result(first, [1, 0]), ctx()).state;
    const { state: after, outcome } = applySession(state, result(second, [0, 0]), ctx());
    expect(outcome.planCompleted).toBe(true);
    expect(outcome.starsEarned).toBe(1 + PLAN_BONUS_STARS);
    expect(after.plansCompleted).toBe(1);
    expect(outcome.newBadges).toContain('plan-1');
  });

  it('stores per-letter tracing results', () => {
    const { state } = applySession(emptyProgress(), result('trace', [0.8], { letterScores: { B: 0.8 } }), ctx());
    const again = applySession(state, result('trace', [0.6], { letterScores: { B: 0.6 } }), ctx()).state;
    expect(again.letters.B).toEqual({ attempts: 2, best: 0.8, last: 0.6 });
  });

  it('counts look-alike mix-ups regardless of order and keeps response times', () => {
    const first = applySession(
      emptyProgress(),
      result('odd-one-out', [0, 1], { confusions: [['b', 'd'], ['d', 'b'], ['p', 'q']], avgResponseSec: 2.345 }),
      ctx(),
    );
    expect(first.state.confusions).toEqual({ 'b|d': 2, 'p|q': 1 });
    expect(first.outcome.session.avgResponseSec).toBe(2.3);
    const second = applySession(first.state, result('letter-hunt', [1], { confusions: [['d', 'b']] }), ctx()).state;
    expect(topConfusions(second)[0]).toEqual({ pair: ['b', 'd'], count: 3 });
  });

  it('awards brave learner for finishing despite struggles', () => {
    const { outcome } = applySession(emptyProgress(), result('memory', [0, 1, 0], { struggles: 1 }), ctx());
    expect(outcome.newBadges).toContain('brave-learner');
  });
});

describe('screen time', () => {
  it('compares usage with the limit plus any bonus', () => {
    const state = { ...emptyProgress(), usage: { [DAY]: 30 * 60 }, bonusMinutes: { [DAY]: 15 } };
    expect(isOverLimit(null, state, DAY)).toBe(false);
    expect(isOverLimit(30, { ...state, bonusMinutes: {} }, DAY)).toBe(true);
    expect(isOverLimit(30, state, DAY)).toBe(false);
  });
});

describe('catalog', () => {
  it('lists every activity exactly once', () => {
    expect(new Set(ACTIVITY_ORDER).size).toBe(14);
  });
});

describe('parent level ceiling and struggle sensitivity', () => {
  const strong = () => ({ ...emptyActivityProgress(), level: 2 as const, levelSessions: 1, recent: [0.95] });

  it('never levels up past the ceiling, and brings a child above it back down', () => {
    expect(nextLevel(strong(), 1, 0, 2)).toEqual({ level: 2, change: null });
    expect(nextLevel(strong(), 1, 0, 3)).toEqual({ level: 3, change: 'up' });
    expect(nextLevel({ ...emptyActivityProgress(), level: 3 }, 0.8, 0, 1)).toEqual({ level: 1, change: 'down' });
  });

  it('counts Learning Path goals at the ceiling, so the path never gets stuck', () => {
    const node = NODE_MAP['master-1'];
    expect(node.minLevel).toBe(3);
    const session = { activityId: node.activityId, level: 1 as const, accuracy: 0.95, day: DAY };
    // Everything else done (well enough not to come back for review), so only master-1 is open for this activity.
    const done = PATH_NODES.filter((n) => n.id !== 'master-1').map((n) => [n.id, { completedOn: DAY, best: 1 }]);
    const unlocked = { nodes: Object.fromEntries(done), xp: 0 };
    expect(applyPathSession(unlocked, session).completed).toEqual([]);
    expect(applyPathSession(unlocked, session, 1).completed).toEqual(['master-1']);
  });

  it('steps in sooner when a parent asks for quick help', () => {
    expect(MISSES_BEFORE_BREAK.quick).toBeLessThan(MISSES_BEFORE_BREAK.balanced);
    expect(MISSES_BEFORE_BREAK.gentle).toBeGreaterThan(MISSES_BEFORE_BREAK.balanced);
  });
});
