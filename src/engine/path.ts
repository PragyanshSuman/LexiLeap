import { daysBetween, type DayKey } from '@/lib/date';
import type { ActivityId, Level, ProgressState, SessionRecord } from './types';

/**
 * The Learning Path ("DysPath"): units of nodes on a map. Each node is a goal on one
 * activity: play it (at a minimum level) and reach a target accuracy. Nodes unlock as
 * their prerequisites are completed; some come back for spaced review.
 */
export type UnitId = 'see' | 'hear' | 'read' | 'master';
export type NodeVariant = 'intro' | 'practice' | 'challenge' | 'master' | 'bonus';
export type NodeStatus = 'locked' | 'available' | 'review' | 'completed';

export interface PathUnit {
  id: UnitId;
  icon: string;
  color: string;
}

export interface PathNode {
  id: string;
  unit: UnitId;
  activityId: ActivityId;
  variant: NodeVariant;
  /** Accuracy (0–1) needed in one session to complete the node. */
  target: number;
  /** The activity must be played at this level or higher. */
  minLevel: Level;
  prerequisites: string[];
  /** Completed nodes with a weaker best score come back for review after this many days. */
  reviewAfterDays?: number;
}

export interface PathNodeProgress {
  completedOn: DayKey;
  best: number;
}

export interface PathState {
  nodes: Record<string, PathNodeProgress>;
  xp: number;
}

export const XP_PER_LEVEL = 200;
const BASE_XP: Record<NodeVariant, number> = { intro: 15, practice: 15, challenge: 20, master: 30, bonus: 40 };
/** A review that's practised again earns a little XP too. */
const REVIEW_XP = 5;
/** Below this best score, completed nodes with a review interval come back. */
const REVIEW_BELOW = 0.85;

export const PATH_UNITS: PathUnit[] = [
  { id: 'see', icon: '👁️', color: '#5B6EC8' },
  { id: 'hear', icon: '🔊', color: '#2E8B7A' },
  { id: 'read', icon: '📖', color: '#D97706' },
  { id: 'master', icon: '🏆', color: '#7C3AED' },
];

const node = (
  id: string,
  unit: UnitId,
  activityId: ActivityId,
  variant: NodeVariant,
  prerequisites: string[] = [],
  options: { target?: number; minLevel?: Level; reviewAfterDays?: number } = {},
): PathNode => ({
  id,
  unit,
  activityId,
  variant,
  prerequisites,
  target: options.target ?? (variant === 'master' || variant === 'bonus' ? 0.85 : variant === 'challenge' ? 0.75 : 0.6),
  minLevel: options.minLevel ?? (variant === 'master' || variant === 'bonus' ? 3 : variant === 'challenge' ? 2 : 1),
  reviewAfterDays: options.reviewAfterDays,
});

export const PATH_NODES: PathNode[] = [
  // See & Recognise
  node('see-1', 'see', 'odd-one-out', 'intro'),
  node('see-2', 'see', 'trace', 'intro'),
  node('see-3', 'see', 'letter-sort', 'intro', ['see-1']),
  node('see-4', 'see', 'trace', 'practice', ['see-2'], { target: 0.7 }),
  node('see-5', 'see', 'odd-one-out', 'challenge', ['see-3', 'see-4'], { reviewAfterDays: 3 }),
  // Hear & Say
  node('hear-1', 'hear', 'sound-match', 'intro', ['see-1']),
  node('hear-2', 'hear', 'rhyme', 'intro', ['see-1']),
  node('hear-3', 'hear', 'syllables', 'intro', ['hear-2']),
  node('hear-4', 'hear', 'say-it', 'intro', ['hear-1']),
  node('hear-5', 'hear', 'sound-boxes', 'challenge', ['hear-3', 'hear-4'], { reviewAfterDays: 3 }),
  // Read & Write
  node('read-1', 'read', 'sight-words', 'intro', ['hear-1']),
  node('read-2', 'read', 'memory', 'intro', ['see-3']),
  node('read-3', 'read', 'word-builder', 'intro', ['read-1']),
  node('read-4', 'read', 'trace', 'challenge', ['see-4']),
  node('read-5', 'read', 'sight-words', 'challenge', ['read-3'], { reviewAfterDays: 3 }),
  // Master & Shine
  node('master-1', 'master', 'odd-one-out', 'master', ['see-5'], { reviewAfterDays: 7 }),
  node('master-2', 'master', 'rhyme', 'master', ['hear-5'], { reviewAfterDays: 7 }),
  node('master-3', 'master', 'sound-boxes', 'master', ['hear-5'], { reviewAfterDays: 7 }),
  node('master-4', 'master', 'word-builder', 'master', ['read-5'], { reviewAfterDays: 7 }),
  node('master-5', 'master', 'memory', 'bonus', ['master-1', 'master-4']),
];

export const NODE_MAP: Record<string, PathNode> = Object.fromEntries(PATH_NODES.map((n) => [n.id, n]));

export function emptyPath(): PathState {
  return { nodes: {}, xp: 0 };
}

export function nodeXp(node: PathNode): number {
  return BASE_XP[node.variant];
}

export function nodeStatus(path: PathState, node: PathNode, today: DayKey): NodeStatus {
  const done = path.nodes[node.id];
  if (done) {
    const due = node.reviewAfterDays !== undefined && done.best < REVIEW_BELOW && daysBetween(done.completedOn, today) >= node.reviewAfterDays;
    return due ? 'review' : 'completed';
  }
  return node.prerequisites.every((p) => path.nodes[p]) ? 'available' : 'locked';
}

export function pathLevel(xp: number): { level: number; inLevel: number; fraction: number } {
  return { level: Math.floor(xp / XP_PER_LEVEL) + 1, inLevel: xp % XP_PER_LEVEL, fraction: (xp % XP_PER_LEVEL) / XP_PER_LEVEL };
}

export function unitNodes(unit: UnitId): PathNode[] {
  return PATH_NODES.filter((n) => n.unit === unit);
}

/**
 * Applies a finished session to the path: completes the first open node for that activity
 * whose goal was met (or refreshes a node due for review). Returns the nodes completed and XP earned.
 */
export function applyPathSession(
  path: PathState,
  session: Pick<SessionRecord, 'activityId' | 'level' | 'accuracy' | 'day'>,
): { path: PathState; completed: string[]; xpEarned: number } {
  const candidates = PATH_NODES.filter((n) => n.activityId === session.activityId);
  for (const n of candidates) {
    const status = nodeStatus(path, n, session.day);
    if (status !== 'available' && status !== 'review') continue;
    if (session.level < n.minLevel || session.accuracy < n.target) continue;
    const previous = path.nodes[n.id];
    const xpEarned = status === 'review' ? REVIEW_XP : nodeXp(n) + Math.round(session.accuracy * 10);
    return {
      path: {
        xp: path.xp + xpEarned,
        nodes: { ...path.nodes, [n.id]: { completedOn: session.day, best: Math.max(previous?.best ?? 0, session.accuracy) } },
      },
      completed: [n.id],
      xpEarned,
    };
  }
  return { path, completed: [], xpEarned: 0 };
}

/** The node to open next: today's plan first, then any review, then the first available node. */
export function suggestedNode(progress: ProgressState, today: DayKey): PathNode | null {
  const path = progress.path;
  const open = PATH_NODES.filter((n) => {
    const s = nodeStatus(path, n, today);
    return s === 'available' || s === 'review';
  });
  const planned = progress.plan?.day === today ? progress.plan.items.filter((i) => !i.done).map((i) => i.activityId) : [];
  return open.find((n) => planned.includes(n.activityId)) ?? open.find((n) => nodeStatus(path, n, today) === 'review') ?? open[0] ?? null;
}
