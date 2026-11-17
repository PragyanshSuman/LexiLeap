import { ACTIVITIES } from '@/engine/catalog';
import {
  applyPathSession,
  emptyPath,
  NODE_MAP,
  nodeStatus,
  PATH_NODES,
  PATH_UNITS,
  pathLevel,
  suggestedNode,
  unitNodes,
  XP_PER_LEVEL,
} from '@/engine/path';
import { applySession, emptyProgress } from '@/engine/progress';
import type { ActivityId, Level } from '@/engine/types';
import { addDays } from '@/lib/date';

const DAY = '2026-10-31';
const play = (activityId: ActivityId, accuracy: number, level: Level = 1, day = DAY) => ({ activityId, accuracy, level, day });

describe('learning path curriculum', () => {
  it('is well formed: unique ids, known activities, prerequisites that exist and come first', () => {
    expect(new Set(PATH_NODES.map((n) => n.id)).size).toBe(PATH_NODES.length);
    PATH_NODES.forEach((n, i) => {
      expect(ACTIVITIES[n.activityId]).toBeDefined();
      for (const p of n.prerequisites) {
        expect(NODE_MAP[p]).toBeDefined();
        expect(PATH_NODES.findIndex((x) => x.id === p)).toBeLessThan(i);
      }
    });
    PATH_UNITS.forEach((u) => expect(unitNodes(u.id).length).toBeGreaterThanOrEqual(5));
  });

  it('can be completed from start to finish', () => {
    let path = emptyPath();
    for (let pass = 0; pass < PATH_NODES.length; pass++) {
      for (const n of PATH_NODES) {
        if (nodeStatus(path, n, DAY) === 'available') path = applyPathSession(path, play(n.activityId, 1, 3)).path;
      }
    }
    expect(Object.keys(path.nodes)).toHaveLength(PATH_NODES.length);
  });
});

describe('node status and completion', () => {
  it('starts with only nodes that have no prerequisites available', () => {
    const open = PATH_NODES.filter((n) => nodeStatus(emptyPath(), n, DAY) === 'available').map((n) => n.id);
    expect(open).toEqual(['see-1', 'see-2']);
  });

  it('completes a node when the goal is met, unlocking the next ones', () => {
    const { path, completed, xpEarned } = applyPathSession(emptyPath(), play('odd-one-out', 0.8));
    expect(completed).toEqual(['see-1']);
    expect(xpEarned).toBe(15 + 8);
    expect(nodeStatus(path, NODE_MAP['see-3'], DAY)).toBe('available');
    expect(nodeStatus(path, NODE_MAP['hear-1'], DAY)).toBe('available');
  });

  it('does not complete a node below the target or minimum level', () => {
    expect(applyPathSession(emptyPath(), play('odd-one-out', 0.5)).completed).toEqual([]);
    let path = applyPathSession(emptyPath(), play('odd-one-out', 1)).path;
    path = applyPathSession(path, play('letter-sort', 1)).path;
    path = applyPathSession(path, play('trace', 1)).path;
    path = applyPathSession(path, play('trace', 1)).path;
    // see-5 is a challenge: level 2 or higher is required.
    expect(applyPathSession(path, play('odd-one-out', 1, 1)).completed).toEqual([]);
    expect(applyPathSession(path, play('odd-one-out', 1, 2)).completed).toEqual(['see-5']);
  });

  it('brings weaker challenge nodes back for review and rewards the review', () => {
    let path = emptyPath();
    for (const id of ['odd-one-out', 'letter-sort', 'trace', 'trace'] as ActivityId[]) path = applyPathSession(path, play(id, 1)).path;
    path = applyPathSession(path, play('odd-one-out', 0.8, 2)).path;
    expect(nodeStatus(path, NODE_MAP['see-5'], DAY)).toBe('completed');
    const later = addDays(DAY, 3);
    expect(nodeStatus(path, NODE_MAP['see-5'], later)).toBe('review');
    const review = applyPathSession(path, play('odd-one-out', 0.95, 2, later));
    expect(review.completed).toEqual(['see-5']);
    expect(review.xpEarned).toBe(5);
    expect(nodeStatus(review.path, NODE_MAP['see-5'], addDays(later, 10))).toBe('completed');
  });

  it('computes XP levels', () => {
    expect(pathLevel(0)).toEqual({ level: 1, inLevel: 0, fraction: 0 });
    expect(pathLevel(XP_PER_LEVEL + 50)).toEqual({ level: 2, inLevel: 50, fraction: 0.25 });
  });
});

describe('path in sessions', () => {
  it('records path completion in the session outcome', () => {
    const { state, outcome } = applySession(
      emptyProgress(),
      { activityId: 'trace', level: 1, roundScores: [1, 1, 1], firstTry: 3, durationSec: 30, struggles: 0, startedAt: `${DAY}T09:00:00Z` },
      { id: 'a', day: DAY, nowIso: `${DAY}T09:00:00Z` },
    );
    expect(outcome.pathNodesCompleted).toEqual(['see-2']);
    expect(outcome.pathXp).toBe(25);
    expect(state.path.xp).toBe(25);
  });

  it('suggests a node from today’s plan first', () => {
    const progress = { ...emptyProgress(), plan: { day: DAY, items: [{ activityId: 'trace' as ActivityId, done: false }], reason: '', completed: false } };
    expect(suggestedNode(progress, DAY)?.id).toBe('see-2');
    expect(suggestedNode(emptyProgress(), DAY)?.id).toBe('see-1');
  });
});
