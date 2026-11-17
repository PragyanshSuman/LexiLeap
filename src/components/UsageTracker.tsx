import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { isOverLimit } from '@/engine/progress';
import { dayKey } from '@/lib/date';
import { useActiveProfile, useAppStore } from '@/store/appStore';
import { useWellness } from '@/store/wellness';

const TICK_SECONDS = 15;
/** Time away from the app that counts as having had a real break. */
const BREAK_RESET_MS = 5 * 60 * 1000;

/** Routes that aren't the child's own learning time: setup, parent zone, the break screen. */
const NOT_CHILD_TIME = ['/welcome', '/setup', '/login', '/register', '/parent', '/forgot-pin', '/break'];

export function isChildRoute(pathname: string): boolean {
  return !NOT_CHILD_TIME.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}-`));
}

/**
 * Counts the active child's screen time while the app is in the foreground and:
 *  - once the daily limit is reached, sends them to the break screen;
 *  - after a long stretch of continuous play, shows the Wellness Advisor.
 * A session in progress is never interrupted; both wait until the activity ends.
 */
export function UsageTracker() {
  const pathname = usePathname();
  const profile = useActiveProfile();
  const profileId = profile?.id;
  const limit = profile?.prefs.dailyLimitMin ?? null;
  const reminderMin = profile?.prefs.breakReminderMin ?? null;
  /** Seconds of play since the last break (kept across screens, reset by a real break). */
  const continuous = useRef(0);
  const backgroundedAt = useRef<number | null>(null);
  const counting = !!profileId && isChildRoute(pathname);
  // Never interrupt a child mid-task: activities, and the tracing and writing canvases.
  const inActivity = ['/activity', '/tracing/trace', '/mastery/write'].some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (!counting || !profileId) return;
    let foreground = AppState.currentState === 'active';
    const subscription = AppState.addEventListener('change', (state) => {
      foreground = state === 'active';
      if (!foreground) {
        backgroundedAt.current = Date.now();
      } else if (backgroundedAt.current !== null && Date.now() - backgroundedAt.current >= BREAK_RESET_MS) {
        continuous.current = 0;
      }
    });
    const id = setInterval(() => {
      if (!foreground) return;
      const store = useAppStore.getState();
      store.addUsage(profileId, TICK_SECONDS);
      continuous.current += TICK_SECONDS;
      if (inActivity) return;
      const progress = useAppStore.getState().progress[profileId];
      if (progress && isOverLimit(limit, progress, dayKey())) {
        router.push('/break');
      } else if (reminderMin !== null && continuous.current >= reminderMin * 60 && !useWellness.getState().visible) {
        useWellness.getState().show(Math.round(continuous.current / 60));
        continuous.current = 0;
      }
    }, TICK_SECONDS * 1000);
    return () => {
      clearInterval(id);
      subscription.remove();
    };
  }, [counting, profileId, limit, reminderMin, inActivity]);

  return null;
}
