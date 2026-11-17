/** Models for Letter Mastery (the original "Write & get scored" letter writing practice). */

export interface Point {
  x: number;
  y: number;
}

export interface PathSegment {
  type: 'line' | 'bezier' | 'arc';
  start: Point;
  end: Point;
  control1?: Point;
  control2?: Point;
  radius?: number;
}

export interface LetterPath {
  letter: string;
  strokes: PathSegment[][];
  expectedStrokeCount: number;
  width: number;
  height: number;
  baseline: number;
  difficulty: 'easy' | 'medium' | 'hard';
  confusionPairs: string[];
}

export interface GuidelinePoint {
  x: number;
  y: number;
  index: number;
  normalX: number;
  normalY: number;
}

export interface IdealPathData {
  points: GuidelinePoint[];
  totalLength: number;
  /** Index into `points` where each stroke starts, plus the total at the end. */
  strokeBoundaries: number[];
}

export interface RawTouchPoint {
  x: number;
  y: number;
  timestamp: number;
  pressure: number;
}

export type ReversalType = 'horizontal_flip' | 'vertical_flip' | 'rotation_180';

export interface MLFeatures {
  /** What the handwriting model read. */
  predictedChar: string;
  expectedChar: string;
  isCorrect: boolean;
  /** How sure the model is that the letter written is the one asked for (0–1). */
  confidence: number;
  topPredictions: { char: string; score: number }[];
  reversalDetected: boolean;
  reversalType?: ReversalType;
  reversalConfidence?: number;
  analysisTimestamp: string;
}

export interface ClinicalFeatures {
  dataQuality: { samplingRate: number; completenessScore: number; totalSamples: number; pointsDropped: number };
  kinematics: {
    avgVelocity: number;
    peakVelocity: number;
    velocityCoV: number;
    velocityPeaks: number;
    velocityValleys: number;
    timeInMotion: number;
    timePaused: number;
    fluencyRatio: number;
  };
  dynamics: { maxAcceleration: number; avgJerk: number; normalizedJerk: number; accelerationSymmetry: number; ballisticMovements: number };
  graphomotor: { tremorFrequency: number; tremorAmplitude: number; tremorPower: number; avgPressure: number; pressureVariance: number };
  shape: {
    mean_path_deviation: number;
    aspect_ratio: number;
    compactness_score: number;
    closure_success_rate: number;
    pathVariance: number;
    spatialDrift: number;
    offTrackEvents: number;
    closureSuccess: boolean;
  };
  sequencing: {
    strokeCountActual: number;
    strokeCountExpected: number;
    extraStrokes: number;
    missingStrokes: number;
    strokeSequenceCorrect: boolean;
    liftOffCount: number;
    avgInterStrokeLatency: number;
    /** Share of strokes drawn in the expected direction (0–1). */
    directionCorrectRate: number;
  };
  orientation: { micropauseCount: number; reversalDetected: boolean; mirrorConfusionScore: number; orientationConsistency: number };
}

/** The full report for one letter written in Letter Mastery. */
export interface SessionFeatureSummary {
  sessionId: string;
  letter: string;
  timestamp: string;
  overview: {
    isCorrect: boolean;
    /** Milliseconds from the first touch to the last. */
    completionTime: number;
    /** 0–100: how sure the model is that this is the letter asked for. */
    score: number;
    status: 'completed' | 'abandoned';
  };
  clinical: ClinicalFeatures;
  ml: MLFeatures;
  context: { inputType: 'finger' | 'stylus'; screenSize: 'small' | 'medium' | 'large' };
}

export interface StrokeFeatureSummary {
  strokeId: number;
  strokeDuration: number;
  pauseCount: number;
  avgPauseDuration: number;
  avgVelocity: number;
  avgPressure: number;
  maxAcceleration: number;
  normalizedJerk: number;
  velocityPeaks: number;
  velocityValleys: number;
  isBallistic: boolean;
  isDirectionCorrect: boolean;
  tremor: { tremor_power: number; tremor_amplitude: number; tremor_frequency: number };
  spatial: {
    mean_path_deviation: number;
    max_path_deviation: number;
    off_track_events: { startTime: number; endTime: number }[];
    spatial_drift: number;
    deviation_profile: number[];
  };
}
