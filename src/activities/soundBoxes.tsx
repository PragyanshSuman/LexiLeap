import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { pictureFor } from '@/content/words';
import { ACTIVITIES } from '@/engine/catalog';
import { useFeedback } from '@/services/feedback';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { generateSoundBoxRounds, type SoundBoxRound } from './generators';
import { Picture, Prompt } from './shared';
import type { ActivityDefinition, RoundProps } from './types';
import { useT } from '@/i18n';

const MAX_BOXES = 6;

function SoundBoxRoundView({ round, attempt, revealed, disabled, onAnswer, accent }: RoundProps<SoundBoxRound>) {
  const { t } = useT();
  const { colors, radius, space } = useTheme();
  const feedback = useFeedback();
  // Taps belong to an attempt, so every retry starts from zero.
  const [tapState, setTapState] = useState({ attempt, taps: 0 });
  const taps = tapState.attempt === attempt ? tapState.taps : 0;
  const setTaps = (n: number) => setTapState({ attempt, taps: n });
  const [solved, setSolved] = useState(false);

  // Once answered (or revealed), the boxes show how each sound is spelled.
  const showSounds = solved || revealed;
  const boxCount = showSounds ? round.sounds.length : Math.max(taps, 1);
  const locked = disabled || showSounds;

  const tap = () => {
    if (locked || taps >= MAX_BOXES) return;
    feedback.tap();
    setTaps(taps + 1);
  };

  const done = () => {
    const correct = taps === round.sounds.length;
    if (correct) setSolved(true);
    onAnswer({ correct });
  };

  return (
    <View style={styles.root}>
      <Prompt>
        <Picture emoji={pictureFor(round.word)} word={showSounds ? round.word : undefined} size={84} />
        <AppText muted center>
          {showSounds ? t('round_sounds_count', { n: round.sounds.length }) : t('round_tap_box')}
        </AppText>
      </Prompt>

      <View style={[styles.boxes, { gap: space(2) }]} accessible accessibilityLabel={showSounds ? `Sounds: ${round.sounds.join(', ')}` : `${taps} sounds tapped`}>
        {Array.from({ length: boxCount }, (_, i) => {
          const filled = showSounds || i < taps;
          return (
            <View
              key={i}
              style={[
                styles.box,
                {
                  borderRadius: radius.sm,
                  borderColor: showSounds ? colors.success : colors.primary,
                  backgroundColor: showSounds ? colors.successSoft : filled ? colors.primarySoft : 'transparent',
                  borderStyle: filled ? 'solid' : 'dashed',
                },
              ]}
            >
              {showSounds ? (
                <AppText size={26} weight="bold" fixed>
                  {round.sounds[i]}
                </AppText>
              ) : filled ? (
                <View style={[styles.counter, { backgroundColor: colors.primary }]} />
              ) : null}
            </View>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('round_tap_sound')}
        disabled={locked}
        onPress={tap}
        style={({ pressed }) => [
          styles.tapper,
          { borderRadius: radius.lg, backgroundColor: pressed ? colors.primarySoft : colors.surface, borderColor: colors.primary },
          locked && styles.dim,
        ]}
      >
        <AppText variant="heading" color={colors.primary}>
          {t('round_tap_sound')}
        </AppText>
      </Pressable>

      <View style={[styles.row, { gap: space(3) }]}>
        <Button color={accent} label={t('start_over')} variant="secondary" icon="refresh" compact disabled={locked || taps === 0} onPress={() => setTaps(0)} style={styles.flex} />
        <Button label={t('done')} icon="checkmark" compact disabled={locked || taps === 0} onPress={done} style={styles.flex} color={accent} />
      </View>
    </View>
  );
}

export const soundBoxes: ActivityDefinition<SoundBoxRound> = {
  meta: ACTIVITIES['sound-boxes'],
  roundsPerSession: 6,
  maxAttempts: 2,
  generate: ({ level, rng }) => generateSoundBoxRounds(level, rng, 6),
  prompt: (r) => `${r.word}. Say ${r.word} slowly. How many sounds can you hear?`,
  reveal: (r) => `${r.word} has ${r.sounds.length} sounds.`,
  Round: SoundBoxRoundView,
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-evenly' },
  boxes: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', minHeight: 64 },
  box: { width: 56, height: 64, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  counter: { width: 18, height: 18, borderRadius: 9 },
  tapper: { minHeight: 88, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.5 },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
});
