import { StyleSheet, View } from 'react-native';
import { spokenLetterName } from '@/content/letters';
import { ACTIVITIES } from '@/engine/catalog';
import { useT } from '@/i18n';
import { AnswerTile } from '@/ui/AnswerTile';
import { AppText } from '@/ui/AppText';
import { PopIn } from '@/ui/motion';
import { generateOddOneOutRounds, parseFocusPair, type OddOneOutRound } from './generators';
import { TileGrid, useChoiceRound } from './shared';
import type { ActivityDefinition, RoundProps } from './types';

/** The original "Spot It" board: a violet stage with white letter tiles springing in. */
function OddOneOutRoundView({ round, revealed, disabled, onAnswer, score }: RoundProps<OddOneOutRound>) {
  const { t } = useT();
  const { choose, stateOf, isLocked } = useChoiceRound(round.oddIndex, revealed, onAnswer, (i) => round.cells[i]);
  const isWord = round.cells[0].length > 1;
  return (
    <View style={styles.root}>
      <View style={styles.hud}>
        <AppText variant="heading" weight="bold" color="#FFFFFF" style={styles.flex}>
          {t('game_find_odd')}
        </AppText>
        <View style={styles.score}>
          <AppText variant="caption" weight="bold" color="rgba(255,255,255,0.8)" fixed>
            {t('game_score')}
          </AppText>
          <AppText variant="heading" weight="bold" color="#FFFFFF" fixed>
            {String(score)}
          </AppText>
        </View>
      </View>
      <TileGrid count={round.cells.length} columns={round.columns} gap={round.columns >= 5 ? 8 : 10} maxTile={isWord ? 120 : 96} aspect={isWord ? 0.7 : 1}>
        {(size, i) => (
          <PopIn index={i % 8}>
            <AnswerTile
              state={stateOf(i)}
              disabled={disabled || isLocked(i)}
              onPress={() => choose(i)}
              accessibilityLabel={`${round.cells[i]}, ${i + 1}`}
              style={{ height: isWord ? size * 0.7 : size }}
            >
              <AppText fixed size={Math.round(isWord ? size * 0.3 : size * 0.55)} weight="bold" style={{ lineHeight: Math.round(size * (isWord ? 0.45 : 0.75)) }}>
                {round.cells[i]}
              </AppText>
            </AnswerTile>
          </PopIn>
        )}
      </TileGrid>
    </View>
  );
}

const nameOf = (cell: string) => (cell.length === 1 ? `the letter ${spokenLetterName(cell)}` : `the word ${cell}`);

export const oddOneOut: ActivityDefinition<OddOneOutRound> = {
  meta: ACTIVITIES['odd-one-out'],
  roundsPerSession: 8,
  maxAttempts: 2,
  generate: ({ level, rng, focus }) => generateOddOneOutRounds(level, rng, 8, parseFocusPair(focus)),
  prompt: () => 'Find the one that is different.',
  reveal: (r) => `This one is different. It is ${nameOf(r.cells[r.oddIndex])}.`,
  stage: { colors: ['#4F46E5', '#818CF8'], dark: true },
  tour: [
    { title: 'tour_odd_title', description: 'tour_odd_desc' },
    { title: 'tour_act_listen_title', description: 'tour_act_listen_desc' },
  ],
  Round: OddOneOutRoundView,
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  hud: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  score: { alignItems: 'flex-end' },
});
