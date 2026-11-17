import type { FocusSample } from './focus';
import type { DayKey } from '@/lib/date';
import type { PathState } from './path';

export type ActivityId =
  | 'trace'
  | 'sound-match'
  | 'say-it'
  | 'odd-one-out'
  | 'letter-sort'
  | 'letter-hunt'
  | 'memory'
  | 'rhyme'
  | 'syllables'
  | 'sound-boxes'
  | 'sight-words'
  | 'word-builder';

export type SkillId = 'letters' | 'sounds' | 'visual' | 'focus' | 'phonological' | 'words';

/** Difficulty level for an activity. 1 = gentle start, 3 = challenge. */
export type Level = 1 | 2 | 3;

export type Mood = 'great' | 'good' | 'okay' | 'tired' | 'upset';

export interface ActivityProgress {
  level: Level;
  sessions: number;
  /** Sessions finished at the current level, used to decide when to level up. */
  levelSessions: number;
  lastPlayed: DayKey | null;
  /** Accuracy (0–1) of the most recent sessions, newest last. */
  recent: number[];
  best: number;
}

export interface LetterProgress {
  attempts: number;
  /** Best trace score, 0–1. */
  best: number;
  /** Most recent trace score, 0–1. */
  last: number;
}

export interface SessionRecord {
  id: string;
  activityId: ActivityId;
  level: Level;
  /** Mean round score, 0–1. */
  accuracy: number;
  rounds: number;
  /** Rounds answered correctly on the first try. */
  firstTry: number;
  durationSec: number;
  startedAt: string;
  day: DayKey;
  /** How many times the child showed signs of struggling (streaks of misses, rushed taps). */
  struggles: number;
  stars: number;
  /** Mean seconds from a round appearing to the first answer (missing in older saves). */
  avgResponseSec?: number;
}

export interface PlanItem {
  activityId: ActivityId;
  done: boolean;
}

export interface DailyPlan {
  day: DayKey;
  items: PlanItem[];
  /** Plain-language explanation of why these activities were chosen (shown to parents). */
  reason: string;
  completed: boolean;
}

export interface StreakState {
  count: number;
  best: number;
  lastDay: DayKey | null;
}

export interface ProgressState {
  activities: Partial<Record<ActivityId, ActivityProgress>>;
  /** Mastery per skill area, 0–100. Missing means "not measured yet". */
  skills: Partial<Record<SkillId, number>>;
  /** Tracing results keyed by the exact glyph, e.g. "B" or "b". */
  letters: Record<string, LetterProgress>;
  sessions: SessionRecord[];
  stars: number;
  streak: StreakState;
  /** Badge id → ISO date earned. */
  badges: Record<string, string>;
  plan: DailyPlan | null;
  plansCompleted: number;
  /** Seconds of active use per day. */
  usage: Record<DayKey, number>;
  /** Extra minutes a parent granted on a given day. */
  bonusMinutes: Record<DayKey, number>;
  moods: Record<DayKey, Mood>;
  /**
   * How often two look-alike letters or words were mixed up, keyed "b|d" (sorted pair).
   * Reversals like these are a classic dyslexia signal worth showing to parents.
   */
  confusions: Record<string, number>;
  /** Learning Path progress: completed nodes and XP. */
  path: PathState;
  /** Feature tours this child has already seen. */
  toursSeen: Record<string, true>;
  /** Recent pronunciation checks from Say It Right, newest last. */
  speechChecks: SpeechCheck[];
  /** Formal speech and writing assessments, newest last. */
  assessments: Assessment[];
  /** Recent letters from Write & Score, newest last. */
  writing: LetterAttempt[];
  /** Focus helper readings (camera, opt-in), newest last. */
  focus: FocusSample[];
}

/** A word said aloud and how its sounds compared with the target. */
export interface SoundResult {
  word: string;
  /** 0–1 share of the word's sounds said correctly, or null when marked by an adult. */
  score: number | null;
  correct: boolean;
  heard?: string;
  /** Target sounds that were left out. */
  missed: string[];
  /** Target sounds said as another sound: [target, heard]. */
  changed: [string, string][];
}

export interface SpeechCheck extends SoundResult {
  day: DayKey;
}

/** One letter written in Write & Score. */
export interface LetterAttempt {
  letter: string;
  /** What the handwriting model read. */
  read: string;
  correct: boolean;
  /** How sure the model was that this is the letter asked for (0–1). */
  confidence: number;
  /** Set when the letter was written mirrored or upside down. */
  reversal: 'mirrored' | 'upside-down' | 'rotated' | null;
  seconds: number;
  day: DayKey;
}

/** Dyslexia-specific spelling errors, as classified by the original Write Test. */
export type SpellingError = 'reversal' | 'transposition' | 'omission' | 'insertion' | 'substitution' | 'blank';

/** A word written letter by letter in the Write Test. */
export interface SpellingResult {
  word: string;
  /** The letters as read from the handwriting (after any grown-up corrections). */
  written: string;
  /** 0–1 similarity to the target (edit distance). */
  accuracy: number;
  errors: SpellingError[];
  seconds: number;
}

interface AssessmentBase {
  id: string;
  takenAt: string;
  /** 'auto' when the device checked each answer, 'adult' when a grown-up marked them. */
  method: 'auto' | 'adult';
}

export interface SpeechAssessment extends AssessmentBase {
  kind: 'speech';
  items: SoundResult[];
}

export interface SpellingAssessment extends AssessmentBase {
  kind: 'spelling';
  items: SpellingResult[];
}

export type Assessment = SpeechAssessment | SpellingAssessment;

/** What an activity reports when a session ends. */
export interface SessionResult {
  activityId: ActivityId;
  level: Level;
  roundScores: number[];
  firstTry: number;
  durationSec: number;
  struggles: number;
  startedAt: string;
  /** Per-glyph trace scores (tracing only). */
  letterScores?: Record<string, number>;
  /** Mean seconds to first answer per round. */
  avgResponseSec?: number;
  /** Look-alike pairs the child mixed up, e.g. [["b", "d"]]. */
  confusions?: [string, string][];
}

export interface SessionOutcome {
  session: SessionRecord;
  starsEarned: number;
  levelChange: 'up' | 'down' | null;
  newLevel: Level;
  newBadges: string[];
  planItemCompleted: boolean;
  planCompleted: boolean;
  /** Learning Path nodes completed by this session, and the XP they earned. */
  pathNodesCompleted: string[];
  pathXp: number;
}
