import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { BAND_COLOURS, BAND_LABELS, ConcentrationBar } from '@/components/FocusParts';
import { ACTIVITIES, ACTIVITY_ORDER } from '@/engine/catalog';
import { focusBand, focusByDay, type FocusBand } from '@/engine/focus';
import { activityKey, useT } from '@/i18n';
import { lastDays, parseDayKey } from '@/lib/date';
import { useToday } from '@/hooks/useToday';
import { shareReport } from '@/services/report';
import { useActiveProfile, useProgress } from '@/store/appStore';
import { DT } from '@/theme/dyslexiaTheme';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SectionTitle } from '@/ui/controls';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';

const HEATMAP_DAYS = 14;
const pct = (value: number | null) => (value === null ? '–' : `${Math.round(value)}%`);
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** The original "My Report" learning profile: phonics, focus, activities and a session log. */
export default function Journey() {
  const { t, language } = useT();
  const { colors } = useTheme();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const today = useToday();
  const [sharing, setSharing] = useState(false);
  if (!profile) return <Redirect href="/login" />;

  const phonics = mean(progress.speechChecks.map((c) => (c.correct ? 100 : 0)));
  const focus = mean(progress.focus.map((s) => s.concentration));
  const days = focusByDay(progress.focus, lastDays(HEATMAP_DAYS, today));
  const played = ACTIVITY_ORDER.filter((id) => progress.activities[id]);
  const recentWords = [...progress.speechChecks].reverse().slice(0, 8);

  const exportReport = async () => {
    setSharing(true);
    try {
      await shareReport(profile, progress);
    } catch (e) {
      Alert.alert(t('journey_title'), e instanceof Error ? e.message : t('something_wrong'));
    } finally {
      setSharing(false);
    }
  };

  return (
    <Screen
      scroll
      header={
        <Header
          title={t('journey_profile')}
          right={<Button label={t('journey_export')} icon="share-outline" compact variant="secondary" loading={sharing} onPress={exportReport} />}
        />
      }
    >
      <LinearGradient colors={[DT.accent.navy, DT.accent.indigo]} style={styles.profile}>
        <View style={styles.avatar}>
          <AppText size={34} fixed>
            {profile.avatar}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="heading" weight="bold" color="#FFFFFF">
            {profile.name}
          </AppText>
          <AppText variant="caption" color="#E0E7FF">
            {t('journey_since', { day: new Date(profile.createdAt).toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' }) })}
          </AppText>
        </View>
      </LinearGradient>

      <View style={styles.pills}>
        <Pill label={t('journey_stat_phonics')} value={pct(phonics)} />
        <Pill label={t('journey_stat_focus')} value={pct(focus)} />
        <Pill label={t('journey_stat_activities')} value={String(progress.sessions.length)} />
        <Pill label={t('journey_stat_reads')} value={String(progress.focus.length + progress.speechChecks.length + progress.writing.length)} />
      </View>

      <SectionTitle>{t('journey_focus_days')}</SectionTitle>
      <Card style={styles.card}>
        <View style={styles.heatmap}>
          {days.map(({ day, concentration }) => (
            <View key={day} style={styles.heatColumn}>
              <View
                style={[styles.heatCell, { backgroundColor: concentration === null ? '#E2E8F0' : BAND_COLOURS[focusBand(concentration)] }]}
                accessible
                accessibilityLabel={`${parseDayKey(day).toLocaleDateString(language, { day: 'numeric', month: 'short' })}: ${pct(concentration)}`}
              />
              <AppText size={10} fixed muted>
                {String(parseDayKey(day).getDate())}
              </AppText>
            </View>
          ))}
        </View>
        <View style={styles.legend}>
          {(['high', 'medium', 'low'] as FocusBand[]).map((band) => (
            <View key={band} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: BAND_COLOURS[band] }]} />
              <AppText variant="caption" muted>
                {t(BAND_LABELS[band])}
              </AppText>
            </View>
          ))}
        </View>
      </Card>

      <SectionTitle>{t('journey_breakdown')}</SectionTitle>
      <Card style={styles.card}>
        {played.length === 0 ? <AppText muted>–</AppText> : null}
        {played.map((id) => {
          const sessions = progress.sessions.filter((s) => s.activityId === id);
          const accuracy = mean(sessions.map((s) => s.accuracy * 100)) ?? 0;
          const activityFocus = mean(progress.focus.filter((s) => s.feature === id).map((s) => s.concentration));
          return (
            <View key={id} style={styles.activity}>
              <View style={styles.activityHeader}>
                <AppText size={22} fixed>
                  {ACTIVITIES[id].emoji}
                </AppText>
                <View style={styles.flex}>
                  <AppText variant="label" weight="bold">
                    {t(activityKey(id, 'title'))}
                  </AppText>
                  <AppText variant="caption" muted>
                    {t('journey_sessions', { n: sessions.length, acc: Math.round(accuracy) })}
                  </AppText>
                </View>
              </View>
              {activityFocus !== null ? <ConcentrationBar value={Math.round(activityFocus)} /> : null}
            </View>
          );
        })}
      </Card>

      <Card style={[styles.card, styles.method]} accent={colors.primary}>
        <AppText variant="label" weight="bold">
          {t('journey_method_title')}
        </AppText>
        <AppText variant="caption" muted>
          {t('journey_method')}
        </AppText>
      </Card>

      <SectionTitle>{t('journey_recent_speech')}</SectionTitle>
      <Card style={styles.card}>
        {recentWords.length === 0 ? <AppText muted>{t('journey_no_speech')}</AppText> : null}
        {recentWords.map((check, i) => (
          <View key={i} style={styles.word}>
            <AppText variant="label">
              {check.correct ? '✅' : '🔁'} {check.word}
            </AppText>
            <AppText variant="label" weight="bold" color={check.correct ? colors.success : colors.warning}>
              {pct(check.score === null ? null : check.score * 100)}
            </AppText>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.pill}>
      <AppText variant="caption" weight="bold" muted center>
        {label}
      </AppText>
      <AppText variant="heading" weight="bold" center color={DT.accent.navy}>
        {value}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 24, padding: 18, marginTop: 8, ...DT.shadow.medium },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  pill: { flexBasis: '45%', flexGrow: 1, gap: 2, paddingVertical: 12 },
  card: { gap: 12 },
  heatmap: { flexDirection: 'row', justifyContent: 'space-between', gap: 3 },
  heatColumn: { flex: 1, alignItems: 'center', gap: 4 },
  heatCell: { width: '100%', aspectRatio: 0.6, borderRadius: 6 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  activity: { gap: 6 },
  activityHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  method: { marginTop: 14 },
  word: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
