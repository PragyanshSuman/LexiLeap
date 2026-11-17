import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { pictureFor } from '@/content/words';
import { ACTIVITIES } from '@/engine/catalog';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useTheme } from '@/theme/useTheme';
import { AnswerTile } from '@/ui/AnswerTile';
import { AppText } from '@/ui/AppText';
import { PopIn } from '@/ui/motion';
import { generateRhymeRounds, type RhymeRound } from './generators';
import { TileGrid, useChoiceRound } from './shared';
import type { ActivityDefinition, RoundProps } from './types';

/** The original Rhyme Time: MC Frog bounces along, HYPE score and combos on a night-sky stage. */
function RhymeRoundView({ round, revealed, disabled, onAnswer, score, combo }: RoundProps<RhymeRound>) {
  const { t } = useT();
  const { prefs } = useTheme();
  const feedback = useFeedback();
  const { choose, stateOf, isLocked } = useChoiceRound(round.answer, revealed, onAnswer);
  const solved = stateOf(round.answer) === 'correct';
  const [bounce] = useState(() => new Animated.Value(1));
  const [spin] = useState(() => new Animated.Value(0));

  // MC Frog bops to the beat…
  useEffect(() => {
    if (prefs.reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1.1, duration: 400, easing: Easing.bounce, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce, prefs.reduceMotion]);

  // …and spins with joy on a right answer.
  useEffect(() => {
    if (!solved || prefs.reduceMotion) return;
    Animated.sequence([Animated.timing(spin, { toValue: 1, duration: 200, useNativeDriver: true }), Animated.spring(spin, { toValue: 0, useNativeDriver: true })]).start();
  }, [solved, spin, prefs.reduceMotion]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const columns = round.options.length === 3 ? 3 : 2;

  return (
    <View style={styles.root}>
      <View style={styles.hud}>
        <View>
          <AppText variant="caption" weight="bold" color="#A5B4FC" fixed>
            {t('game_hype')}
          </AppText>
          <AppText variant="title" weight="bold" color="#FFFFFF" fixed>
            {String(score)}
          </AppText>
        </View>
        {combo > 1 ? (
          <View style={styles.combo}>
            <AppText variant="caption" weight="bold" color="#FFFFFF" fixed>
              {t('game_combo', { n: combo })}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.stageRow}>
        <Animated.View style={[styles.mascot, { transform: [{ scale: bounce }, { rotate }] }]} accessibilityElementsHidden importantForAccessibility="no">
          <AppText size={64} fixed>
            🐸
          </AppText>
          <View style={styles.mascotLabel}>
            <AppText variant="caption" weight="bold" color="#818CF8" fixed>
              {t('game_mascot_frog')}
            </AppText>
          </View>
        </Animated.View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('game_rhyme_prompt', { word: round.target })} ${t('game_tap_hint')}`}
          onPress={() => feedback.speak(round.target)}
          style={({ pressed }) => [styles.prompt, pressed && styles.pressed]}
        >
          <AppText variant="label" weight="bold" center color="#FFFFFF">
            {t('game_rhyme_prompt', { word: round.target })}
          </AppText>
          <AppText size={56} fixed>
            {pictureFor(round.target)}
          </AppText>
          <AppText variant="caption" color="#C7D2FE">
            {t('game_tap_hint')} 🔊
          </AppText>
        </Pressable>
      </View>

      <TileGrid count={round.options.length} columns={columns} maxTile={150} aspect={1.1}>
        {(size, i) => {
          const option = round.options[i];
          return (
            <PopIn index={i}>
              <AnswerTile
                state={stateOf(option)}
                disabled={disabled || isLocked(option)}
                onPress={() => choose(option)}
                accessibilityLabel={option}
                style={{ height: size * 1.1 }}
              >
                <AppText fixed size={Math.round(size * 0.36)} style={{ lineHeight: Math.round(size * 0.48) }} accessibilityElementsHidden>
                  {pictureFor(option)}
                </AppText>
                <AppText fixed variant="label" weight="bold" center numberOfLines={1} adjustsFontSizeToFit>
                  {option}
                </AppText>
              </AnswerTile>
            </PopIn>
          );
        }}
      </TileGrid>
    </View>
  );
}

export const rhyme: ActivityDefinition<RhymeRound> = {
  meta: ACTIVITIES.rhyme,
  roundsPerSession: 8,
  maxAttempts: 2,
  generate: ({ level, rng }) => generateRhymeRounds(level, rng, 8),
  prompt: (r) => `What rhymes with ${r.target}? ${r.options.join(', or ')}?`,
  reveal: (r) => `${r.target} and ${r.answer} rhyme!`,
  stage: { colors: ['#312E81', '#1E1B4B'], dark: true },
  tour: [
    { title: 'tour_rhyme_welcome_title', description: 'tour_rhyme_welcome_desc' },
    { title: 'tour_rhyme_match_title', description: 'tour_rhyme_match_desc' },
    { title: 'tour_rhyme_listen_title', description: 'tour_rhyme_listen_desc' },
  ],
  Round: RhymeRoundView,
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  combo: { backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, transform: [{ rotate: '-5deg' }] },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  mascot: { alignItems: 'center' },
  mascotLabel: { backgroundColor: '#1E1B4B', paddingHorizontal: 8, borderRadius: 4, marginTop: 2 },
  prompt: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pressed: { opacity: 0.8 },
});
