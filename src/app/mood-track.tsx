import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { MOODS, MoodCheckIn, moodLabelKey } from '@/components/MoodCheckIn';
import { useToday } from '@/hooks/useToday';
import { useT } from '@/i18n';
import { lastDays, parseDayKey } from '@/lib/date';
import { useActiveProfile, useAppStore, useProgress } from '@/store/appStore';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { Header } from '@/ui/Header';
import { FadeInUp } from '@/ui/motion';
import { Screen } from '@/ui/Screen';

/**
 * The child's Mood Track: how they said they felt today and this week. Focus readings and other
 * analysis are for grown-ups and live in the parent zone.
 */
export default function MoodTrack() {
  const { t, language } = useT();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const setMood = useAppStore((s) => s.setMood);
  const today = useToday();
  if (!profile) return <Redirect href="/login" />;
  const week = lastDays(7, today);

  return (
    <Screen scroll header={<Header title={t('mood_track_title')} subtitle={t('mood_track_child_subtitle')} />}>
      <FadeInUp>
        <MoodCheckIn mood={progress.moods[today]} onPick={(mood) => setMood(profile.id, mood)} />
      </FadeInUp>
      <FadeInUp index={1}>
        <AppText variant="label" weight="bold" style={styles.title}>
          {t('mood_track_checkins')}
        </AppText>
        <Card style={styles.week}>
          {week.map((day) => {
            const mood = MOODS.find((m) => m.mood === progress.moods[day]);
            const weekday = parseDayKey(day).toLocaleDateString(language, { weekday: 'short' });
            return (
              <View key={day} style={styles.day} accessible accessibilityLabel={`${weekday}: ${mood ? t(moodLabelKey(mood.mood)) : '–'}`}>
                <AppText size={26} fixed>
                  {mood?.emoji ?? '·'}
                </AppText>
                <AppText size={11} fixed muted>
                  {weekday}
                </AppText>
              </View>
            );
          })}
        </Card>
      </FadeInUp>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 20, marginBottom: 8 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', flex: 1 },
});
