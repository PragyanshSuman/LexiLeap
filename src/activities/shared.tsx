import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { areLookalikes } from '@/content/letters';
import type { TileState } from '@/ui/AnswerTile';
import type { RoundAnswer } from './types';

/**
 * State for a pick-one round. Wrong picks stay visible but fade out and can't be
 * picked again, so each retry has fewer options (gentle scaffolding).
 */
export function useChoiceRound<T>(
  answer: T,
  revealed: boolean,
  onAnswer: (a: RoundAnswer) => void,
  /** The text shown for an option, used to spot look-alike mix-ups (b picked for d). */
  textOf: (option: T) => string = String,
) {
  const [wrong, setWrong] = useState<T[]>([]);
  const [last, setLast] = useState<T | null>(null);

  const choose = (option: T) => {
    setLast(option);
    if (option === answer) {
      onAnswer({ correct: true });
    } else {
      setWrong((w) => [...w, option]);
      const expected = textOf(answer);
      const chosen = textOf(option);
      onAnswer({ correct: false, confusions: areLookalikes(expected, chosen) ? [[expected, chosen]] : undefined });
    }
  };

  const stateOf = (option: T): TileState => {
    if (option === answer && revealed) return 'revealed';
    if (option === answer && last === answer) return 'correct';
    if (wrong.includes(option)) return option === last ? 'wrong' : 'faded';
    return 'idle';
  };

  const isLocked = (option: T) => wrong.includes(option) || last === answer || revealed;

  return { choose, stateOf, isLocked };
}

/**
 * Lays out tiles in rows of `columns`. Fills the space it's given and sizes tiles to fit
 * both its width and height, so grids work on small phones, large text and iPad landscape.
 * `aspect` is tile height ÷ width (e.g. 0.6 for wide word bubbles).
 */
export function TileGrid({
  count,
  columns,
  gap = 12,
  maxTile = 140,
  aspect = 1,
  children,
}: {
  count: number;
  columns: number;
  gap?: number;
  maxTile?: number;
  aspect?: number;
  children: (size: number, index: number) => ReactNode;
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const rows = Math.ceil(count / columns);
  const byWidth = (Math.min(box.width, 640) - gap * (columns - 1)) / columns;
  const byHeight = (box.height - gap * (rows - 1)) / rows / aspect;
  const size = Math.max(0, Math.floor(Math.min(maxTile, byWidth, byHeight)));
  return (
    <View testID="tile-grid" style={styles.gridArea} onLayout={(e: LayoutChangeEvent) => setBox(e.nativeEvent.layout)}>
      {size > 0 ? (
        <View style={[styles.grid, { gap, width: size * columns + gap * (columns - 1) }]}>
          {Array.from({ length: count }, (_, i) => (
            <View key={i} style={{ width: size }}>
              {children(size, i)}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A large emoji picture, optionally with its word underneath. */
export function Picture({ emoji, word, size = 72 }: { emoji: string; word?: string; size?: number }) {
  return (
    <View style={styles.picture}>
      <AppText size={size} style={{ lineHeight: size * 1.25 }} accessibilityElementsHidden importantForAccessibility="no">
        {emoji}
      </AppText>
      {word ? (
        <AppText variant="heading" center>
          {word}
        </AppText>
      ) : null}
    </View>
  );
}

/** The question area at the top of a round. */
export function Prompt({ children }: { children: ReactNode }) {
  const { space } = useTheme();
  return <View style={[styles.prompt, { paddingVertical: space(4), gap: space(2) }]}>{children}</View>;
}

const styles = StyleSheet.create({
  gridArea: { flex: 1, minHeight: 120, justifyContent: 'center', marginVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'center' },
  picture: { alignItems: 'center' },
  prompt: { alignItems: 'center' },
});
