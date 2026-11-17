import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFeedback } from '@/services/feedback';
import { accentGradient, accentOn, mix, readableOn } from '@/theme/color';
import { DT } from '@/theme/dyslexiaTheme';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { PressableScale } from './motion';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** The original app's signature navy → indigo button (classic theme), deepened slightly for AA contrast. */
export const CLASSIC_GRADIENT: [string, string] = [DT.accent.navy, mix(DT.accent.indigo, DT.accent.navy, 0.3)];

interface ButtonProps {
  label: string;
  onPress: () => void;
  /**
   * primary: the one main action on a screen (filled). secondary: other actions (outlined).
   * ghost: quiet actions such as Skip (text only). danger: destructive parent actions.
   */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  /** The screen's accent colour (e.g. the activity's colour). Defaults to the theme's primary colour. */
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  /** A smaller button for rows of several actions; still a 48pt touch target. */
  compact?: boolean;
}

/**
 * The app's only text button, so every screen looks and behaves the same: an icon plus a short
 * label, a large touch target, the original spring press, and a label that wraps instead of being cut.
 */
export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, color, style, accessibilityHint, compact }: ButtonProps) {
  const { colors, radius, prefs } = useTheme();
  const feedback = useFeedback();
  const tint = color ?? (variant === 'danger' ? colors.danger : colors.primary);
  const filled = variant === 'primary' || variant === 'danger';
  const gradient = !filled ? null : !color && variant === 'primary' && prefs.theme === 'cream' ? CLASSIC_GRADIENT : accentGradient(tint);
  // Outlined and text buttons sit on the screen, so their colour is adjusted to stay readable on it.
  const fg = gradient ? readableOn(gradient[0]) : accentOn(tint, variant === 'ghost' ? colors.bg : colors.surface);
  const inactive = disabled || loading;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      pressedScale={0.96}
      onPress={() => {
        feedback.tap();
        onPress();
      }}
      style={[styles.shell, { borderRadius: radius.md }, filled && !inactive && styles.lifted, inactive && styles.disabled, style]}
      innerStyle={[
        styles.base,
        compact && styles.compact,
        {
          borderRadius: radius.md,
          backgroundColor: variant === 'secondary' ? colors.surface : 'transparent',
          borderColor: variant === 'secondary' ? fg : 'transparent',
        },
      ]}
    >
      {gradient ? <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]} /> : null}
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={compact ? 20 : 24} color={fg} /> : null}
          <AppText variant="label" weight="bold" color={fg} numberOfLines={2} center style={styles.label}>
            {label}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  color?: string;
  background?: string;
  disabled?: boolean;
}

/** Round icon-only button (close, settings, info): 48pt touch target, spoken label, same spring press. */
export function IconButton({ icon, label, onPress, size = 24, color, background, disabled }: IconButtonProps) {
  const { colors } = useTheme();
  const feedback = useFeedback();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        feedback.tap();
        onPress();
      }}
      style={disabled ? styles.disabled : undefined}
      innerStyle={[styles.icon, { backgroundColor: background ?? colors.surface, borderColor: colors.border }]}
    >
      <Ionicons name={icon} size={size} color={color ?? colors.text} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  shell: { overflow: 'hidden' },
  lifted: { ...DT.shadow.medium, overflow: 'visible' },
  base: {
    minHeight: 60,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { flexShrink: 1 },
  disabled: { opacity: 0.45 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
