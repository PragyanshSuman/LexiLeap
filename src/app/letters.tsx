import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { FeatureTour, InfoButton, useFeatureTour, type TourStep } from '@/components/FeatureTour';
import { LOWERCASE, UPPERCASE } from '@/content/letters';
import { ACTIVITIES } from '@/engine/catalog';
import { activityKey, useT } from '@/i18n';
import { useActiveProfile, useProgress } from '@/store/appStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { ChoiceChips } from '@/ui/controls';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';

const TOUR: TourStep[] = [
  { title: 'tour_letters_title', description: 'tour_letters_desc' },
  { title: 'tour_letters_colors_title', description: 'tour_letters_colors_desc' },
];

/** Pick a letter to trace, or let the app choose the ones that need practice. */
export default function Letters() {
  const { colors, space, radius } = useTheme();
  const { t } = useT();
  const { width } = useWindowDimensions();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const [set, setSet] = useState<'upper' | 'lower'>('upper');
  const tour = useFeatureTour('letters');

  if (!profile) return <Redirect href="/login" />;
  const letters = set === 'upper' ? UPPERCASE : LOWERCASE;
  const columns = width > 600 ? 7 : 5;
  const size = Math.floor((Math.min(width, 640) - 40 - (columns - 1) * 10) / columns);

  return (
    <Screen
      scroll
      header={<Header title={t(activityKey('trace', 'title'))} subtitle={t('letters_subtitle')} right={<InfoButton onPress={tour.open} />} />}
      footer={<Button label={t('letters_pick')} icon="sparkles" color={ACTIVITIES.trace.color} onPress={() => router.push('/activity/trace')} />}
    >
      <ChoiceChips
        accessibilityLabel="Letter case"
        value={set}
        onChange={setSet}
        options={[
          { value: 'upper', label: t('letters_capitals') },
          { value: 'lower', label: t('letters_small') },
        ]}
      />
      <View style={[styles.grid, { gap: 10, marginTop: space(4) }]}>
        {letters.map((glyph) => {
          const best = progress.letters[glyph]?.best;
          const bg = best === undefined ? colors.surface : best >= 0.8 ? colors.successSoft : best >= 0.5 ? colors.warningSoft : colors.dangerSoft;
          const status = t(
            best === undefined ? 'letters_not_traced' : best >= 0.8 ? 'letters_confident' : best >= 0.5 ? 'letters_getting_there' : 'letters_needs_practice',
          );
          return (
            <Pressable
              key={glyph}
              accessibilityRole="button"
              accessibilityLabel={`${glyph}, ${status}`}
              onPress={() => router.push({ pathname: '/activity/[id]', params: { id: 'trace', focus: glyph } })}
              style={({ pressed }) => [
                styles.cell,
                { width: size, height: size, borderRadius: radius.md, backgroundColor: bg, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <AppText fixed size={Math.round(size * 0.48)} weight="bold" style={{ lineHeight: Math.round(size * 0.66) }}>
                {glyph}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption" muted center style={{ marginTop: space(4) }}>
        {t('letters_legend')}
      </AppText>
      <FeatureTour visible={tour.visible} steps={TOUR} onClose={tour.close} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
});
