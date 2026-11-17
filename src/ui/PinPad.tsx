import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { PIN_LENGTH } from '@/services/pin';
import { useFeedback } from '@/services/feedback';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';

interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export function PinPad({ value, onChange, disabled, error }: PinPadProps) {
  const { colors, space } = useTheme();
  const feedback = useFeedback();

  const press = (key: string) => {
    if (disabled) return;
    feedback.tap();
    if (key === 'del') onChange(value.slice(0, -1));
    else if (value.length < PIN_LENGTH) onChange(value + key);
  };

  return (
    <View style={{ gap: space(6), alignItems: 'center' }}>
      <View style={styles.dots} accessible accessibilityLabel={`${value.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { borderColor: error ? colors.danger : colors.primary },
              i < value.length && { backgroundColor: error ? colors.danger : colors.primary },
            ]}
          />
        ))}
      </View>
      <View style={styles.grid}>
        {KEYS.map((key, i) =>
          key === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={key === 'del' ? 'Delete' : key}
              disabled={disabled}
              onPress={() => press(key)}
              style={({ pressed }) => [
                styles.key,
                { backgroundColor: key === 'del' ? 'transparent' : colors.surface, borderColor: colors.border },
                key !== 'del' && styles.keyBorder,
                pressed && { backgroundColor: colors.primarySoft },
                disabled && styles.disabled,
              ]}
            >
              {key === 'del' ? (
                <Ionicons name="backspace-outline" size={28} color={colors.text} />
              ) : (
                <AppText variant="title" weight="semibold">
                  {key}
                </AppText>
              )}
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 18 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  grid: { width: 276, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  key: { width: 76, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  keyBorder: { borderWidth: 1 },
  disabled: { opacity: 0.4 },
});
