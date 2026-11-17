import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { areLookalikes } from '@/content/letters';
import { ACTIVITIES } from '@/engine/catalog';
import { useFeedback } from '@/services/feedback';
import { useTheme } from '@/theme/useTheme';
import { AnswerTile } from '@/ui/AnswerTile';
import { AppText } from '@/ui/AppText';
import { generateWordBuilderRounds, type WordBuilderRound } from './generators';
import { Picture, Prompt } from './shared';
import type { ActivityDefinition, RoundProps } from './types';
import { useT } from '@/i18n';

/** Each slot holds the index of the tile placed in it, or null. */
type Slots = (number | null)[];

function WordBuilderRoundView({ round, attempt, revealed, disabled, onAnswer }: RoundProps<WordBuilderRound>) {
  const { t } = useT();
  const { colors, radius, space } = useTheme();
  const feedback = useFeedback();
  const { width } = useWindowDimensions();
  const letters = round.word.split('');
  const [board, setBoard] = useState<{ attempt: number; slots: Slots; checked: boolean }>(() => ({
    attempt,
    slots: letters.map(() => null),
    checked: false,
  }));

  // On a retry keep the letters that are right; from the second retry also give the first letter.
  if (board.attempt !== attempt) {
    const kept = board.slots.map((tile, i) => (tile !== null && round.tiles[tile] === letters[i] ? tile : null));
    if (attempt >= 2 && kept[0] === null) {
      const free = round.tiles.findIndex((t, ti) => t === letters[0] && !kept.includes(ti));
      if (free !== -1) kept[0] = free;
    }
    setBoard({ attempt, slots: kept, checked: false });
  }
  const { slots, checked } = board.attempt === attempt ? board : { slots: board.slots, checked: false };
  const setSlots = (next: Slots, isChecked = false) => setBoard({ attempt, slots: next, checked: isChecked });

  const used = new Set(slots.filter((s): s is number => s !== null));
  const size = Math.min(64, Math.floor((Math.min(width, 560) - 48 - 8 * Math.max(letters.length, round.tiles.length)) / Math.max(letters.length, 4)));

  const place = (tile: number) => {
    if (disabled || revealed || used.has(tile)) return;
    const empty = slots.indexOf(null);
    if (empty === -1) return;
    feedback.tap();
    const next = [...slots];
    next[empty] = tile;
    const full = next.every((s) => s !== null);
    setSlots(next, full);
    if (full) {
      const placed = next.map((s) => round.tiles[s as number]);
      const mixUps = letters
        .map((expected, i) => [expected, placed[i]] as [string, string])
        .filter(([expected, got]) => areLookalikes(expected, got));
      onAnswer({ correct: placed.join('') === round.word, confusions: mixUps.length ? mixUps : undefined });
    }
  };

  const remove = (slot: number) => {
    if (disabled || revealed || slots[slot] === null) return;
    feedback.tap();
    setSlots(slots.map((s, i) => (i === slot ? null : s)));
  };

  return (
    <View style={styles.root}>
      <Prompt>
        <Picture emoji={round.emoji} size={88} />
        <AppText muted center>
          {t('round_build_word')}
        </AppText>
      </Prompt>

      <View style={[styles.row, { gap: 8 }]}>
        {letters.map((letter, i) => {
          const tile = slots[i];
          const shown = revealed ? letter : tile !== null ? round.tiles[tile] : '';
          const wrong = checked && !revealed && tile !== null && round.tiles[tile] !== letter;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={shown ? `Slot ${i + 1}: ${shown}. Tap to remove.` : `Empty slot ${i + 1}`}
              onPress={() => remove(i)}
              style={[
                styles.slot,
                {
                  width: size,
                  height: size * 1.2,
                  borderRadius: radius.sm,
                  borderColor: revealed ? colors.success : wrong ? colors.warning : colors.primary,
                  backgroundColor: revealed ? colors.successSoft : wrong ? colors.warningSoft : colors.surface,
                },
              ]}
            >
              <AppText fixed size={Math.round(size * 0.55)} weight="bold" style={{ lineHeight: Math.round(size * 0.8) }}>
                {shown}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.row, styles.wrap, { gap: space(2) }]}>
        {round.tiles.map((letter, i) => (
          <AnswerTile
            key={i}
            state={used.has(i) ? 'faded' : 'idle'}
            disabled={disabled || revealed || used.has(i)}
            onPress={() => place(i)}
            accessibilityLabel={`Letter ${letter}`}
            style={{ width: size, height: size }}
          >
            <AppText fixed size={Math.round(size * 0.5)} weight="bold" style={{ lineHeight: Math.round(size * 0.7) }}>
              {letter}
            </AppText>
          </AnswerTile>
        ))}
      </View>
    </View>
  );
}

export const wordBuilder: ActivityDefinition<WordBuilderRound> = {
  meta: ACTIVITIES['word-builder'],
  roundsPerSession: 6,
  maxAttempts: 3,
  generate: ({ level, rng }) => generateWordBuilderRounds(level, rng, 6),
  prompt: (r) => `Spell the word ${r.word}.`,
  reveal: (r) => `${r.word} is spelled ${r.word.split('').join(', ')}.`,
  Round: WordBuilderRoundView,
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-evenly' },
  row: { flexDirection: 'row', justifyContent: 'center' },
  wrap: { flexWrap: 'wrap' },
  slot: { borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
