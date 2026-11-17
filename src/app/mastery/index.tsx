import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeatureTour, useFeatureTour, type TourStep } from '@/components/FeatureTour';
import { FocusTracker } from '@/components/FocusTracker';
import { SeriInfoButton } from '@/components/seri/SeriButtons';
import { BackButton } from '@/ui/BackButton';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useActiveProfile, useProgress } from '@/store/appStore';
import { DT } from '@/theme/dyslexiaTheme';
import { AppText } from '@/ui/AppText';
import { ALPHABET } from '@/writing/letterPaths';
import { letterStats, type LetterStats } from '@/writing/mastery';
import { ProgressRing } from '@/writing/WritingParts';

const TOUR: TourStep[] = [{ title: 'mastery_tour_title', description: 'mastery_tour_desc' }];

/** The original Letter Mastery menu: search, A–Z cards showing progress, and the progress dashboard. */
export default function LetterMastery() {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const [query, setQuery] = useState('');
  const tour = useFeatureTour('mastery');
  const feedback = useFeedback();
  if (!profile) return <Redirect href="/login" />;

  const reports = progress.mastery ?? [];
  const letters = ALPHABET.filter((l) => !query.trim() || l.toLowerCase().includes(query.trim().toLowerCase()));
  const columns = width > 700 ? 6 : 4;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <View style={styles.topNav} />
        <FlatList
          key={columns}
          data={letters}
          keyExtractor={(item) => item}
          numColumns={columns}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.listContent, { paddingBottom: 110 + insets.bottom, paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.header}>
              <AppText size={28} weight="bold" center color={DT.text.primary} accessibilityRole="header" style={styles.title}>
                {t('mastery_title')}
              </AppText>
              <AppText size={16} weight="semibold" center color={DT.text.secondary} style={styles.subtitle}>
                {t('mastery_subtitle')}
              </AppText>
              <View style={styles.searchBar}>
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('mastery_search')}
                  placeholderTextColor={DT.text.muted}
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={2}
                  accessibilityLabel={t('mastery_search')}
                />
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <AppText color={DT.text.muted}>{t('mastery_no_letters')}</AppText>
            </View>
          }
          renderItem={({ item }) => (
            <LetterItem
              letter={item}
              stats={letterStats(reports, item)}
              onPress={() => {
                feedback.tap();
                router.push({ pathname: '/mastery/write/[letter]', params: { letter: item } });
              }}
            />
          )}
        />
      </SafeAreaView>

      <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            feedback.tap();
            router.push({ pathname: '/parent/mastery/[childId]', params: { childId: profile.id } });
          }}
          style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}
        >
          <AppText size={17} weight="bold" color={DT.text.onDark}>
            {t('mastery_grownups_dashboard')}
          </AppText>
        </Pressable>
      </View>

      <BackButton placement="floating" />
      <SeriInfoButton onPress={tour.open} color={DT.accent.navy} />
      <FocusTracker feature="writing" />
      <FeatureTour visible={tour.visible} steps={TOUR} onClose={tour.close} />
    </View>
  );
}

const STATUS_COLOR = {
  mastered: DT.text.success,
  struggling: DT.text.error,
  learning: DT.accent.amber,
  new: DT.surface.cardBorder,
} as const;

function LetterItem({ letter, stats, onPress }: { letter: string; stats: LetterStats; onPress: () => void }) {
  const { t } = useT();
  const statusText = t(`mastery_status_${stats.status}`);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${letter}. ${statusText}`}
      onPress={onPress}
      style={({ pressed }) => [styles.letterItem, { borderColor: STATUS_COLOR[stats.status] }, pressed && styles.pressed]}
    >
      <AppText size={48} fixed weight="bold" color={DT.text.primary} style={styles.letterText}>
        {letter}
      </AppText>
      {stats.sessions > 0 ? (
        <View style={styles.statsContainer}>
          <AppText size={12} fixed weight="bold" color={DT.text.muted}>
            {String(stats.sessions)}
          </AppText>
          <ProgressRing progress={stats.averageAccuracy / 100} size={24} color={stats.averageAccuracy >= 80 ? DT.text.success : DT.accent.amber} />
        </View>
      ) : null}
      {stats.status === 'mastered' || stats.status === 'struggling' ? (
        <View style={[styles.badge, { backgroundColor: STATUS_COLOR[stats.status] }]}>
          <AppText size={14} fixed weight="bold" color="#FFFFFF">
            {stats.status === 'mastered' ? '✓' : '!'}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: DT.bg.cream },
  topNav: { height: 52 },
  listContent: { paddingTop: 8 },
  header: { marginBottom: 24, alignItems: 'center', paddingHorizontal: 8 },
  title: { marginBottom: 4 },
  subtitle: { marginBottom: 24 },
  searchBar: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: DT.surface.card,
    borderRadius: DT.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...DT.shadow.soft,
    borderWidth: 1,
    borderColor: DT.surface.cardBorder,
  },
  searchInput: { fontSize: 16, color: DT.text.primary, fontWeight: '500', paddingVertical: 2 },
  letterItem: {
    flex: 1,
    aspectRatio: 1,
    margin: 8,
    backgroundColor: DT.surface.card,
    borderRadius: DT.radius.lg,
    ...DT.shadow.soft,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  letterText: { textAlign: 'center', lineHeight: 60 },
  statsContainer: { position: 'absolute', bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  badge: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  empty: { padding: 40, alignItems: 'center' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderTopWidth: 1,
    borderTopColor: DT.surface.divider,
    alignItems: 'center',
  },
  footerButton: { width: '100%', maxWidth: 640, backgroundColor: DT.accent.navy, borderRadius: DT.radius.lg, paddingVertical: 16, alignItems: 'center', ...DT.shadow.medium },
  pressed: { opacity: 0.8 },
});
