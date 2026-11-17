import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';

export type TileState = 'idle' | 'selected' | 'correct' | 'wrong' | 'revealed' | 'faded';

interface AnswerTileProps {
  state?: TileState;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * A large answer choice. States use colour, border width and a ✓ / ↻ badge (never colour alone);
 * a wrong choice is a gentle amber "try again", not red.
 */
export function AnswerTile({ state = 'idle', onPress, disabled, accessibilityLabel, children, style }: AnswerTileProps) {
  const { colors, radius, prefs } = useTheme();
  const [shake] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (state !== 'wrong' || prefs.reduceMotion) return;
    shake.setValue(0);
    Animated.sequence(
      [8, -8, 6, -6, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 55, useNativeDriver: true })),
    ).start();
  }, [state, prefs.reduceMotion, shake]);

  const look = {
    idle: { bg: colors.surface, border: colors.border, width: 2 },
    selected: { bg: colors.primarySoft, border: colors.primary, width: 3 },
    correct: { bg: colors.successSoft, border: colors.success, width: 4 },
    revealed: { bg: colors.successSoft, border: colors.success, width: 4 },
    wrong: { bg: colors.warningSoft, border: colors.warning, width: 3 },
    faded: { bg: colors.surfaceAlt, border: colors.border, width: 1 },
  }[state];

  return (
    <Animated.View style={[{ transform: [{ translateX: shake }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled, selected: state === 'correct' || state === 'selected' }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.tile,
          { backgroundColor: look.bg, borderColor: look.border, borderWidth: look.width, borderRadius: radius.md },
          state === 'faded' && styles.faded,
          pressed && !disabled && styles.pressed,
        ]}
      >
        {children}
        {state === 'correct' || state === 'revealed' || state === 'wrong' ? (
          <View style={[styles.badge, { backgroundColor: state === 'wrong' ? colors.warning : colors.success }]} pointerEvents="none">
            <Ionicons name={state === 'wrong' ? 'refresh' : 'checkmark'} size={16} color={colors.surface} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', padding: 8, minHeight: 56 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  faded: { opacity: 0.45 },
  badge: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
