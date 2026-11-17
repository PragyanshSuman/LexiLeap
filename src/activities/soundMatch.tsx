import { StyleSheet, View } from 'react-native';
import { spokenLetterName } from '@/content/letters';
import { ACTIVITIES } from '@/engine/catalog';
import { AnswerTile } from '@/ui/AnswerTile';
import { AppText } from '@/ui/AppText';
import { generateSoundMatchRounds, type SoundMatchRound } from './generators';
import { Picture, Prompt, TileGrid, useChoiceRound } from './shared';
import type { ActivityDefinition, RoundProps } from './types';
import { useT } from '@/i18n';

function SoundMatchRoundView({ round, revealed, disabled, onAnswer }: RoundProps<SoundMatchRound>) {
  const { t } = useT();
  const { choose, stateOf, isLocked } = useChoiceRound(round.target, revealed, onAnswer);
  return (
    <View style={styles.root}>
      <Prompt>
        {round.mode === 'first-sound' && round.emoji ? (
          <Picture emoji={round.emoji} size={96} />
        ) : (
          <AppText size={80} accessibilityElementsHidden importantForAccessibility="no">
            👂
          </AppText>
        )}
        <AppText variant="heading" center>
          {round.mode === 'first-sound' ? t('round_first_sound') : t('round_which_letter')}
        </AppText>
      </Prompt>
      <TileGrid count={round.options.length} columns={round.options.length === 4 ? 2 : 3} maxTile={130}>
        {(size, i) => {
          const option = round.options[i];
          return (
            <AnswerTile
              state={stateOf(option)}
              disabled={disabled || isLocked(option)}
              onPress={() => choose(option)}
              accessibilityLabel={`Letter ${option}`}
              style={{ height: size }}
            >
              <AppText fixed size={Math.round(size * 0.5)} weight="bold" style={{ lineHeight: Math.round(size * 0.7) }}>
                {option}
              </AppText>
            </AnswerTile>
          );
        }}
      </TileGrid>
    </View>
  );
}

export const soundMatch: ActivityDefinition<SoundMatchRound> = {
  meta: ACTIVITIES['sound-match'],
  roundsPerSession: 8,
  maxAttempts: 2,
  generate: ({ level, rng }) => generateSoundMatchRounds(level, rng, 8),
  prompt: (r) =>
    r.mode === 'name' ? `Find the letter ${spokenLetterName(r.target)}.` : `${r.word}. Which letter does ${r.word} start with?`,
  reveal: (r) =>
    r.mode === 'name' ? `This is the letter ${spokenLetterName(r.target)}.` : `${r.word} starts with the letter ${spokenLetterName(r.target)}.`,
  Round: SoundMatchRoundView,
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-evenly' },
});
