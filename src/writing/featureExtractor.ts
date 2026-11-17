import type { ClinicalFeatures, IdealPathData, LetterPath, MLFeatures, RawTouchPoint, SessionFeatureSummary, StrokeFeatureSummary } from './types';

/**
 * Handwriting kinematics for Letter Mastery, ported from the original app's "shadow feature extractor".
 * The child writes freely; every touch point is recorded, and when they finish this computes motion,
 * smoothness, tremor, shape, sequencing and orientation measures against the letter's ideal path.
 * Pure TypeScript with no React Native dependencies, so it is unit-tested directly.
 */

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const mean = (a: number[]) => (a.length === 0 ? 0 : a.reduce((s, v) => s + v, 0) / a.length);
const variance = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return mean(a.map((v) => (v - m) ** 2));
};
const stddev = (a: number[]) => Math.sqrt(variance(a));
const maxOf = (a: number[]) => a.reduce((m, v) => (v > m ? v : m), 0);

/** Local maxima (1) or minima (-1) in a signal. */
function countExtrema(signal: number[], direction: 1 | -1): number {
  let count = 0;
  for (let i = 1; i < signal.length - 1; i++) {
    const prev = signal[i] - signal[i - 1];
    const next = signal[i + 1] - signal[i];
    if (direction === 1 && prev > 0 && next < 0) count++;
    if (direction === -1 && prev < 0 && next > 0) count++;
  }
  return count;
}

/** Signal minus its trailing moving average: what's left is the fast wobble (tremor). */
const highPass = (signal: number[], window = 5) => signal.map((v, i) => v - mean(signal.slice(Math.max(0, i - window), i + 1)));

/** Dominant frequency from the zero-crossing rate, in Hz. */
function dominantFrequency(signal: number[], durationMs: number): number {
  if (durationMs <= 0 || signal.length < 2) return 0;
  let crossings = 0;
  for (let i = 1; i < signal.length; i++) if (signal[i - 1] >= 0 !== signal[i] >= 0) crossings++;
  return crossings / 2 / (durationMs / 1000);
}

function velocities(points: RawTouchPoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const dt = points[i].timestamp - points[i - 1].timestamp;
    out.push(dt > 0 ? dist(points[i].x, points[i].y, points[i - 1].x, points[i - 1].y) / dt : 0);
  }
  return out;
}

/** Derivative of a per-sample signal (velocity → acceleration → jerk). */
function derivative(signal: number[], points: RawTouchPoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < signal.length; i++) {
    const dt = points[i + 1] ? points[i + 1].timestamp - points[i].timestamp : 16;
    out.push(dt > 0 ? (signal[i] - signal[i - 1]) / dt : 0);
  }
  return out;
}

/** On-track tolerance from the ideal path, in letter units. */
const SPATIAL_TOLERANCE = 50;
/** Ideal points this close to any touch count as covered. */
const COVERAGE_TOLERANCE = 40;
/** A gap this long between touch samples is a pause. */
const PAUSE_MS = 200;

export class FeatureExtractor {
  private raw: RawTouchPoint[] = [];
  private current: RawTouchPoint[] = [];
  private strokes: RawTouchPoint[][] = [];
  private summaries: StrokeFeatureSummary[] = [];

  constructor(
    private readonly letterPath: LetterPath,
    private readonly ideal: IdealPathData,
  ) {}

  addPoint(point: RawTouchPoint) {
    this.raw.push(point);
    this.current.push(point);
  }

  /** Closes the stroke in progress (call on every finger lift). */
  endStroke() {
    if (this.current.length >= 2) {
      this.summaries.push(this.strokeFeatures(this.summaries.length, this.current));
      this.strokes.push(this.current);
    }
    this.current = [];
  }

  /** Strokes drawn so far, for the handwriting model. */
  get drawnStrokes(): { x: number; y: number }[][] {
    return this.strokes.map((s) => s.map(({ x, y }) => ({ x, y })));
  }

  get hasInk(): boolean {
    return this.strokes.length > 0;
  }

  summarize(sessionId: string, ml: MLFeatures, nowIso = new Date().toISOString()): SessionFeatureSummary {
    this.endStroke();
    const raw = this.raw;
    const summaries = this.summaries;
    const completionTime = raw.length > 1 ? raw[raw.length - 1].timestamp - raw[0].timestamp : 0;

    const timeInMotion = summaries.reduce((s, st) => s + st.strokeDuration, 0);
    const timePaused = summaries.reduce((s, st) => s + st.pauseCount * st.avgPauseDuration, 0);
    const fluencyRatio = timeInMotion + timePaused > 0 ? timeInMotion / (timeInMotion + timePaused) : 1;

    const sessionVel = velocities(raw);
    const avgVelocity = mean(sessionVel);
    const acc = derivative(sessionVel, raw);
    const jerk = derivative(acc, raw);
    const posAcc = acc.filter((a) => a > 0);
    const negAcc = acc.filter((a) => a < 0).map(Math.abs);
    const pressures = raw.map((p) => p.pressure);

    const expected = this.letterPath.expectedStrokeCount;
    const actual = summaries.length;
    const latencies = this.strokes.slice(1).map((stroke, i) => stroke[0].timestamp - this.strokes[i][this.strokes[i].length - 1].timestamp);

    let completenessScore = 0;
    if (this.ideal.points.length > 0 && raw.length > 0) {
      const tol2 = COVERAGE_TOLERANCE ** 2;
      const covered = this.ideal.points.filter((ip) => raw.some((rp) => (rp.x - ip.x) ** 2 + (rp.y - ip.y) ** 2 < tol2)).length;
      completenessScore = covered / this.ideal.points.length;
    }

    const clinical: ClinicalFeatures = {
      dataQuality: { samplingRate: this.samplingRate(), completenessScore, totalSamples: raw.length, pointsDropped: 0 },
      kinematics: {
        avgVelocity,
        peakVelocity: maxOf(sessionVel),
        velocityCoV: avgVelocity > 0 ? stddev(sessionVel) / avgVelocity : 0,
        velocityPeaks: summaries.reduce((s, st) => s + st.velocityPeaks, 0),
        velocityValleys: summaries.reduce((s, st) => s + st.velocityValleys, 0),
        timeInMotion,
        timePaused,
        fluencyRatio,
      },
      dynamics: {
        maxAcceleration: maxOf(acc.map(Math.abs)),
        avgJerk: mean(jerk.map(Math.abs)),
        normalizedJerk: mean(jerk.map(Math.abs)),
        accelerationSymmetry: negAcc.length > 0 && mean(negAcc) > 0 ? mean(posAcc) / mean(negAcc) : 1,
        ballisticMovements: summaries.filter((s) => s.isBallistic).length,
      },
      graphomotor: {
        tremorFrequency: mean(summaries.map((s) => s.tremor.tremor_frequency)),
        tremorAmplitude: mean(summaries.map((s) => s.tremor.tremor_amplitude)),
        tremorPower: mean(summaries.map((s) => s.tremor.tremor_power)),
        avgPressure: mean(pressures),
        pressureVariance: variance(pressures),
      },
      shape: this.shapeFeatures(),
      sequencing: {
        strokeCountActual: actual,
        strokeCountExpected: expected,
        extraStrokes: Math.max(0, actual - expected),
        missingStrokes: Math.max(0, expected - actual),
        strokeSequenceCorrect: actual === expected,
        liftOffCount: actual,
        avgInterStrokeLatency: mean(latencies),
        directionCorrectRate: summaries.length ? summaries.filter((s) => s.isDirectionCorrect).length / summaries.length : 0,
      },
      orientation: {
        micropauseCount: summaries.reduce((s, st) => s + st.pauseCount, 0),
        reversalDetected: ml.reversalDetected,
        mirrorConfusionScore: ml.reversalDetected ? (ml.reversalConfidence ?? 0) : 0,
        orientationConsistency: ml.reversalDetected ? 0 : 1,
      },
    };

    return {
      sessionId,
      letter: this.letterPath.letter,
      timestamp: nowIso,
      overview: { isCorrect: ml.isCorrect, completionTime, score: ml.confidence * 100, status: 'completed' },
      clinical,
      ml,
      context: { inputType: 'finger', screenSize: 'medium' },
    };
  }

  private strokeFeatures(strokeId: number, points: RawTouchPoint[]): StrokeFeatureSummary {
    const n = points.length;
    const strokeDuration = points[n - 1].timestamp - points[0].timestamp;
    const vel = velocities(points);
    const acc = derivative(vel, points);
    const jerk = derivative(acc, points).map(Math.abs);
    const velocityPeaks = countExtrema(vel, 1);
    const velocityValleys = countExtrema(vel, -1);
    const pauses: number[] = [];
    for (let i = 1; i < n; i++) {
      const dt = points[i].timestamp - points[i - 1].timestamp;
      if (dt > PAUSE_MS) pauses.push(dt);
    }
    const tremor = highPass(vel, 5);
    return {
      strokeId,
      strokeDuration,
      pauseCount: pauses.length,
      avgPauseDuration: mean(pauses),
      avgVelocity: mean(vel),
      avgPressure: mean(points.map((p) => p.pressure)),
      maxAcceleration: maxOf(acc.map(Math.abs)),
      normalizedJerk: mean(jerk),
      velocityPeaks,
      velocityValleys,
      // A smooth, single movement: one speed peak and no dips.
      isBallistic: velocityPeaks === 1 && velocityValleys === 0,
      isDirectionCorrect: this.directionCorrect(points, strokeId),
      tremor: { tremor_power: variance(tremor), tremor_amplitude: stddev(tremor), tremor_frequency: dominantFrequency(tremor, strokeDuration) },
      spatial: this.spatial(points, strokeId),
    };
  }

  /** The ideal stroke matched to the child's nth stroke (or the whole letter beyond the last). */
  private idealFor(strokeId: number) {
    const b = this.ideal.strokeBoundaries;
    return strokeId < b.length - 1 ? this.ideal.points.slice(b[strokeId], b[strokeId + 1]) : this.ideal.points;
  }

  private spatial(points: RawTouchPoint[], strokeId: number): StrokeFeatureSummary['spatial'] {
    const ideal = this.idealFor(strokeId);
    if (ideal.length === 0) return { mean_path_deviation: 0, max_path_deviation: 0, off_track_events: [], spatial_drift: 0, deviation_profile: [] };
    const profile = points.map((tp) => ideal.reduce((m, ip) => Math.min(m, dist(tp.x, tp.y, ip.x, ip.y)), Infinity));
    const events: { startTime: number; endTime: number }[] = [];
    let offStart: number | null = null;
    points.forEach((p, i) => {
      if (profile[i] > SPATIAL_TOLERANCE && offStart === null) offStart = p.timestamp;
      else if (profile[i] <= SPATIAL_TOLERANCE && offStart !== null) {
        events.push({ startTime: offStart, endTime: p.timestamp });
        offStart = null;
      }
    });
    if (offStart !== null) events.push({ startTime: offStart, endTime: points[points.length - 1].timestamp });
    return {
      mean_path_deviation: mean(profile),
      max_path_deviation: maxOf(profile),
      off_track_events: events,
      // Distance between the centre of the child's stroke and the centre of the ideal stroke.
      spatial_drift: dist(mean(points.map((p) => p.x)), mean(points.map((p) => p.y)), mean(ideal.map((p) => p.x)), mean(ideal.map((p) => p.y))),
      deviation_profile: profile,
    };
  }

  private shapeFeatures(): ClinicalFeatures['shape'] {
    const raw = this.raw;
    if (raw.length < 2) {
      return { mean_path_deviation: 0, aspect_ratio: 1, compactness_score: 0, closure_success_rate: 0, pathVariance: 0, spatialDrift: 0, offTrackEvents: 0, closureSuccess: false };
    }
    const xs = raw.map((p) => p.x);
    const ys = raw.map((p) => p.y);
    const width = Math.max(...xs) - Math.min(...xs) || 1;
    const height = Math.max(...ys) - Math.min(...ys) || 1;
    let length = 0;
    for (let i = 1; i < raw.length; i++) length += dist(raw[i].x, raw[i].y, raw[i - 1].x, raw[i - 1].y);
    const first = raw[0];
    const last = raw[raw.length - 1];
    const closure = dist(last.x, last.y, first.x, first.y) < Math.max(width, height) * 0.25 ? 1 : 0;
    const deviations = this.summaries.flatMap((s) => s.spatial.deviation_profile);
    return {
      mean_path_deviation: mean(deviations),
      aspect_ratio: width / height,
      compactness_score: Math.min(1, (2 * (width + height)) / (length || 1)),
      closure_success_rate: closure,
      pathVariance: variance(deviations),
      spatialDrift: mean(this.summaries.map((s) => s.spatial.spatial_drift)),
      offTrackEvents: this.summaries.reduce((s, st) => s + st.spatial.off_track_events.length, 0),
      closureSuccess: closure > 0.8,
    };
  }

  /** The stroke starts nearer the ideal start than it ends. */
  private directionCorrect(points: RawTouchPoint[], strokeId: number): boolean {
    const b = this.ideal.strokeBoundaries;
    if (strokeId >= b.length - 1) return true;
    const start = this.ideal.points[b[strokeId]];
    if (!start) return true;
    const first = points[0];
    const last = points[points.length - 1];
    return dist(first.x, first.y, start.x, start.y) <= dist(last.x, last.y, start.x, start.y);
  }

  private samplingRate(): number {
    const raw = this.raw;
    if (raw.length < 2) return 60;
    const duration = raw[raw.length - 1].timestamp - raw[0].timestamp;
    return duration > 0 ? raw.length / (duration / 1000) : 60;
  }
}

/** Accuracy, fluency and risk figures shown on the Session Report and Progress Dashboard. */
export interface MasteryScores {
  accuracy: number;
  fluency: number;
  coverage: number;
  durationScore: number;
  /** 0–100 risk indicators (screening only). */
  visualSpatialRisk: number;
  motorRisk: number;
  reversalRisk: number;
}

/**
 * Turns a report into the original dashboards' summary scores. The original filled these with fixed
 * example numbers; here they come from the child's own writing.
 */
export function masteryScores(r: SessionFeatureSummary): MasteryScores {
  const c = r.clinical;
  const accuracy = Math.round(r.overview.score);
  const fluency = Math.round(c.kinematics.fluencyRatio * 100);
  const coverage = Math.round(c.dataQuality.completenessScore * 100);
  const seconds = r.overview.completionTime / 1000;
  const durationScore = Math.round(Math.max(20, Math.min(100, 100 - (seconds / 120) * 40)));
  // Shape risk: the letter wasn't recognised and/or the path wasn't covered.
  const visualSpatialRisk = Math.round(Math.max(0, Math.min(100, 100 - (accuracy * 0.6 + coverage * 0.4))));
  // Motor risk: hesitant, jerky, shaky movement and wrong stroke counts.
  const hesitation = c.kinematics.velocityValleys / Math.max(1, c.sequencing.strokeCountActual);
  const motorRisk = Math.round(
    Math.max(0, Math.min(100, (1 - c.kinematics.fluencyRatio) * 50 + Math.min(30, hesitation * 3) + (c.sequencing.strokeSequenceCorrect ? 0 : 20))),
  );
  const reversalRisk = Math.round(c.orientation.reversalDetected ? Math.max(50, c.orientation.mirrorConfusionScore * 100) : (1 - c.sequencing.directionCorrectRate) * 30);
  return { accuracy, fluency, coverage, durationScore, visualSpatialRisk, motorRisk, reversalRisk };
}

export type RiskLevel = 'low' | 'moderate' | 'high';

export function riskLevel(scores: Pick<MasteryScores, 'visualSpatialRisk' | 'motorRisk' | 'reversalRisk'>): RiskLevel {
  const overall = (scores.visualSpatialRisk + scores.motorRisk + scores.reversalRisk) / 3;
  return overall < 30 ? 'low' : overall < 60 ? 'moderate' : 'high';
}
