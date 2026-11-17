import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * The device's own "Reduce Motion" setting, shared by every component through one
 * subscription. Combined with the child's "Calm motion" preference in the theme.
 */
let reduceMotion = false;
const listeners = new Set<() => void>();
const notify = (value: boolean) => {
  reduceMotion = value;
  listeners.forEach((listener) => listener());
};

AccessibilityInfo.isReduceMotionEnabled()
  .then(notify)
  .catch(() => undefined);
AccessibilityInfo.addEventListener('reduceMotionChanged', notify);

export function useSystemReduceMotion(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => reduceMotion,
  );
}
