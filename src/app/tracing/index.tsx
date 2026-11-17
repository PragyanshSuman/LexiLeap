import { Redirect, router } from 'expo-router';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { FeatureTour, useFeatureTour, type TourStep } from '@/components/FeatureTour';
import { FocusTracker } from '@/components/FocusTracker';
import { SeriInfoButton } from '@/components/seri/SeriButtons';
import { BackButton } from '@/ui/BackButton';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useActiveProfile } from '@/store/appStore';
import { DT } from '@/theme/dyslexiaTheme';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { SmallLetterTile } from '@/tracing/SmallLetterTile';

const CARD_IMAGE = require('../../../assets/images/tracing/button1.png');
const TOUR: TourStep[] = [{ title: 'tour_tracing_playground_title', description: 'tour_tracing_playground_desc' }];

/** The original Letter Tracing dashboard, the "Alphabet Playground": capital letters, and small letters too. */
export default function TracingDashboard() {
  const { t } = useT();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const profile = useActiveProfile();
  const tour = useFeatureTour('tracing-dashboard');
  if (!profile) return <Redirect href="/login" />;

  // The original capped its card at 240 pt; with two cards side by side they share the width.
  const cardSize = Math.min(width >= 700 ? 280 : 200, (width - 96) / 2);
  const dark = colors.isDark;

  return (
    <View style={[styles.bg, { backgroundColor: dark ? colors.bg : DT.bg.skyBlue }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(15,23,42,0.4)' : 'rgba(255, 255, 255, 0.4)' }]} />
      <BackButton placement="floating" />
      <SeriInfoButton onPress={tour.open} color={DT.accent.indigo} />

      <View style={styles.content}>
        <AppText size={32} weight="bold" center fixed color={dark ? colors.text : DT.text.primary} style={styles.title} accessibilityRole="header">
          {t('tour_tracing_playground_title')}
        </AppText>
        <View style={styles.cards}>
          <ModeCard
            label={t('tracing_mode_scalable')}
            onPress={() => router.push('/tracing/letters')}
            picture={<Image source={CARD_IMAGE} style={[styles.cardImage, { width: cardSize, height: cardSize }]} resizeMode="cover" />}
          />
          <ModeCard
            label={t('tracing_mode_small')}
            onPress={() => router.push({ pathname: '/tracing/letters', params: { set: 'lower' } })}
            picture={
              <View style={[styles.cardImage, styles.tileFrame, { width: cardSize, height: cardSize }]}>
                <SmallLetterTile letter="a" size={cardSize - 6} />
              </View>
            }
          />
        </View>
      </View>
      <FocusTracker feature="trace" />
      <FeatureTour visible={tour.visible} steps={TOUR} onClose={tour.close} />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { marginBottom: 40, letterSpacing: DT.typography.letterSpacingUI },
  card: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#0EA5E9',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  cardImage: { borderRadius: 16, borderWidth: 3, borderColor: '#0EA5E9' },
  cardLabel: { marginTop: 14 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20 },
  tileFrame: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});

/** One big picture card on the playground, as in the original. */
function ModeCard({ label, picture, onPress }: { label: string; picture: ReactNode; onPress: () => void }) {
  const feedback = useFeedback();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        feedback.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {picture}
      <AppText size={18} weight="bold" fixed color="#0F172A" style={styles.cardLabel} center>
        {label}
      </AppText>
    </Pressable>
  );
}
