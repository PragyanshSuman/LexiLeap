import { distance, distanceToPolyline, resample, type Point } from './geometry';
import { glyphStrokes } from './glyphs';

/** All distances are in glyph units (the glyph box is 100 wide). */
export const CHECKPOINT_SPACING = 5;
/** How close the finger must come to a checkpoint to collect it. */
export const HIT_TOLERANCE = 13;
/**
 * The last checkpoint of a stroke needs a closer touch, so a stroke only completes at its
 * real end, not a little early while the finger is still travelling along it.
 */
export const END_TOLERANCE = 9;
/** Further than this from the stroke counts as going off the path. */
export const OFF_PATH_TOLERANCE = 17;
/** How close to a stroke's start (or resume point) a touch must begin. */
export const START_TOLERANCE = 20;
/** How many checkpoints ahead the finger may skip (fast but accurate moves). */
const LOOKAHEAD = 4;
/** Long finger jumps between move events are filled in at this spacing. */
const INTERPOLATION_STEP = 2;

export interface TraceGuide {
  /** The original stroke polylines, for drawing and off-path checks. */
  strokes: Point[][];
  /** Evenly spaced checkpoints per stroke, which must be collected in order. */
  checkpoints: Point[][];
}

export interface TracerState {
  strokeIndex: number;
  /** Next checkpoint to collect in the current stroke. */
  checkpoint: number;
  /** True while a finger is on the canvas. */
  fingerDown: boolean;
  /** True while the finger is following the path (collecting checkpoints). */
  active: boolean;
  done: boolean;
  lastPoint: Point | null;
  samples: number;
  offPath: number;
  /** Times the finger lifted part-way through a stroke. */
  lifts: number;
  /** Touches that began away from where the stroke starts. */
  wrongStarts: number;
}

export function buildGuide(glyph: string): TraceGuide {
  const strokes = glyphStrokes(glyph);
  return { strokes, checkpoints: strokes.map((s) => resample(s, CHECKPOINT_SPACING)) };
}

export function initialTracerState(): TracerState {
  return {
    strokeIndex: 0,
    checkpoint: 0,
    fingerDown: false,
    active: false,
    done: false,
    lastPoint: null,
    samples: 0,
    offPath: 0,
    lifts: 0,
    wrongStarts: 0,
  };
}

/** Where the child should put their finger next (start of stroke, or where they left off). */
export function nextTarget(guide: TraceGuide, state: TracerState): Point | null {
  if (state.done) return null;
  return guide.checkpoints[state.strokeIndex][state.checkpoint] ?? null;
}

export function touchStart(guide: TraceGuide, state: TracerState, p: Point): TracerState {
  const target = nextTarget(guide, state);
  if (!target) return state;
  if (distance(p, target) > START_TOLERANCE) {
    return { ...state, fingerDown: true, active: false, wrongStarts: state.wrongStarts + 1, lastPoint: p };
  }
  return advance(guide, { ...state, fingerDown: true, active: true, lastPoint: p }, p);
}

export function touchMove(guide: TraceGuide, state: TracerState, p: Point): TracerState {
  if (!state.fingerDown || state.done) return state;
  if (!state.active) {
    // Sliding onto the start of the next stroke (or back to where they left off) picks it up
    // without lifting, e.g. going back up the stem of b before drawing the bowl.
    const target = nextTarget(guide, state);
    if (!target || distance(p, target) > HIT_TOLERANCE) return { ...state, lastPoint: p };
    return advance(guide, { ...state, active: true, lastPoint: p }, p);
  }
  let next = state;
  const from = state.lastPoint ?? p;
  const gap = distance(from, p);
  const steps = Math.max(1, Math.ceil(gap / INTERPOLATION_STEP));
  for (let i = 1; i <= steps && next.active && !next.done; i++) {
    const t = i / steps;
    const q = { x: from.x + (p.x - from.x) * t, y: from.y + (p.y - from.y) * t };
    next = advance(guide, next, q);
  }
  return { ...next, lastPoint: p };
}

export function touchEnd(state: TracerState): TracerState {
  const midStroke = state.active && state.checkpoint > 0 && !state.done;
  return { ...state, fingerDown: false, active: false, lastPoint: null, lifts: state.lifts + (midStroke ? 1 : 0) };
}

function advance(guide: TraceGuide, state: TracerState, p: Point): TracerState {
  const checkpoints = guide.checkpoints[state.strokeIndex];
  const stroke = guide.strokes[state.strokeIndex];
  const offPath = distanceToPolyline(p, stroke) > OFF_PATH_TOLERANCE;

  // Collect the furthest checkpoint within reach, in order.
  let checkpoint = state.checkpoint;
  const last = checkpoints.length - 1;
  for (let i = Math.min(last, checkpoint + LOOKAHEAD - 1); i >= checkpoint; i--) {
    const tolerance = i === last && last > 0 ? END_TOLERANCE : HIT_TOLERANCE;
    if (distance(p, checkpoints[i]) <= tolerance) {
      checkpoint = i + 1;
      break;
    }
  }

  let next: TracerState = {
    ...state,
    checkpoint,
    samples: state.samples + 1,
    offPath: state.offPath + (offPath ? 1 : 0),
  };

  if (checkpoint >= checkpoints.length) {
    const strokeIndex = state.strokeIndex + 1;
    const done = strokeIndex >= guide.checkpoints.length;
    // Keep tracking without a lift if the next stroke starts right here (e.g. the bowl of b).
    const continues = !done && distance(p, guide.checkpoints[strokeIndex][0]) <= HIT_TOLERANCE;
    next = { ...next, strokeIndex: done ? state.strokeIndex : strokeIndex, checkpoint: done ? checkpoint : 0, done, active: continues };
  }
  return next;
}

/** 0–1. Accuracy of staying on the path, minus small penalties for lifting and wrong starts. */
export function traceScore(state: TracerState): number {
  const accuracy = state.samples === 0 ? 0 : 1 - state.offPath / state.samples;
  const penalty = Math.min(0.3, state.lifts * 0.04 + state.wrongStarts * 0.02);
  return Math.round(Math.max(0, Math.min(1, accuracy - penalty)) * 100) / 100;
}

/** 0–1 share of all checkpoints collected so far. */
export function traceProgress(guide: TraceGuide, state: TracerState): number {
  const total = guide.checkpoints.reduce((sum, c) => sum + c.length, 0);
  if (state.done) return 1;
  const before = guide.checkpoints.slice(0, state.strokeIndex).reduce((sum, c) => sum + c.length, 0);
  return (before + state.checkpoint) / total;
}
