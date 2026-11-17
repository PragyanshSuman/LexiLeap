import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { DT } from '@/theme/dyslexiaTheme';
import { useTheme } from '@/theme/useTheme';
import { goBackOr } from './navigation';

/**
 * Where the back button sits on every screen: this far from the left edge and below the status bar.
 * Headers lay themselves out around these numbers so the button never moves between screens.
 */
export const BACK_BUTTON = { size: 44, left: 20, top: 8 } as const;

interface BackButtonProps {
  /** Defaults to going back (or to `fallback` when there is nothing to go back to). */
  onPress?: () => void;
  fallback?: string;
  /**
   * 'floating' places it at the standard spot over the screen (full-screen pages such as the tracer);
   * 'inline' is for headers, which put it at the same spot.
   */
  placement?: 'floating' | 'inline';
  /** On dark backgrounds (night-sky stages), a translucent light button. */
  onDark?: boolean;
  label?: string;
}

/** The one back button used on every screen: round, 44 pt, chevron, always in the same place. */
export function BackButton({ onPress, fallback = '/home', placement = 'inline', onDark, label }: BackButtonProps) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { colors } = useTheme();
  const feedback = useFeedback();
  const background = onDark ? 'rgba(255,255,255,0.18)' : colors.isDark ? colors.surfaceAlt : 'rgba(255,255,255,0.92)';
  const tint = onDark ? '#FFFFFF' : colors.isDark ? colors.text : DT.accent.indigo;
  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? t('go_back')}
      hitSlop={8}
      onPress={() => {
        feedback.tap();
        if (onPress) onPress();
        else goBackOr(fallback);
      }}
      style={({ pressed }) => [styles.button, { backgroundColor: background }, onDark && styles.flat, pressed && styles.pressed]}
    >
      <Ionicons name="chevron-back" size={28} color={tint} style={styles.chevron} />
    </Pressable>
  );
  if (placement === 'inline') return button;
  return <View style={[styles.floating, { top: insets.top + BACK_BUTTON.top, left: insets.left + BACK_BUTTON.left }]}>{button}</View>;
}

const styles = StyleSheet.create({
  floating: { position: 'absolute', zIndex: 999 },
  button: {
    width: BACK_BUTTON.size,
    height: BACK_BUTTON.size,
    borderRadius: BACK_BUTTON.size / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  flat: { shadowOpacity: 0, elevation: 0 },
  chevron: { marginLeft: -2 },
  pressed: { opacity: 0.7 },
});
