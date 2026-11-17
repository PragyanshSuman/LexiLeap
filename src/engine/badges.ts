import { en, type TranslationKey } from '@/i18n/en';
import type { ProgressState, SessionRecord, SkillId } from './types';

export interface BadgeDefinition {
  id: string;
  title: string;
  emoji: string;
  description: string;
  /** `session` is the session that was just finished. */
  earned: (state: ProgressState, session: SessionRecord) => boolean;
}

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LOWER = UPPER.map((l) => l.toLowerCase());

const tracedAll = (state: ProgressState, glyphs: string[]) =>
  glyphs.every((g) => (state.letters[g]?.best ?? 0) >= 0.5);

const text = (id: string, part: 'title' | 'desc') => en[`badge_${id}_${part}` as TranslationKey];

const skillMaster = (skill: SkillId) => (state: ProgressState) => (state.skills[skill] ?? 0) >= 80;

export const BADGES: BadgeDefinition[] = [
  {
    id: 'first-steps',
    title: text('first-steps', 'title'),
    emoji: '👣',
    description: text('first-steps', 'desc'),
    earned: (s) => s.sessions.length >= 1,
  },
  {
    id: 'brave-learner',
    title: text('brave-learner', 'title'),
    emoji: '🦁',
    description: text('brave-learner', 'desc'),
    earned: (_s, session) => session.struggles > 0,
  },
  {
    id: 'perfect',
    title: text('perfect', 'title'),
    emoji: '💯',
    description: text('perfect', 'desc'),
    earned: (_s, session) => session.accuracy >= 0.999 && session.rounds >= 4,
  },
  {
    id: 'ten-sessions',
    title: text('ten-sessions', 'title'),
    emoji: '🐝',
    description: text('ten-sessions', 'desc'),
    earned: (s) => s.sessions.length >= 10,
  },
  {
    id: 'fifty-sessions',
    title: text('fifty-sessions', 'title'),
    emoji: '🚀',
    description: text('fifty-sessions', 'desc'),
    earned: (s) => s.sessions.length >= 50,
  },
  {
    id: 'streak-3',
    title: text('streak-3', 'title'),
    emoji: '🔥',
    description: text('streak-3', 'desc'),
    earned: (s) => s.streak.best >= 3,
  },
  {
    id: 'streak-7',
    title: text('streak-7', 'title'),
    emoji: '🗓️',
    description: text('streak-7', 'desc'),
    earned: (s) => s.streak.best >= 7,
  },
  {
    id: 'streak-30',
    title: text('streak-30', 'title'),
    emoji: '🏔️',
    description: text('streak-30', 'desc'),
    earned: (s) => s.streak.best >= 30,
  },
  {
    id: 'plan-1',
    title: text('plan-1', 'title'),
    emoji: '✅',
    description: text('plan-1', 'desc'),
    earned: (s) => s.plansCompleted >= 1,
  },
  {
    id: 'plan-10',
    title: text('plan-10', 'title'),
    emoji: '🏅',
    description: text('plan-10', 'desc'),
    earned: (s) => s.plansCompleted >= 10,
  },
  {
    id: 'stars-50',
    title: text('stars-50', 'title'),
    emoji: '⭐',
    description: text('stars-50', 'desc'),
    earned: (s) => s.stars >= 50,
  },
  {
    id: 'stars-250',
    title: text('stars-250', 'title'),
    emoji: '🌟',
    description: text('stars-250', 'desc'),
    earned: (s) => s.stars >= 250,
  },
  {
    id: 'stars-1000',
    title: text('stars-1000', 'title'),
    emoji: '🌌',
    description: text('stars-1000', 'desc'),
    earned: (s) => s.stars >= 1000,
  },
  {
    id: 'capitals',
    title: text('capitals', 'title'),
    emoji: '🔠',
    description: text('capitals', 'desc'),
    earned: (s) => tracedAll(s, UPPER),
  },
  {
    id: 'smalls',
    title: text('smalls', 'title'),
    emoji: '🔡',
    description: text('smalls', 'desc'),
    earned: (s) => tracedAll(s, LOWER),
  },
  { id: 'master-letters', title: text('master-letters', 'title'), emoji: '🖊️', description: text('master-letters', 'desc'), earned: skillMaster('letters') },
  { id: 'master-sounds', title: text('master-sounds', 'title'), emoji: '🔊', description: text('master-sounds', 'desc'), earned: skillMaster('sounds') },
  { id: 'master-visual', title: text('master-visual', 'title'), emoji: '🦅', description: text('master-visual', 'desc'), earned: skillMaster('visual') },
  { id: 'master-focus', title: text('master-focus', 'title'), emoji: '🎯', description: text('master-focus', 'desc'), earned: skillMaster('focus') },
  { id: 'master-phonological', title: text('master-phonological', 'title'), emoji: '🎶', description: text('master-phonological', 'desc'), earned: skillMaster('phonological') },
  { id: 'master-words', title: text('master-words', 'title'), emoji: '🧙', description: text('master-words', 'desc'), earned: skillMaster('words') },
];

export const BADGE_MAP: Record<string, BadgeDefinition> = Object.fromEntries(BADGES.map((b) => [b.id, b]));

/** Badge ids newly earned in `state` after `session`. */
export function newlyEarnedBadges(state: ProgressState, session: SessionRecord): string[] {
  return BADGES.filter((b) => !state.badges[b.id] && b.earned(state, session)).map((b) => b.id);
}
