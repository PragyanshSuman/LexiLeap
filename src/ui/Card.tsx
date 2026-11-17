import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFeedback } from '@/services/feedback';
import { useTheme } from '@/theme/useTheme';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Left accent stripe colour. */
  accent?: string;
}

export function Card({ children, onPress, accessibilityLabel, style, accent }: CardProps) {
  const { colors, radius } = useTheme();
  const feedback = useFeedback();
  const base = [
    styles.card,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.lg,
      shadowColor: colors.shadow,
    },
    accent ? { borderLeftWidth: 6, borderLeftColor: accent } : null,
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        feedback.tap();
        onPress();
      }}
      style={({ pressed }) => [base, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
});
