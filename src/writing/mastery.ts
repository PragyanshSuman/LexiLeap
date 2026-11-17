import { masteryScores, riskLevel, type RiskLevel } from './featureExtractor';
import type { SessionFeatureSummary } from './types';

/** Accuracy (0–100) at or above which a letter counts as mastered. */
export const MASTERED_AT = 80;
/** Average accuracy below which a practised letter needs more practice. */
export const STRUGGLING_BELOW = 50;
const RECENT = 3;

export type LetterStatus = 'new' | 'learning' | 'mastered' | 'struggling';

export interface LetterStats {
  sessions: number;
  /** Mean accuracy over all sessions, 0–100. */
  averageAccuracy: number;
  status: LetterStatus;
}

/**
 * A letter's status from its recent reports: mastered when written clearly and the right way round
 * lately; struggling when recent attempts were mostly misread, or the latest was reversed.
 */
export function letterStats(reports: SessionFeatureSummary[], letter: string): LetterStats {
  const mine = reports.filter((r) => r.letter === letter);
  if (mine.length === 0) return { sessions: 0, averageAccuracy: 0, status: 'new' };
  const recent = mine.slice(-RECENT);
  const latest = mine[mine.length - 1];
  const recentAvg = recent.reduce((s, r) => s + r.overview.score, 0) / recent.length;
  const best = Math.max(...recent.map((r) => r.overview.score));
  let status: LetterStatus = 'learning';
  if (latest.ml.reversalDetected || (mine.length >= 2 && recentAvg < STRUGGLING_BELOW)) status = 'struggling';
  else if (best >= MASTERED_AT && latest.overview.isCorrect) status = 'mastered';
  return { sessions: mine.length, averageAccuracy: mine.reduce((s, r) => s + r.overview.score, 0) / mine.length, status };
}

export interface MasterySummary {
  mastered: string[];
  struggling: string[];
  totalSessions: number;
  /** 0–100. */
  averageAccuracy: number;
  averageDurationSec: number;
  risk: { level: RiskLevel; visualSpatial: number; motor: number; orientation: number };
  /** Average accuracy per day practised, oldest first (at most the last `days` days with practice). */
  trend: { day: string; accuracy: number }[];
}

/** Recent reports used for the risk indicators. */
const RISK_WINDOW = 10;

export function summarizeMastery(reports: SessionFeatureSummary[], letters: string[], days = 6): MasterySummary {
  const stats = letters.map((l) => [l, letterStats(reports, l)] as const);
  const avg = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0);
  const recent = reports.slice(-RISK_WINDOW).map(masteryScores);
  const risk = {
    visualSpatial: Math.round(avg(recent.map((s) => s.visualSpatialRisk))),
    motor: Math.round(avg(recent.map((s) => s.motorRisk))),
    orientation: Math.round(avg(recent.map((s) => s.reversalRisk))),
  };
  const byDay = new Map<string, number[]>();
  for (const r of reports) {
    const day = r.timestamp.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), r.overview.score]);
  }
  const trend = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days)
    .map(([day, scores]) => ({ day, accuracy: Math.round(avg(scores)) }));
  return {
    mastered: stats.filter(([, s]) => s.status === 'mastered').map(([l]) => l),
    struggling: stats.filter(([, s]) => s.status === 'struggling').map(([l]) => l),
    totalSessions: reports.length,
    averageAccuracy: Math.round(avg(reports.map((r) => r.overview.score))),
    averageDurationSec: Math.round(avg(reports.map((r) => r.overview.completionTime / 1000))),
    risk: { ...risk, level: reports.length ? riskLevel({ visualSpatialRisk: risk.visualSpatial, motorRisk: risk.motor, reversalRisk: risk.orientation }) : 'low' },
    trend,
  };
}
