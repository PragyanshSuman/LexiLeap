import { useCallback, useEffect, useRef } from 'react';
import type { Level, SessionOutcome } from '@/engine/types';
import { useAppStore } from '@/store/appStore';
import type { LetterTraced } from './GuidedTracer';

/** Free tracing is saved as one session per this many letters (and the rest when the child leaves). */
export const LETTERS_PER_SESSION = 5;
/** A letter traced at least this neatly counts as right first time. */
const NEAT = 0.8;

/**
 * Turns letters traced freely in the alphabet playground into ordinary tracing sessions, so they count
 * towards the A–Z map, stars, levels, the daily plan, the Learning Path and the reports, exactly like a
 * tracing activity. Letters are grouped so a child tracing letter after letter isn't flooded with
 * one-letter sessions.
 */
export function useTraceRecorder(profileId: string | undefined, onRecorded?: (outcome: SessionOutcome) => void) {
  const pending = useRef<LetterTraced[]>([]);
  const startedAt = useRef<string | null>(null);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  });

  const flush = useCallback(() => {
    const letters = pending.current;
    if (!profileId || letters.length === 0) return;
    pending.current = [];
    const state = useAppStore.getState();
    const ceiling = state.profiles.find((p) => p.id === profileId)?.prefs.maxLevel ?? 3;
    const level = Math.min(state.progress[profileId]?.activities.trace?.level ?? 1, ceiling) as Level;
    const letterScores: Record<string, number> = {};
    for (const l of letters) letterScores[l.letter] = Math.max(letterScores[l.letter] ?? 0, l.score);
    const outcome = state.recordSession(profileId, {
      activityId: 'trace',
      level,
      roundScores: letters.map((l) => l.score),
      firstTry: letters.filter((l) => l.score >= NEAT).length,
      durationSec: letters.reduce((sum, l) => sum + l.seconds, 0),
      struggles: 0,
      startedAt: startedAt.current ?? new Date().toISOString(),
      letterScores,
    });
    startedAt.current = null;
    onRecordedRef.current?.(outcome);
  }, [profileId]);

  const add = useCallback(
    (letter: LetterTraced) => {
      if (!startedAt.current) startedAt.current = new Date(Date.now() - letter.seconds * 1000).toISOString();
      pending.current = [...pending.current, letter];
      if (pending.current.length >= LETTERS_PER_SESSION) flush();
    },
    [flush],
  );

  // Save whatever is left when the child leaves the screen.
  useEffect(() => flush, [flush]);

  return add;
}
