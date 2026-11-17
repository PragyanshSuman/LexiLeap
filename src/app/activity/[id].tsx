import { Redirect, router, useLocalSearchParams, useNavigation, usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { ActivityRunner } from '@/activities/ActivityRunner';
import { ACTIVITY_DEFINITIONS } from '@/activities/registry';
import { parseFocusPair } from '@/activities/generators';
import { GLYPHS } from '@/activities/trace/glyphs';
import { isActivityId } from '@/engine/catalog';
import { isOverLimit } from '@/engine/progress';
import type { ActivityId } from '@/engine/types';
import { useT } from '@/i18n';
import { dayKey } from '@/lib/date';
import { useActiveProfile, useAppStore } from '@/store/appStore';
import { goBackOr } from '@/ui/Header';

export default function ActivityScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const profile = useActiveProfile();
  const navigation = useNavigation();
  const { t } = useT();
  const [inProgress, setInProgress] = useState(false);
  /** Where to go once the back-navigation guard is lifted: back, or to another activity. */
  const [leaveTo, setLeaveTo] = useState<'back' | ActivityId | null>(null);
  // Checked once on entry: a session that's already running is never cut off.
  const [overLimitOnEntry] = useState(() => {
    const p = profile && useAppStore.getState().progress[profile.id];
    return !!profile && !!p && isOverLimit(profile.prefs.dailyLimitMin, p, dayKey());
  });

  // Hardware back / swipe during a session asks first instead of silently losing it.
  usePreventRemove(inProgress && leaveTo === null, ({ data }) => {
    Alert.alert(t('stop_title'), t('leave_body'), [
      { text: t('keep_playing'), style: 'cancel' },
      { text: t('leave'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const exit = useCallback(() => setLeaveTo('back'), []);
  const switchTo = useCallback((activityId: ActivityId) => setLeaveTo(activityId), []);
  useEffect(() => {
    if (leaveTo === 'back') goBackOr('/home');
    else if (leaveTo) router.replace(`/activity/${leaveTo}`);
  }, [leaveTo]);

  if (!profile) return <Redirect href="/login" />;
  if (!isActivityId(id)) return <Redirect href="/home" />;
  if (overLimitOnEntry) return <Redirect href="/break" />;

  // Only accept a focus the activity understands: a letter to trace, or a Spot It pair.
  const safeFocus =
    id === 'trace' && focus && GLYPHS[focus]
      ? focus
      : (id === 'odd-one-out' || id === 'letter-sort') && parseFocusPair(focus)
        ? focus
        : undefined;

  return (
    <ActivityRunner
      key={`${id}-${safeFocus ?? ''}`}
      definition={ACTIVITY_DEFINITIONS[id]}
      profile={profile}
      focus={safeFocus}
      onInProgressChange={setInProgress}
      onExit={exit}
      onSwitch={switchTo}
    />
  );
}
