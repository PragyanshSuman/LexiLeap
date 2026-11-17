import type { ComponentType } from 'react';
import type { ImageSourcePropType } from 'react-native';
import type { TourStep } from '@/components/FeatureTour';
import type { ActivityMeta } from '@/engine/catalog';
import type { Level, ProgressState } from '@/engine/types';
import type { Rng } from '@/lib/random';

export interface GenerateContext {
  level: Level;
  rng: Rng;
  progress: ProgressState;
  /** Optional focus chosen by the child, e.g. a specific letter to trace. */
  focus?: string;
}

export interface RoundAnswer {
  correct: boolean;
  /** 0–1. Defaults from the number of attempts when omitted. */
  score?: number;
  /** When true the round ends now, whatever the result (no retry). */
  final?: boolean;
  /** Tracing only: the glyph that was traced. */
  glyph?: string;
  /** Look-alike pairs mixed up in this answer, as [expected, chosen]. */
  confusions?: [string, string][];
}

export interface RoundProps<R> {
  round: R;
  level: Level;
  /** Wrong attempts so far in this round. Changes when the child should try again. */
  attempt: number;
  /** True once attempts run out: show the right answer. */
  revealed: boolean;
  /** True while feedback is showing; ignore input. */
  disabled: boolean;
  onAnswer: (answer: RoundAnswer) => void;
  /** Session score so far (100 per first-try answer), for games that show one. */
  score: number;
  /** Correct answers in a row, for games that show a combo. */
  combo: number;
  /** The activity's colour: every button inside a round uses it, so each activity looks like itself. */
  accent: string;
}

/** An activity's own backdrop, as in the original games (e.g. Rhyme Time's night sky). */
export interface Stage {
  colors?: [string, string];
  image?: ImageSourcePropType;
  /** Light text and controls on top of a dark stage. */
  dark?: boolean;
}

export interface ActivityDefinition<R> {
  meta: ActivityMeta;
  roundsPerSession: number;
  /** Wrong attempts allowed before the answer is revealed. */
  maxAttempts: number;
  generate: (ctx: GenerateContext) => R[];
  /** Spoken at the start of each round and when the child taps "hear it again". */
  prompt: (round: R) => string;
  /** Spoken when the answer is revealed after the last attempt, e.g. "It was the letter b." */
  reveal?: (round: R) => string;
  /**
   * Whether time-to-first-answer is a meaningful response time for this activity.
   * Off where rounds include watching or speaking time (memory, tracing, reading aloud).
   */
  timesResponses?: boolean;
  stage?: Stage;
  /** The activity's own first-visit tour; a general one is used when absent. */
  tour?: TourStep[];
  Round: ComponentType<RoundProps<R>>;
}
