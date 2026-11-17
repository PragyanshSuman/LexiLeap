import type { ActivityId } from '@/engine/types';
import { letterHunt } from './letterHunt';
import { letterSort } from './letterSort';
import { memory } from './memory';
import { oddOneOut } from './oddOneOut';
import { rhyme } from './rhyme';
import { sayIt } from './sayIt';
import { sightWords } from './sightWords';
import { soundBoxes } from './soundBoxes';
import { soundMatch } from './soundMatch';
import { syllables } from './syllables';
import { trace } from './trace/TraceRound';
import type { ActivityDefinition } from './types';
import { wordBuilder } from './wordBuilder';

// Each definition is typed by its own round shape; the runner treats rounds as opaque.
export const ACTIVITY_DEFINITIONS: Record<ActivityId, ActivityDefinition<any>> = {
  trace,
  'sound-match': soundMatch,
  'say-it': sayIt,
  'odd-one-out': oddOneOut,
  'letter-sort': letterSort,
  'letter-hunt': letterHunt,
  memory,
  rhyme,
  syllables,
  'sound-boxes': soundBoxes,
  'sight-words': sightWords,
  'word-builder': wordBuilder,
};
