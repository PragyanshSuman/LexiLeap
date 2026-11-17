import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { DT } from '@/theme/dyslexiaTheme';

const PILL = 38;
const GAP = 8;

/** The original letter picker strip along the bottom of the writing screen, to switch letters quickly. */
export function LetterStrip({ letters, active, onSelect, disabled }: { letters: string[]; active: string; onSelect: (letter: string) => void; disabled?: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const feedback = useFeedback();
  const { t } = useT();
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    const index = letters.indexOf(active);
    if (index >= 0) scroll.current?.scrollTo({ x: Math.max(0, index * (PILL + GAP) - width / 2 + PILL), animated: true });
  }, [active, letters, width]);

  return (
    <View style={[styles.wrap, { paddingBottom: 10 + insets.bottom }]}>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingLeft: 10 + insets.left, paddingRight: 10 + insets.right }]}>
        {letters.map((l) => {
          const isActive = l === active;
          return (
            <Pressable
              key={l}
              accessibilityRole="button"
              hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
              accessibilityLabel={t('trace_letter_intro', { letter: l })}
              accessibilityState={{ selected: isActive, disabled: !!disabled }}
              disabled={disabled}
              onPress={() => {
                feedback.tap();
                onSelect(l);
              }}
              style={({ pressed }) => [styles.pill, isActive && styles.pillActive, pressed && styles.pressed]}
            >
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{l}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.93)',
    paddingTop: 10,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(30,64,175,0.15)',
    shadowColor: DT.accent.navy,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 10,
  },
  scroll: { gap: GAP, flexDirection: 'row', alignItems: 'center' },
  pill: {
    width: PILL,
    height: PILL,
    borderRadius: PILL / 2,
    backgroundColor: DT.surface.card,
    borderWidth: 1.5,
    borderColor: DT.surface.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: DT.accent.navy,
    borderColor: DT.accent.indigo,
    shadowColor: DT.accent.navy,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
    transform: [{ scale: 1.15 }],
  },
  pillText: { fontSize: 15, fontWeight: '800', color: DT.text.primary, fontFamily: 'OpenDyslexic' },
  pillTextActive: { color: '#FFFFFF' },
  pressed: { opacity: 0.75 },
});
