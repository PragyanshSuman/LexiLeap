import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFeedback } from '@/services/feedback';
import { accentGradient, accentOn, readableOn } from '@/theme/color';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { PressableScale } from './motion';

/**
 * The two sound controls, identical on every screen so a child learns them once:
 * a speaker to hear something again, and a microphone to say something.
 * Both are labelled with words as well as icons, and are large enough to hit easily.
 */

interface SoundButtonProps {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}

/** 🔊 "Hear it": a round speaker with its label underneath. */
export function SoundButton({ label, onPress, color, disabled }: SoundButtonProps) {
  const { colors } = useTheme();
  const feedback = useFeedback();
  const tint = accentOn(accentOn(color ?? colors.primary, colors.surface), colors.bg);
  return (
    <View style={styles.column}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => {
          feedback.tap();
          onPress();
        }}
        style={disabled ? styles.disabled : undefined}
        innerStyle={[styles.sound, { backgroundColor: colors.surface, borderColor: tint }]}
      >
        <Ionicons name="volume-high" size={32} color={tint} />
      </PressableScale>
      <AppText variant="caption" weight="bold" center color={tint}>
        {label}
      </AppText>
    </View>
  );
}

interface MicButtonProps {
  /** What the child should do, e.g. "Tap and say the word". */
  label: string;
  /** Shown while listening, e.g. "Listening…". */
  listeningLabel: string;
  listening: boolean;
  /** Checking what was heard. */
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
  color?: string;
  /** A short message under the button (e.g. "I didn't hear anything"). */
  message?: string | null;
  /** Tapping again while listening stops it (recording); otherwise the button waits until listening ends. */
  stoppable?: boolean;
}

/** 🎤 The big microphone: accent colour when ready, a warm red ring while listening. */
export function MicButton({ label, listeningLabel, listening, busy, disabled, onPress, color, message, stoppable }: MicButtonProps) {
  const { colors } = useTheme();
  const base = color ?? colors.primary;
  const gradient = listening ? accentGradient(colors.danger) : accentGradient(base);
  const fg = readableOn(gradient[0]);
  return (
    <View style={styles.column}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={listening ? listeningLabel : label}
        accessibilityState={{ busy: listening || !!busy, disabled: !!disabled }}
        disabled={disabled || busy || (listening && !stoppable)}
        onPress={onPress}
        style={[styles.micShell, disabled && styles.disabled]}
        innerStyle={styles.micInner}
      >
        <LinearGradient colors={gradient} style={styles.mic}>
          {busy ? <ActivityIndicator color={fg} size="large" /> : <Ionicons name={listening ? 'radio-button-on' : 'mic'} size={52} color={fg} />}
        </LinearGradient>
      </PressableScale>
      <AppText variant="label" weight="bold" center color={accentOn(listening ? colors.danger : base, colors.bg)} accessibilityLiveRegion="polite">
        {listening ? listeningLabel : label}
      </AppText>
      {message ? (
        <AppText variant="caption" center muted>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: 6 },
  disabled: { opacity: 0.45 },
  sound: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  micShell: { borderRadius: 64, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  micInner: { borderRadius: 64, overflow: 'hidden' },
  mic: { width: 128, height: 128, borderRadius: 64, alignItems: 'center', justifyContent: 'center' },
});
