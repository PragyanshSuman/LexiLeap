import { Redirect, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { FocusTracker } from '@/components/FocusTracker';
import { FeatureTour, InfoButton, useFeatureTour, type TourStep } from '@/components/FeatureTour';
import { SORT_PAIRS } from '@/activities/generators';
import { ACTIVITIES } from '@/engine/catalog';
import { confusionKey } from '@/engine/progress';
import type { ActivityId } from '@/engine/types';
import { activityKey, useT } from '@/i18n';
import { useActiveProfile, useProgress } from '@/store/appStore';
import { DT } from '@/theme/dyslexiaTheme';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { Header } from '@/ui/Header';
import { FadeInUp, PressableScale } from '@/ui/motion';
import { Screen } from '@/ui/Screen';

const TOUR: TourStep[] = [
  { title: 'tour_vd_welcome_title', description: 'tour_vd_welcome_desc' },
  { title: 'tour_vd_pairs_title', description: 'tour_vd_pairs_desc' },
];
const GAMES: ActivityId[] = ['odd-one-out', 'letter-sort'];

/** The original "Spot It" dashboard: pick a tricky pair, then a game to practise it. */
export default function SpotIt() {
  const { t } = useT();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const tour = useFeatureTour('visual');
  if (!profile) return <Redirect href="/login" />;

  const play = (game: ActivityId, pair: [string, string]) =>
    router.push({ pathname: '/activity/[id]', params: { id: game, focus: pair.join('|') } });

  return (
    <Screen overlay={<FocusTracker feature="visual" />} scroll header={<Header title={t('visual_title')} subtitle={t('visual_desc')} right={<InfoButton onPress={tour.open} />} />}>
      <View style={styles.list}>
        {SORT_PAIRS.map((pair, i) => {
          const mixups = progress.confusions[confusionKey(pair[0], pair[1])] ?? 0;
          return (
            <FadeInUp key={pair.join('')} index={i}>
              <Card style={[styles.card, mixups > 0 && styles.cardFocus]}>
                <View style={styles.row}>
                  <LinearGradient colors={['#4F46E5', '#818CF8']} style={styles.pairIcon}>
                    <AppText size={30} fixed weight="bold" color="#FFFFFF">
                      {pair.join(' ')}
                    </AppText>
                  </LinearGradient>
                  <View style={styles.flex}>
                    <AppText variant="heading">{t('visual_pair', { a: pair[0], b: pair[1] })}</AppText>
                    {mixups > 0 ? (
                      <AppText variant="caption" weight="bold" color={DT.accent.rose}>
                        {t('visual_mixups', { n: mixups })}
                      </AppText>
                    ) : null}
                  </View>
                </View>
                <View style={styles.row}>
                  {GAMES.map((game) => (
                    <PressableScale
                      key={game}
                      accessibilityRole="button"
                      accessibilityLabel={`${t(activityKey(game, 'title'))}, ${t('visual_pair', { a: pair[0], b: pair[1] })}`}
                      onPress={() => play(game, pair)}
                      style={styles.flex}
                      innerStyle={[styles.game, { backgroundColor: `${ACTIVITIES[game].color}18`, borderColor: `${ACTIVITIES[game].color}55` }]}
                    >
                      <AppText size={22} fixed>
                        {ACTIVITIES[game].emoji}
                      </AppText>
                      <AppText variant="label" weight="bold" color={ACTIVITIES[game].color} numberOfLines={1} style={styles.flex}>
                        ▶ {t(activityKey(game, 'title'))}
                      </AppText>
                    </PressableScale>
                  ))}
                </View>
              </Card>
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
  card: { gap: 12 },
  cardFocus: { borderColor: DT.accent.rose, borderWidth: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pairIcon: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  game: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, minHeight: 52 },
});
