import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { FeatureTour, InfoButton, useFeatureTour, type TourStep } from '@/components/FeatureTour';
import { FocusTracker } from '@/components/FocusTracker';
import { ACTIVITIES } from '@/engine/catalog';
import type { ActivityId, Level } from '@/engine/types';
import { activityKey, levelKey, useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useActiveProfile, useProgress } from '@/store/appStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { Header } from '@/ui/Header';
import { FadeInUp, PressableScale } from '@/ui/motion';
import { Screen } from '@/ui/Screen';

const TOUR: TourStep[] = [
  { title: 'tour_rhyme_welcome_title', description: 'tour_rhyme_welcome_desc' },
  { title: 'tour_rhyme_modes_title', description: 'tour_rhyme_modes_desc' },
];
const MODES: ActivityId[] = ['rhyme', 'rhyme-train', 'voice-vault'];

/** The original Rhyme Time dashboard, with all three of its modes playable. */
export default function RhymeTime() {
  const { t } = useT();
  const { colors } = useTheme();
  const feedback = useFeedback();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const tour = useFeatureTour('rhyme-dashboard');
  if (!profile) return <Redirect href="/login" />;

  const vaultCount = Object.values(progress.rhymeVault ?? {}).reduce((sum, words) => sum + words.length, 0);

  return (
    <Screen
      scroll
      overlay={<FocusTracker feature="rhyme" />}
      header={<Header title={t('rhyme_dashboard_title')} subtitle={t('rhyme_dashboard_subtitle')} right={<InfoButton onPress={tour.open} />} />}
    >
      <View style={styles.list}>
        {MODES.map((id, i) => {
          const meta = ACTIVITIES[id];
          const level = Math.min(progress.activities[id]?.level ?? 1, profile.prefs.maxLevel ?? 3) as Level;
          return (
            <FadeInUp key={id} index={i}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${t(activityKey(id, 'title'))}. ${t(activityKey(id, 'tagline'))}`}
                onPress={() => {
                  feedback.tap();
                  router.push(`/activity/${id}`);
                }}
              >
                <Card style={[styles.card, { borderColor: `${meta.color}55` }]}>
                  <View style={[styles.icon, { backgroundColor: `${meta.color}22` }]}>
                    <AppText size={36} fixed>
                      {meta.emoji}
                    </AppText>
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="heading">{t(activityKey(id, 'title'))}</AppText>
                    <AppText variant="caption" muted>
                      {t(activityKey(id, 'tagline'))}
                    </AppText>
                    <AppText variant="caption" weight="bold" color={meta.color} style={styles.meta}>
                      {t('runner_level', { n: level, desc: t(levelKey(id, level)) })}
                    </AppText>
                    {id === 'voice-vault' && vaultCount > 0 ? (
                      <AppText variant="caption" weight="bold" color={colors.success}>
                        {`🔐 ${t('vault_count', { n: vaultCount })}`}
                      </AppText>
                    ) : null}
                  </View>
                  <AppText size={22} fixed color={meta.color}>
                    ▶
                  </AppText>
                </Card>
              </PressableScale>
            </FadeInUp>
          );
        })}
      </View>
      <FeatureTour visible={tour.visible} steps={TOUR} onClose={tour.close} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: 14, marginTop: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 2 },
  icon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  meta: { marginTop: 4 },
});
