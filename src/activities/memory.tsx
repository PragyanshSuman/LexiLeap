import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spokenLetterName } from '@/content/letters';
import { ACTIVITIES } from '@/engine/catalog';
import { useFeedback } from '@/services/feedback';
import { useTheme } from '@/theme/useTheme';
import { AnswerTile, type TileState } from '@/ui/AnswerTile';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { generateMemoryRounds, type MemoryRound } from './generators';
import { Prompt, TileGrid } from './shared';
import type { ActivityDefinition, RoundProps } from './types';
import { useT } from '@/i18n';

const LIGHT_MS = 750;
const GAP_MS = 300;

function MemoryRoundView({ round, attempt, revealed, disabled, onAnswer, accent }: RoundProps<MemoryRound>) {
  const { t } = useT();
  const { colors } = useTheme();
  const feedback = useFeedback();
  const [phase, setPhase] = useState<'watch' | 'repeat'>('watch');
  const [lit, setLit] = useState<string | null>(null);
  const [entered, setEntered] = useState<string[]>([]);
  const [wrongTile, setWrongTile] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const playSequence = useCallback(() => {
    clearTimers();
    // Every step, including the reset, runs on a timer so replays can start from effects.
    timers.current.push(
      setTimeout(() => {
        setPhase('watch');
        setEntered([]);
        setWrongTile(null);
        setLit(null);
      }, 0),
    );
    round.sequence.forEach((letter, i) => {
      const at = 700 + i * (LIGHT_MS + GAP_MS);
      timers.current.push(
        setTimeout(() => {
          setLit(letter);
          feedback.speak(spokenLetterName(letter));
        }, at),
        setTimeout(() => setLit(null), at + LIGHT_MS),
      );
    });
    const end = 700 + round.sequence.length * (LIGHT_MS + GAP_MS);
    timers.current.push(setTimeout(() => setPhase('repeat'), end));
  }, [round.sequence, feedback]);

  // Play on first show and again for each retry.
  useEffect(() => {
    playSequence();
  }, [attempt, playSequence]);

  const tap = (letter: string) => {
    if (phase !== 'repeat' || revealed) return;
    const expected = round.sequence[entered.length];
    if (letter === expected) {
      feedback.tap();
      const next = [...entered, letter];
      setEntered(next);
      if (next.length === round.sequence.length) onAnswer({ correct: true });
    } else {
      setWrongTile(letter);
      onAnswer({ correct: false });
    }
  };

  const stateOf = (letter: string): TileState => {
    if (lit === letter) return 'selected';
    if (wrongTile === letter) return 'wrong';
    if (phase === 'repeat' && entered.includes(letter)) return 'correct';
    return 'idle';
  };

  return (
    <View style={styles.root}>
      <Prompt>
        <AppText variant="heading" center>
          {revealed ? t('round_order_was') : phase === 'watch' ? t('round_watch') : t('round_repeat')}
        </AppText>
        {revealed ? (
          <AppText variant="title" center color={colors.success}>
            {round.sequence.join('  →  ')}
          </AppText>
        ) : null}
        <View style={styles.slots} accessible accessibilityLabel={`${entered.length} of ${round.sequence.length} tapped`}>
          {round.sequence.map((_, i) => (
            <View
              key={i}
              style={[styles.slot, { borderColor: colors.border, backgroundColor: i < entered.length ? colors.success : colors.surfaceAlt }]}
            />
          ))}
        </View>
      </Prompt>
      <TileGrid count={round.pad.length} columns={round.pad.length === 4 ? 2 : 3} maxTile={110}>
        {(size, i) => {
          const letter = round.pad[i];
          return (
            <AnswerTile
              state={stateOf(letter)}
              disabled={disabled || phase === 'watch'}
              onPress={() => tap(letter)}
              accessibilityLabel={`Letter ${letter}`}
              style={{ height: size }}
            >
              <AppText fixed size={Math.round(size * 0.5)} weight="bold" style={{ lineHeight: Math.round(size * 0.7) }}>
                {letter}
              </AppText>
            </AnswerTile>
          );
        }}
      </TileGrid>
      <Button label={t('round_watch_again')} icon="eye" variant="ghost" compact disabled={disabled || phase === 'watch'} onPress={playSequence} color={accent} />
    </View>
  );
}

export const memory: ActivityDefinition<MemoryRound> = {
  meta: ACTIVITIES.memory,
  roundsPerSession: 5,
  maxAttempts: 2,
  generate: ({ level, rng }) => generateMemoryRounds(level, rng, 5),
  // The round speaks each letter as it lights up, so there's no separate prompt.
  prompt: () => '',
  reveal: (r) => `The order was ${r.sequence.map(spokenLetterName).join(', ')}.`,
  timesResponses: false,
  Round: MemoryRoundView,
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-evenly' },
  slots: { flexDirection: 'row', gap: 8 },
  slot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1 },
});
