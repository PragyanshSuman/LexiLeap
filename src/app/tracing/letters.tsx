import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Animated, FlatList, Image, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeatureTour, useFeatureTour, type TourStep } from '@/components/FeatureTour';
import { FocusTracker } from '@/components/FocusTracker';
import { SeriInfoButton } from '@/components/seri/SeriButtons';
import { BackButton } from '@/ui/BackButton';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useActiveProfile, useProgress } from '@/store/appStore';
import { DT } from '@/theme/dyslexiaTheme';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { LETTER_TILES } from '@/tracing/letterTiles';
import { LOWERCASE } from '@/content/letters';
import { ALPHABET } from '@/tracing/seriLetters';
import { SmallLetterTile } from '@/tracing/SmallLetterTile';

const TOUR: TourStep[] = [{ title: 'menu_tour_welcome_title', description: 'menu_tour_welcome_desc' }];

/** A letter traced at least this neatly gets a small tick on its tile. */
const CONFIDENT = 0.8;

/**
 * The original "Choose a Letter" menu: picture tiles for A–Z (and a–z, drawn in the same style), 4 across
 * on phones and 6 on tablets, with a switch between capital and small letters.
 */
export default function TracingLetterMenu() {
  const { t } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const tour = useFeatureTour('tracing-menu');
  const params = useLocalSearchParams<{ set?: string }>();
  const [set, setSet] = useState<'upper' | 'lower'>(params.set === 'lower' ? 'lower' : 'upper');
  const feedback = useFeedback();
  if (!profile) return <Redirect href="/login" />;

  const tablet = width > 700;
  const columns = tablet ? 6 : 4;
  const gap = tablet ? 16 : 12;
  const card = Math.floor((width - insets.left - insets.right - gap * (columns + 1)) / columns);
  const dark = colors.isDark;

  return (
    <View style={[styles.bg, { backgroundColor: dark ? colors.bg : DT.bg.skyBlue }]}>
      <BackButton placement="floating" />
      <SeriInfoButton onPress={tour.open} color={DT.accent.indigo} />
      <View style={[styles.header, { paddingTop: insets.top + 64, backgroundColor: dark ? 'rgba(15,23,42,0.4)' : 'rgba(255,255,255,0.4)', borderBottomColor: dark ? colors.border : DT.surface.divider }]}>
        <AppText size={28} weight="bold" color={dark ? colors.text : DT.text.primary} accessibilityRole="header" style={styles.title}>
          {t('menu_choose_letter')}
        </AppText>
        <AppText size={16} weight="semibold" color={dark ? colors.textMuted : DT.text.secondary} style={styles.subtitle}>
          {t('menu_letters_available', { n: ALPHABET.length })}
        </AppText>
        <View style={styles.switch} accessibilityRole="tablist">
          {(['upper', 'lower'] as const).map((option) => {
            const active = set === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(option === 'upper' ? 'letters_capitals_label' : 'letters_small_label')}
                hitSlop={6}
                onPress={() => {
                  feedback.tap();
                  setSet(option);
                }}
                style={[styles.switchOption, active && styles.switchActive]}
              >
                <AppText size={20} fixed weight="bold" color={active ? '#FFFFFF' : DT.accent.indigo}>
                  {option === 'upper' ? 'ABC' : 'abc'}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        key={`${columns}-${set}`}
        data={set === 'upper' ? ALPHABET : LOWERCASE}
        keyExtractor={(item) => item}
        numColumns={columns}
        contentContainerStyle={[styles.grid, { paddingHorizontal: gap / 2 + insets.left, paddingBottom: 28 + insets.bottom }]}
        renderItem={({ item }) => (
          <LiftedCard
            size={card}
            margin={gap / 2}
            label={set === 'upper' ? item : t('trace_small_letter_intro', { letter: item })}
            tile={set === 'upper' ? <Image source={LETTER_TILES[item]} style={styles.image} resizeMode="contain" /> : <SmallLetterTile letter={item} size={Math.round(card * 0.96)} />}
            done={(progress.letters[item]?.best ?? 0) >= CONFIDENT}
            onPress={() => router.push({ pathname: '/tracing/trace/[letter]', params: { letter: item } })}
          />
        )}
      />
      <FocusTracker feature="trace" />
      <FeatureTour visible={tour.visible} steps={TOUR} onClose={tour.close} />
    </View>
  );
}

/** The original lifted card: soft double shadow, top gloss, and a gentle spring when pressed. */
function LiftedCard({ label, size, margin, tile, done, onPress }: { label: string; size: number; margin: number; tile: ReactNode; done: boolean; onPress: () => void }) {
  const { t } = useT();
  const feedback = useFeedback();
  const { prefs } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const spring = (toValue: number) => {
    if (!prefs.reduceMotion) Animated.spring(scale, { toValue, useNativeDriver: true, friction: 6 }).start();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={done ? `${label}, ${t('letters_confident')}` : label}
      onPressIn={() => spring(0.97)}
      onPressOut={() => spring(1)}
      onPress={() => {
        feedback.tap();
        onPress();
      }}
    >
      <Animated.View style={[styles.cardWrap, { width: size, height: size, margin, transform: [{ scale }] }]}>
        <View style={styles.shadowA} />
        <View style={styles.cardInner}>
          {tile}
          <View pointerEvents="none" style={styles.gloss} />
          {done ? (
            <View style={styles.doneBadge} accessibilityElementsHidden>
              <AppText size={12} fixed weight="bold" color="#FFFFFF">
                ✓
              </AppText>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  header: { paddingHorizontal: 24, paddingBottom: 20, borderBottomWidth: 1 },
  title: { letterSpacing: DT.typography.letterSpacingUI },
  subtitle: { marginTop: 4 },
  switch: { flexDirection: 'row', alignSelf: 'flex-start', marginTop: 12, borderRadius: 22, borderWidth: 2, borderColor: DT.accent.indigo, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.85)' },
  switchOption: { minWidth: 76, minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  switchActive: { backgroundColor: DT.accent.indigo },
  grid: { marginTop: 10, paddingTop: 6 },
  cardWrap: { borderRadius: 22 },
  shadowA: {
    ...Platform.select({
      ios: { shadowColor: DT.shadow.soft.shadowColor, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 20 },
      default: { elevation: 8 },
    }),
    borderRadius: 22,
    position: 'absolute',
    left: 0,
    right: 0,
    top: 4,
    bottom: 0,
    backgroundColor: DT.surface.card,
  },
  cardInner: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: DT.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: DT.shadow.soft.shadowColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 8 },
      default: { elevation: 6 },
    }),
  },
  image: { width: '96%', height: '96%', borderRadius: 20 },
  gloss: { position: 'absolute', left: 10, right: 10, top: 10, height: '40%', borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: DT.surface.softOverlay },
  doneBadge: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
});
