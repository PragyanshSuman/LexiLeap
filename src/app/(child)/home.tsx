import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FeatureTour, useFeatureTour, type TourStep } from '@/components/FeatureTour';
import { MenuButton, MenuCard, SectionHeader } from '@/components/HomeParts';
import { MoodCheckIn } from '@/components/MoodCheckIn';
import { ACTIVITIES } from '@/engine/catalog';
import { currentStreak } from '@/engine/streak';
import type { ActivityId } from '@/engine/types';
import { useToday } from '@/hooks/useToday';
import { activityKey, useT, type TranslationKey } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useActiveProfile, useAppStore, useProgress } from '@/store/appStore';
import { useParentSession } from '@/store/parentSession';
import { DT } from '@/theme/dyslexiaTheme';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { FadeInUp, PressableScale } from '@/ui/motion';

const TOUR: TourStep[] = [
  { title: 'tour_home_menu_title', description: 'tour_home_menu_desc' },
  { title: 'tour_home_path_title', description: 'tour_home_path_desc' },
  { title: 'tour_home_cards_title', description: 'tour_home_cards_desc' },
  { title: 'tour_home_comfort_title', description: 'tour_home_comfort_desc' },
];

interface Tile {
  title: TranslationKey;
  subtitle: TranslationKey;
  icon: string;
  color: string;
  href: string;
}

const activityTile = (id: ActivityId, subtitle: TranslationKey): Tile => ({
  title: activityKey(id, 'title'),
  subtitle,
  icon: ACTIVITIES[id].emoji,
  color: ACTIVITIES[id].color,
  href: id === 'trace' ? '/letters' : `/activity/${id}`,
});

const SECTIONS: { title: TranslationKey; tiles: Tile[] }[] = [
  {
    title: 'section_daily',
    tiles: [
      activityTile('trace', 'tile_trace'),
      activityTile('sound-match', 'tile_sound_match'),
      activityTile('say-it', 'tile_say_it'),
      activityTile('sound-boxes', 'tile_sound_boxes'),
      activityTile('word-builder', 'tile_word_builder'),
      activityTile('syllables', 'tile_syllables'),
      { title: 'phonic_title', subtitle: 'tile_phonic', icon: '🎤', color: DT.accent.indigo, href: '/phonic-check' },
      { title: 'magic_title', subtitle: 'tile_magic', icon: '✨', color: DT.accent.rose, href: '/magic' },
      { title: 'write_title', subtitle: 'tile_write', icon: '🏆', color: DT.accent.gold, href: '/writing' },
    ],
  },
  {
    title: 'section_games',
    tiles: [
      activityTile('sight-words', 'tile_sight_words'),
      activityTile('rhyme', 'tile_rhyme'),
      { title: 'visual_title', subtitle: 'tile_visual', icon: '🧠', color: DT.accent.sky, href: '/visual' },
      activityTile('letter-hunt', 'tile_letter_hunt'),
      activityTile('memory', 'tile_memory'),
    ],
  },
  {
    title: 'section_clinical',
    tiles: [
      { title: 'assess_title', subtitle: 'tile_assess', icon: '🩺', color: '#1E3A5F', href: '/assessment/speech' },
      { title: 'spell_title', subtitle: 'tile_spell', icon: '✍️', color: '#5B21B6', href: '/assessment/spelling' },
    ],
  },
  {
    title: 'section_progress',
    tiles: [
      { title: 'mood_track_title', subtitle: 'tile_mood_track', icon: '📈', color: DT.accent.sky, href: '/mood-track' },
      { title: 'journey_title', subtitle: 'tile_journey', icon: '📄', color: DT.accent.teal, href: '/journey' },
      { title: 'tile_rewards_title', subtitle: 'tile_rewards', icon: '🏆', color: DT.accent.gold, href: '/rewards' },
      { title: 'tile_comfort_title', subtitle: 'tile_comfort', icon: '👓', color: DT.accent.sky, href: '/comfort' },
    ],
  },
];

export default function Home() {
  const { colors, space, prefs } = useTheme();
  const { t } = useT();
  const { width } = useWindowDimensions();
  const feedback = useFeedback();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const ensurePlan = useAppStore((s) => s.ensurePlan);
  const setMood = useAppStore((s) => s.setMood);
  const lockParentZone = useParentSession((s) => s.lock);
  const today = useToday();
  const tour = useFeatureTour('home');

  // Whenever the child is back here: build (or roll over to) today's plan, and make sure
  // the parent zone isn't left unlocked behind them.
  useFocusEffect(
    useCallback(() => {
      lockParentZone();
      if (profile) ensurePlan(profile.id);
    }, [profile, ensurePlan, lockParentZone]),
  );

  // A new day while this screen is open (or resumed from the background): build its plan.
  const profileId = profile?.id;
  useEffect(() => {
    if (profileId) ensurePlan(profileId, today);
  }, [profileId, today, ensurePlan]);

  if (!profile) return null;
  const plan = progress.plan?.day === today ? progress.plan : null;
  const done = plan?.items.filter((i) => i.done).length ?? 0;
  const complete = !!plan?.completed;
  const streak = currentStreak(progress.streak, today);
  const starsToday = progress.sessions.filter((s) => s.day === today).reduce((sum, s) => sum + s.stars, 0);

  // Two columns on phones, three on wide tablets.
  const contentWidth = Math.min(width, 960);
  const columns = contentWidth >= 720 ? 3 : 2;
  const gap = 12;
  const cardWidth = Math.floor((contentWidth - 30 - gap * (columns - 1)) / columns);

  const openPath = () => {
    feedback.tap();
    router.push('/path');
  };

  let index = 0;
  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.bg }]}>
        <MenuButton />
        <View style={styles.headerText}>
          <AppText variant="heading" weight="bold" numberOfLines={1} accessibilityRole="header">
            LexiLeap
          </AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            {t('home_greeting', { name: profile.name })}
          </AppText>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('nav_reading')}
          onPress={() => router.push('/comfort')}
          innerStyle={[styles.settingsButton, { backgroundColor: prefs.theme === 'cream' ? DT.bg.stone : colors.surfaceAlt, borderColor: colors.border }]}
        >
          <AppText size={20} fixed>
            ⚙️
          </AppText>
        </PressableScale>
        <View style={[styles.avatarMini, { backgroundColor: DT.accent.indigo, borderColor: colors.bg }]}>
          <AppText size={22} fixed>
            {profile.avatar}
          </AppText>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { width: contentWidth }]} showsVerticalScrollIndicator={false}>
        {/* Learning path hero banner */}
        <FadeInUp index={index++}>
          <PressableScale accessibilityRole="button" accessibilityLabel={complete ? t('home_today_complete') : t('home_my_path')} onPress={openPath} style={styles.hero} innerStyle={styles.heroInner} pressedScale={0.97}>
            <LinearGradient colors={complete ? ['#166534', '#14532D'] : ['#3730A3', '#1E1B4B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroGradient}>
              <View style={styles.flex}>
                <AppText variant="caption" weight="bold" color="rgba(255,255,255,0.8)">
                  {complete ? t('home_today_complete') : t('home_my_path')}
                </AppText>
                <AppText variant="heading" weight="bold" color="#FFFFFF">
                  {complete
                    ? t('home_stars_today', { n: starsToday })
                    : plan
                      ? t('home_activities_ready', { n: plan.items.length - done })
                      : t('home_start_journey')}
                </AppText>
                {plan ? (
                  <View style={styles.planRow} accessible accessibilityLabel={t('of', { a: done, b: plan.items.length })}>
                    {plan.items.map((item, i) => (
                      <View key={`${item.activityId}-${i}`} style={[styles.planDot, item.done && styles.planDotDone]}>
                        <AppText size={16} fixed>
                          {item.done ? '✓' : ACTIVITIES[item.activityId].emoji}
                        </AppText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
              <View style={styles.heroRight}>
                {streak > 0 ? (
                  <View style={styles.streak} accessible accessibilityLabel={`${streak} day streak`}>
                    <AppText size={20} fixed>
                      🔥
                    </AppText>
                    <AppText size={13} fixed weight="bold" color="#FCD34D">
                      {String(streak)}
                    </AppText>
                  </View>
                ) : null}
                <View style={[styles.heroButton, complete && styles.heroButtonDone]}>
                  <AppText variant="label" weight="bold" color="#FFFFFF" fixed>
                    {complete ? t('home_view') : t('home_go')}
                  </AppText>
                </View>
              </View>
            </LinearGradient>
          </PressableScale>
        </FadeInUp>

        <FadeInUp index={index++} style={{ marginTop: space(4) }}>
          <MoodCheckIn mood={progress.moods[today]} onPick={(mood) => setMood(profile.id, mood)} />
        </FadeInUp>

        {SECTIONS.map((section) => (
          <View key={section.title}>
            <SectionHeader title={t(section.title)} />
            <View style={[styles.grid, { gap }]}>
              {section.tiles.map((tile) => (
                <FadeInUp key={tile.title} index={index++}>
                  <MenuCard
                    title={t(tile.title)}
                    subtitle={t(tile.subtitle)}
                    icon={tile.icon}
                    color={tile.color}
                    width={cardWidth}
                    onPress={() => router.push(tile.href as never)}
                  />
                </FadeInUp>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
      <FeatureTour visible={tour.visible} steps={TOUR} onClose={tour.close} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, gap: 12 },
  headerText: { flex: 1, marginLeft: 3 },
  settingsButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarMini: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  scroll: { alignSelf: 'center', paddingHorizontal: 15, paddingBottom: 20 },
  hero: { marginTop: 16, borderRadius: 20, ...DT.shadow.medium },
  heroInner: { borderRadius: 20, overflow: 'hidden' },
  heroGradient: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 12 },
  heroRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  planDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  planDotDone: { backgroundColor: 'rgba(134,239,172,0.45)' },
  streak: { alignItems: 'center' },
  heroButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroButtonDone: { backgroundColor: 'rgba(255,255,255,0.15)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
