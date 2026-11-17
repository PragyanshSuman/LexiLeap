import { en } from '@/i18n/en';
import type { ActivityId, Level, SkillId } from './types';

export interface ActivityMeta {
  id: ActivityId;
  title: string;
  tagline: string;
  emoji: string;
  color: string;
  skill: SkillId;
  /** Youngest age the activity is suggested for in the daily plan (always playable from Play). */
  minAge: number;
  /** Game-like activities make a good, fun finish to a daily plan. */
  isGame: boolean;
  /** Spoken when the activity starts. */
  instructions: string;
  /** Short description of each level, shown to parents. */
  levels: Record<Level, string>;
}

export interface SkillMeta {
  id: SkillId;
  label: string;
  emoji: string;
  /** Parent-facing description of what the skill is and why it matters. */
  description: string;
  /** Phrase used in plan explanations, e.g. "Today we focus on …". */
  focusPhrase: string;
}

export const SKILLS: Record<SkillId, SkillMeta> = {
  letters: {
    id: 'letters',
    label: en['skill_letters'],
    emoji: '✏️',
    description: 'Forming letters with the right strokes, in the right order and direction.',
    focusPhrase: 'forming letters correctly',
  },
  sounds: {
    id: 'sounds',
    label: en['skill_sounds'],
    emoji: '🔤',
    description: 'Linking letters to their names and sounds, and saying words out loud.',
    focusPhrase: 'linking letters and sounds',
  },
  visual: {
    id: 'visual',
    label: en['skill_visual'],
    emoji: '👀',
    description: 'Telling apart letters that look alike, such as b, d, p and q.',
    focusPhrase: 'telling look-alike letters apart',
  },
  focus: {
    id: 'focus',
    label: en['skill_focus'],
    emoji: '🧠',
    description: 'Sustained attention and working memory, which support reading fluency.',
    focusPhrase: 'attention and working memory',
  },
  phonological: {
    id: 'phonological',
    label: en['skill_phonological'],
    emoji: '🎵',
    description: 'Hearing rhymes, syllables and the single sounds in words: the foundation of reading.',
    focusPhrase: 'hearing rhymes, syllables and sounds',
  },
  words: {
    id: 'words',
    label: en['skill_words'],
    emoji: '📖',
    description: 'Recognising common sight words and building words from letters.',
    focusPhrase: 'reading and spelling words',
  },
};

export const SKILL_ORDER: SkillId[] = ['letters', 'sounds', 'visual', 'phonological', 'words', 'focus'];

export const ACTIVITIES: Record<ActivityId, ActivityMeta> = {
  trace: {
    id: 'trace',
    title: en['act_trace_title'],
    tagline: en['act_trace_tagline'],
    emoji: '✏️',
    color: '#3E7CB1',
    skill: 'letters',
    minAge: 4,
    isGame: false,
    instructions: en['act_trace_instructions'],
    levels: { 1: en['act_trace_level1'], 2: en['act_trace_level2'], 3: en['act_trace_level3'] },
  },
  'sound-match': {
    id: 'sound-match',
    title: en['act_sound-match_title'],
    tagline: en['act_sound-match_tagline'],
    emoji: '👂',
    color: '#C0692F',
    skill: 'sounds',
    minAge: 4,
    isGame: false,
    instructions: en['act_sound-match_instructions'],
    levels: { 1: en['act_sound-match_level1'], 2: en['act_sound-match_level2'], 3: en['act_sound-match_level3'] },
  },
  'say-it': {
    id: 'say-it',
    title: en['act_say-it_title'],
    tagline: en['act_say-it_tagline'],
    emoji: '🎤',
    color: '#B5487A',
    skill: 'sounds',
    minAge: 5,
    isGame: false,
    instructions: en['act_say-it_instructions'],
    levels: { 1: en['act_say-it_level1'], 2: en['act_say-it_level2'], 3: en['act_say-it_level3'] },
  },
  'odd-one-out': {
    id: 'odd-one-out',
    title: en['act_odd-one-out_title'],
    tagline: en['act_odd-one-out_tagline'],
    emoji: '🔍',
    color: '#2F8F7F',
    skill: 'visual',
    minAge: 4,
    isGame: true,
    instructions: en['act_odd-one-out_instructions'],
    levels: { 1: en['act_odd-one-out_level1'], 2: en['act_odd-one-out_level2'], 3: en['act_odd-one-out_level3'] },
  },
  'letter-sort': {
    id: 'letter-sort',
    title: en['act_letter-sort_title'],
    tagline: en['act_letter-sort_tagline'],
    emoji: '👾',
    color: '#7C3AED',
    skill: 'visual',
    minAge: 4,
    isGame: true,
    instructions: en['act_letter-sort_instructions'],
    levels: { 1: en['act_letter-sort_level1'], 2: en['act_letter-sort_level2'], 3: en['act_letter-sort_level3'] },
  },
  'letter-hunt': {
    id: 'letter-hunt',
    title: en['act_letter-hunt_title'],
    tagline: en['act_letter-hunt_tagline'],
    emoji: '🕵️',
    color: '#6A5BAE',
    skill: 'focus',
    minAge: 4,
    isGame: true,
    instructions: en['act_letter-hunt_instructions'],
    levels: { 1: en['act_letter-hunt_level1'], 2: en['act_letter-hunt_level2'], 3: en['act_letter-hunt_level3'] },
  },
  memory: {
    id: 'memory',
    title: en['act_memory_title'],
    tagline: en['act_memory_tagline'],
    emoji: '💡',
    color: '#C99A1E',
    skill: 'focus',
    minAge: 4,
    isGame: true,
    instructions: en['act_memory_instructions'],
    levels: { 1: en['act_memory_level1'], 2: en['act_memory_level2'], 3: en['act_memory_level3'] },
  },
  rhyme: {
    id: 'rhyme',
    title: en['act_rhyme_title'],
    tagline: en['act_rhyme_tagline'],
    emoji: '🎵',
    color: '#8C5BB0',
    skill: 'phonological',
    minAge: 4,
    isGame: true,
    instructions: en['act_rhyme_instructions'],
    levels: { 1: en['act_rhyme_level1'], 2: en['act_rhyme_level2'], 3: en['act_rhyme_level3'] },
  },
  syllables: {
    id: 'syllables',
    title: en['act_syllables_title'],
    tagline: en['act_syllables_tagline'],
    emoji: '🥁',
    color: '#D0584E',
    skill: 'phonological',
    minAge: 4,
    isGame: false,
    instructions: en['act_syllables_instructions'],
    levels: { 1: en['act_syllables_level1'], 2: en['act_syllables_level2'], 3: en['act_syllables_level3'] },
  },
  'sound-boxes': {
    id: 'sound-boxes',
    title: en['act_sound-boxes_title'],
    tagline: en['act_sound-boxes_tagline'],
    emoji: '🔲',
    color: '#2F7D95',
    skill: 'phonological',
    minAge: 5,
    isGame: false,
    instructions: en['act_sound-boxes_instructions'],
    levels: { 1: en['act_sound-boxes_level1'], 2: en['act_sound-boxes_level2'], 3: en['act_sound-boxes_level3'] },
  },
  'sight-words': {
    id: 'sight-words',
    title: en['act_sight-words_title'],
    tagline: en['act_sight-words_tagline'],
    emoji: '🥷',
    color: '#B85270',
    skill: 'words',
    minAge: 5,
    isGame: true,
    instructions: en['act_sight-words_instructions'],
    levels: { 1: en['act_sight-words_level1'], 2: en['act_sight-words_level2'], 3: en['act_sight-words_level3'] },
  },
  'word-builder': {
    id: 'word-builder',
    title: en['act_word-builder_title'],
    tagline: en['act_word-builder_tagline'],
    emoji: '🧩',
    color: '#4E8B3A',
    skill: 'words',
    minAge: 6,
    isGame: false,
    instructions: en['act_word-builder_instructions'],
    levels: { 1: en['act_word-builder_level1'], 2: en['act_word-builder_level2'], 3: en['act_word-builder_level3'] },
  },
};

export const ACTIVITY_ORDER: ActivityId[] = [
  'trace',
  'sound-match',
  'say-it',
  'odd-one-out',
  'letter-sort',
  'letter-hunt',
  'memory',
  'rhyme',
  'syllables',
  'sound-boxes',
  'sight-words',
  'word-builder',
];

export function activitiesForSkill(skill: SkillId): ActivityId[] {
  return ACTIVITY_ORDER.filter((id) => ACTIVITIES[id].skill === skill);
}

export function isActivityId(value: unknown): value is ActivityId {
  return typeof value === 'string' && value in ACTIVITIES;
}
