import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { dayKey, type DayKey } from '@/lib/date';

/** Milliseconds until just after the next local midnight. */
function msUntilTomorrow(): number {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  return midnight.getTime() - now.getTime();
}

/**
 * Today's day key, kept current when the app stays open past midnight or is resumed
 * from the background on a later day.
 */
export function useToday(): DayKey {
  const [today, setToday] = useState(dayKey);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setToday(dayKey());
      clearTimeout(timer);
      timer = setTimeout(refresh, msUntilTomorrow());
    };
    timer = setTimeout(refresh, msUntilTomorrow());
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return today;
}
