import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { useFeedback } from '@/services/feedback';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { IconButton } from './Button';

/** A labelled setting row with room for a description and a control. */
export function SettingRow({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const { space } = useTheme();
  return (
    <View style={{ gap: space(2), paddingVertical: space(3) }}>
      <View>
        <AppText variant="label">{title}</AppText>
        {description ? (
          <AppText variant="caption" muted>
            {description}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function ToggleRow({ title, description, value, onChange }: { title: string; description?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors, space } = useTheme();
  return (
    <View style={[styles.toggleRow, { paddingVertical: space(3), gap: space(3) }]}>
      <View style={styles.flex}>
        <AppText variant="label">{title}</AppText>
        {description ? (
          <AppText variant="caption" muted>
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

interface ChoiceOption<T> {
  value: T;
  label: string;
  /** Optional colour swatch shown before the label. */
  swatch?: string | null;
}

/** Wrapping row of selectable chips. Works for any number of options at any text size. */
export function ChoiceChips<T extends string | number | null>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  const { colors, radius, space } = useTheme();
  const feedback = useFeedback();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={[styles.chips, { gap: space(2) }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => {
              feedback.tap();
              onChange(option.value);
            }}
            style={[
              styles.chip,
              {
                borderRadius: radius.pill,
                backgroundColor: selected ? colors.primary : colors.surface,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
          >
            {option.swatch !== undefined ? (
              <View style={[styles.swatch, { backgroundColor: option.swatch ?? colors.surfaceAlt, borderColor: colors.border }]}>
                {option.swatch === null ? <Ionicons name="close" size={14} color={colors.textMuted} /> : null}
              </View>
            ) : null}
            <AppText variant="label" color={selected ? colors.onPrimary : colors.text}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Minus / value / plus control. Easier for small hands and screen readers than a slider. */
export function Stepper({
  value,
  min,
  max,
  step,
  onChange,
  format,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  label: string;
}) {
  const { colors, radius, space } = useTheme();
  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)) * 100) / 100;
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(clamp(value + (e.nativeEvent.actionName === 'increment' ? step : -step)))}
      style={[styles.stepper, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, padding: space(1) }]}
    >
      <IconButton icon="remove" label={`Less ${label}`} onPress={() => onChange(clamp(value - step))} disabled={value <= min} />
      <AppText variant="label" center style={styles.flex}>
        {format(value)}
      </AppText>
      <IconButton icon="add" label={`More ${label}`} onPress={() => onChange(clamp(value + step))} disabled={value >= max} />
    </View>
  );
}

export function ProgressBar({ value, color, height = 10 }: { value: number; color?: string; height?: number }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={{ height, borderRadius: height / 2, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: color ?? colors.primary }} />
    </View>
  );
}

export function StarRow({ count, max = 3, size = 28 }: { count: number; max?: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stars} accessible accessibilityLabel={`${count} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <Ionicons key={i} name={i < count ? 'star' : 'star-outline'} size={size} color={i < count ? colors.star : colors.border} />
      ))}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const { space } = useTheme();
  return (
    <AppText variant="heading" accessibilityRole="header" style={{ marginTop: space(6), marginBottom: space(3) }}>
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  stars: { flexDirection: 'row', gap: 4 },
});
