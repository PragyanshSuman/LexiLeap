import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { beatsOf } from '@/content/syllables';
import { pictureFor } from '@/content/words';
import { ACTIVITIES } from '@/engine/catalog';
import { useFeedback } from '@/services/feedback';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { generateSyllableRounds, type SyllableRound } from './generators';
import { Picture, Prompt } from './shared';
import type { ActivityDefinition, RoundProps } from './types';
import { useT } from '@/i18n';

const MAX_TAPS = 6;

function SyllableRoundView({ round, attempt, revealed, disabled, onAnswer, accent }: RoundProps<SyllableRound>) {
  const { t } = useT();
  const { colors, space, prefs } = useTheme();
  const feedback = useFeedback();
  // Taps belong to an attempt, so every retry starts from zero.
  const [tapState, setTapState] = useState({ attempt, taps: 0 });
  const taps = tapState.attempt === attempt ? tapState.taps : 0;
  const setTaps = (n: number) => setTapState({ attempt, taps: n });
  const [bounce] = useState(() => new Animated.Value(1));

  const hit = () => {
    if (disabled || revealed || taps >= MAX_TAPS) return;
    feedback.tap();
    setTaps(taps + 1);
    if (!prefs.reduceMotion) {
      bounce.setValue(0.9);
      Animated.spring(bounce, { toValue: 1, friction: 3, useNativeDriver: true }).start();
    }
  };

  const beats = beatsOf(round.word);
  return (
    <View style={styles.root}>
      <Prompt>
        <Picture emoji={pictureFor(round.word)} word={round.word} size={80} />
        {revealed ? (
          <AppText variant="heading" color={colors.success} center>
            {beats.join(' · ')} = {round.beats}
          </AppText>
        ) : (
          <AppText muted center>
            {t('round_tap_drum')}
          </AppText>
        )}
      </Prompt>

      <View style={[styles.dots, { gap: space(2) }]} accessible accessibilityLabel={`${taps} beats tapped`}>
        {Array.from({ length: Math.max(taps, revealed ? round.beats : 0, 1) }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { borderColor: colors.border, backgroundColor: i < (revealed ? round.beats : taps) ? colors.warning : 'transparent' },
            ]}
          />
        ))}
      </View>

      <Animated.View style={[styles.center, { transform: [{ scale: bounce }] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('round_drum_label')}
          disabled={disabled || revealed}
          onPress={hit}
          style={({ pressed }) => [
            styles.drum,
            { backgroundColor: `${accent}22`, borderColor: accent },
            pressed && { backgroundColor: colors.warningSoft },
          ]}
        >
          <AppText size={72} style={{ lineHeight: 88 }} accessibilityElementsHidden>
            🥁
          </AppText>
        </Pressable>
      </Animated.View>

      <View style={[styles.row, { gap: space(3) }]}>
        <Button color={accent} label={t('start_over')} variant="secondary" icon="refresh" compact disabled={disabled || revealed || taps === 0} onPress={() => setTaps(0)} style={styles.flex} />
        <Button color={accent} label={t('done')} icon="checkmark" compact disabled={disabled || revealed || taps === 0} onPress={() => onAnswer({ correct: taps === round.beats })} style={styles.flex} />
      </View>
    </View>
  );
}

export const syllables: ActivityDefinition<SyllableRound> = {
  meta: ACTIVITIES.syllables,
  roundsPerSession: 6,
  maxAttempts: 2,
  generate: ({ level, rng }) => generateSyllableRounds(level, rng, 6),
  prompt: (r) => `${r.word}. How many beats are in ${r.word}?`,
  reveal: (r) => `${beatsOf(r.word).join('. ')}. ${r.word} has ${r.beats} ${r.beats === 1 ? 'beat' : 'beats'}.`,
  Round: SyllableRoundView,
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-evenly' },
  center: { alignItems: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', minHeight: 28 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  drum: { width: 168, height: 168, borderRadius: 84, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
});
