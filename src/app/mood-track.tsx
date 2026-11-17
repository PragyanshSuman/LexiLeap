import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ConcentrationBar, EXPRESSIONS, ExpressionPips } from '@/components/FocusParts';
import { MOODS, moodLabelKey } from '@/components/MoodCheckIn';
import { featureEmoji, summarizeFocus, type FocusSummary } from '@/engine/focus';
import { featureTitle, useT } from '@/i18n';
import { lastDays, parseDayKey } from '@/lib/date';
import { useToday } from '@/hooks/useToday';
import { isFaceDetectionAvailable } from '@/services/faceDetection';
import { useActiveProfile, useProgress } from '@/store/appStore';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { SectionTitle } from '@/ui/controls';
import { Header } from '@/ui/Header';
import { FadeInUp } from '@/ui/motion';
import { Screen } from '@/ui/Screen';

/** Readings older than this are left out of the report. */
const REPORT_DAYS = 30;

/** The original "Mood Track": how the child felt (check-ins) and how focused they were, per activity. */
export default function MoodTrack() {
  const { t, language } = useT();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const today = useToday();
  if (!profile) return <Redirect href="/login" />;

  const window = new Set(lastDays(REPORT_DAYS, today));
  const summaries = summarizeFocus(progress.focus.filter((s) => window.has(s.day)));
  const week = lastDays(7, today);
  const status = !isFaceDetectionAvailable() ? t('mood_track_unavailable') : !profile.prefs.focusHelper ? t('mood_track_off') : null;

  return (
    <Screen scroll header={<Header title={t('mood_track_title')} subtitle={t('mood_track_subtitle')} />}>
      <SectionTitle>{t('mood_track_checkins')}</SectionTitle>
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

      <SectionTitle>{t('mood_track_features')}</SectionTitle>
      {status ? (
        <Card>
          <AppText muted>👁 {status}</AppText>
        </Card>
      ) : null}
      {summaries.length === 0 ? (
        status ? null : (
          <Card>
            <AppText muted>{t('mood_track_empty')}</AppText>
          </Card>
        )
      ) : (
        <View style={styles.list}>
          {summaries.map((summary, i) => (
            <FadeInUp key={summary.feature} index={i}>
              <FeatureCard summary={summary} />
            </FadeInUp>
          ))}
        </View>
      )}
    </Screen>
  );
}

function FeatureCard({ summary }: { summary: FocusSummary }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)}>
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <AppText size={28} fixed>
            {featureEmoji(summary.feature)}
          </AppText>
          <View style={styles.flex}>
            <AppText variant="label" weight="bold">
              {featureTitle(t, summary.feature)}
            </AppText>
            <AppText variant="caption" muted>
              {t('mood_track_readings', { n: summary.samples })}
            </AppText>
          </View>
          <View style={styles.dominant}>
            <AppText size={24} fixed>
              {EXPRESSIONS[summary.dominant].emoji}
            </AppText>
          </View>
        </View>
        <ConcentrationBar value={summary.concentration} />
        {open ? <ExpressionPips expressions={summary.expressions} /> : null}
        <AppText variant="caption" center muted>
          {open ? t('mood_track_less') : t('mood_track_more')}
        </AppText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', flex: 1 },
  list: { gap: 12 },
  card: { gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dominant: { alignItems: 'center' },
});
