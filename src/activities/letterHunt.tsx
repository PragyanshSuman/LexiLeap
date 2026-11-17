import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { areLookalikes, spokenLetterName } from '@/content/letters';
import { ACTIVITIES } from '@/engine/catalog';
import { useFeedback } from '@/services/feedback';
import { useTheme } from '@/theme/useTheme';
import { AnswerTile, type TileState } from '@/ui/AnswerTile';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { generateLetterHuntRounds, type LetterHuntRound } from './generators';
import { TileGrid } from './shared';
import type { ActivityDefinition, RoundProps } from './types';
import { useT } from '@/i18n';

/** Each wrong tap costs this much of the round score. */
const FALSE_TAP_PENALTY = 0.1;

function LetterHuntRoundView({ round, revealed, disabled, onAnswer, accent }: RoundProps<LetterHuntRound>) {
  const { t } = useT();
  const { colors, space } = useTheme();
  const feedback = useFeedback();
  const total = round.cells.filter((c) => c === round.target).length;
  const [found, setFound] = useState<number[]>([]);
  const [flash, setFlash] = useState<number | null>(null);
  const falseTaps = useRef(0);
  const mixUps = useRef<[string, string][]>([]);
  const submitted = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const submit = (foundCount: number) => {
    if (submitted.current) return;
    submitted.current = true;
    const score = Math.max(0, foundCount / total - falseTaps.current * FALSE_TAP_PENALTY);
    onAnswer({
      correct: foundCount === total && falseTaps.current <= 1,
      score,
      final: true,
      confusions: mixUps.current.length ? mixUps.current : undefined,
    });
  };

  const tap = (i: number) => {
    if (found.includes(i) || submitted.current) return;
    if (round.cells[i] === round.target) {
      feedback.tap();
      const next = [...found, i];
      setFound(next);
      if (next.length === total) setTimeout(() => submit(next.length), 300);
    } else {
      falseTaps.current += 1;
      if (areLookalikes(round.target, round.cells[i])) mixUps.current.push([round.target, round.cells[i]]);
      feedback.tryAgain();
      setFlash(i);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 500);
    }
  };

  const stateOf = (i: number): TileState => {
    if (found.includes(i)) return 'correct';
    if (flash === i) return 'wrong';
    if (revealed && round.cells[i] === round.target) return 'revealed';
    return 'idle';
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { gap: space(3) }]}>
        <AppText variant="label">{t('round_find_every')}</AppText>
        <View style={[styles.target, { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
          <AppText size={40} weight="bold" style={{ lineHeight: 52 }}>
            {round.target}
          </AppText>
        </View>
        <AppText variant="label" muted>
          {t('of', { a: found.length, b: total })}
        </AppText>
      </View>
      <TileGrid count={round.cells.length} columns={round.columns} gap={6} maxTile={72}>
        {(size, i) => (
          <AnswerTile
            state={stateOf(i)}
            disabled={disabled || found.includes(i)}
            onPress={() => tap(i)}
            accessibilityLabel={`${round.cells[i]}${found.includes(i) ? ', found' : ''}`}
            style={{ height: size }}
          >
            <AppText fixed size={Math.round(size * 0.5)} weight="semibold" style={{ lineHeight: Math.round(size * 0.68) }}>
              {round.cells[i]}
            </AppText>
          </AnswerTile>
        )}
      </TileGrid>
      <Button color={accent} label={t('round_found_all')} icon="checkmark" variant="secondary" disabled={disabled} onPress={() => submit(found.length)} />
    </View>
  );
}

export const letterHunt: ActivityDefinition<LetterHuntRound> = {
  meta: ACTIVITIES['letter-hunt'],
  roundsPerSession: 3,
  maxAttempts: 1,
  generate: ({ level, rng }) => generateLetterHuntRounds(level, rng, 3),
  prompt: (r) => `Find every letter ${spokenLetterName(r.target)}.`,
  reveal: (r) => `Here are all the letter ${spokenLetterName(r.target)}s.`,
  timesResponses: false,
  Round: LetterHuntRoundView,
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-evenly', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  target: { width: 64, height: 64, borderRadius: 16, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
