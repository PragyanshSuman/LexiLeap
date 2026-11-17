import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { pictureFor } from '@/content/words';
import { ACTIVITIES } from '@/engine/catalog';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useTheme } from '@/theme/useTheme';
import { AnswerTile, type TileState } from '@/ui/AnswerTile';
import { AppText } from '@/ui/AppText';
import { SoundButton } from '@/ui/SpeechControls';
import { generateRhymeTrainRounds, type RhymeTrainRound } from './generators';
import { TileGrid } from './shared';
import type { ActivityDefinition, RoundProps } from './types';

/**
 * Rhyme Train (the original Rhyme Time's "coming soon" mode, now playable): the engine carries a word,
 * and the child loads every carriage whose word rhymes with it. Each wrong carriage counts as a try;
 * when the train is full it chugs away.
 */
function RhymeTrainRoundView({ round, revealed, disabled, onAnswer, accent }: RoundProps<RhymeTrainRound>) {
  const { t } = useT();
  const { colors, prefs, space } = useTheme();
  const feedback = useFeedback();
  const [loaded, setLoaded] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string[]>([]);
  const [lastWrong, setLastWrong] = useState<string | null>(null);
  const [depart] = useState(() => new Animated.Value(0));
  const shown = revealed ? round.answers : loaded;
  const full = shown.length === round.answers.length;

  // A full train chugs off.
  useEffect(() => {
    if (!full || prefs.reduceMotion) return;
    Animated.timing(depart, { toValue: 1, duration: 900, delay: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }).start();
  }, [full, depart, prefs.reduceMotion]);

  const choose = (word: string) => {
    feedback.speak(word);
    if (round.answers.includes(word)) {
      const next = [...loaded, word];
      setLoaded(next);
      if (next.length === round.answers.length) onAnswer({ correct: true });
      else feedback.tap();
    } else {
      setWrong((w) => [...w, word]);
      setLastWrong(word);
      onAnswer({ correct: false });
    }
  };

  const stateOf = (word: string): TileState => {
    if (shown.includes(word)) return revealed && !loaded.includes(word) ? 'revealed' : 'correct';
    if (wrong.includes(word)) return word === lastWrong ? 'wrong' : 'faded';
    return 'idle';
  };

  const translateX = depart.interpolate({ inputRange: [0, 1], outputRange: [0, 600] });
  const columns = round.options.length <= 4 ? 2 : 3;

  return (
    <View style={styles.root}>
      <View style={[styles.track, { gap: space(2) }]}>
        <Animated.View style={[styles.train, { transform: [{ translateX }] }]} accessible accessibilityLabel={t('train_label', { word: round.engine, n: shown.length, total: round.answers.length })}>
          {/* Carriages fill from the engine backwards, so they're drawn right to left. */}
          {round.answers.map((_, i) => {
            const word = shown[round.answers.length - 1 - i];
            return (
              <View key={i} style={[styles.carriage, { borderColor: word ? accent : colors.border, borderStyle: word ? 'solid' : 'dashed', backgroundColor: word ? `${accent}22` : colors.surface }]}>
                <AppText size={28} fixed>
                  {word ? pictureFor(word) : ' '}
                </AppText>
                <AppText size={12} fixed weight="bold" numberOfLines={1} color={colors.textMuted}>
                  {word ?? ''}
                </AppText>
              </View>
            );
          })}
          <View style={[styles.engine, { backgroundColor: accent }]}>
            <AppText size={36} fixed>
              {pictureFor(round.engine)}
            </AppText>
            <AppText size={16} fixed weight="bold" color="#FFFFFF">
              {round.engine}
            </AppText>
            <AppText size={22} fixed style={styles.engineIcon}>
              🚂
            </AppText>
          </View>
        </Animated.View>
        <View style={[styles.rail, { backgroundColor: colors.border }]} />
      </View>

      <View style={styles.promptRow}>
        <AppText variant="heading" center style={styles.flex}>
          {t('train_prompt', { word: round.engine })}
        </AppText>
        <SoundButton label={t('round_hear_it')} color={accent} onPress={() => feedback.speak(round.engine)} />
      </View>

      <TileGrid count={round.options.length} columns={columns} maxTile={150} aspect={1}>
        {(size, i) => {
          const word = round.options[i];
          const state = stateOf(word);
          return (
            <AnswerTile
              state={state}
              disabled={disabled || revealed || full || state !== 'idle'}
              accessibilityLabel={word}
              onPress={() => choose(word)}
              style={{ height: size }}
            >
              <AppText size={Math.round(size * 0.36)} fixed style={{ lineHeight: Math.round(size * 0.46) }}>
                {pictureFor(word)}
              </AppText>
              <AppText variant="label" weight="bold" center numberOfLines={1}>
                {word}
              </AppText>
            </AnswerTile>
          );
        }}
      </TileGrid>
    </View>
  );
}

export const rhymeTrain: ActivityDefinition<RhymeTrainRound> = {
  meta: ACTIVITIES['rhyme-train'],
  roundsPerSession: 5,
  maxAttempts: 3,
  generate: ({ level, rng }) => generateRhymeTrainRounds(level, rng, 5),
  prompt: (r) => `Load the train. Find all the words that rhyme with ${r.engine}.`,
  reveal: (r) => `${r.answers.join(', ')} rhyme with ${r.engine}.`,
  tour: [
    { title: 'tour_train_title', description: 'tour_train_desc' },
    { title: 'tour_train_load_title', description: 'tour_train_load_desc' },
  ],
  Round: RhymeTrainRoundView,
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  track: { paddingTop: 8, overflow: 'hidden' },
  train: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6 },
  carriage: { width: 68, height: 74, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  engine: { width: 104, height: 96, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderTopRightRadius: 36 },
  engineIcon: { position: 'absolute', top: -14, right: -6 },
  rail: { height: 4, borderRadius: 2, marginHorizontal: 8 },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
});
