import { StyleSheet, View } from 'react-native';
import { focusBand, type Expression, type FocusBand } from '@/engine/focus';
import { useT, type TranslationKey } from '@/i18n';
import { accentOn, readableOn } from '@/theme/color';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';

/** The original Mood Track's emoji and colour per reading. */
export const EXPRESSIONS: Record<Expression, { emoji: string; color: string; label: TranslationKey }> = {
  happy: { emoji: '😊', color: '#10B981', label: 'expr_happy' },
  focused: { emoji: '🙂', color: '#6366F1', label: 'expr_focused' },
  surprised: { emoji: '😮', color: '#0EA5E9', label: 'expr_surprised' },
  frustrated: { emoji: '😣', color: '#D97706', label: 'expr_frustrated' },
  sad: { emoji: '😢', color: '#8B5CF6', label: 'expr_sad' },
  worried: { emoji: '😟', color: '#A16207', label: 'expr_worried' },
  tired: { emoji: '😴', color: '#64748B', label: 'expr_tired' },
  'looking-away': { emoji: '👀', color: '#F59E0B', label: 'expr_looking_away' },
  active: { emoji: '✋', color: '#14B8A6', label: 'expr_active' },
  away: { emoji: '🚶', color: '#94A3B8', label: 'expr_away' },
};

export const BAND_COLOURS: Record<FocusBand, string> = { high: '#10B981', medium: '#F59E0B', low: '#EF4444' };
export const BAND_LABELS: Record<FocusBand, TranslationKey> = { high: 'focus_high', medium: 'focus_medium', low: 'focus_low' };

/** A 0–100 concentration bar, green / amber / red like the original. */
export function ConcentrationBar({ value }: { value: number }) {
  const { colors } = useTheme();
  const color = BAND_COLOURS[focusBand(value)];
  return (
    <View style={styles.bar} accessible accessibilityLabel={`${value}%`}>
      <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.fill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <AppText variant="caption" weight="bold" color={accentOn(color, colors.surface)} fixed style={styles.barLabel}>
        {`${value}%`}
      </AppText>
    </View>
  );
}

/** The share of each expression, most common first. */
export function ExpressionPips({ expressions }: { expressions: Partial<Record<Expression, number>> }) {
  const { t } = useT();
  const entries = (Object.entries(expressions) as [Expression, number][]).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  if (total === 0) return null;
  return (
    <View style={styles.pips}>
      {entries.map(([expression, count]) => (
        <View key={expression} style={[styles.pip, { backgroundColor: EXPRESSIONS[expression].color }]}>
          <AppText size={16} fixed>
            {EXPRESSIONS[expression].emoji}
          </AppText>
          <AppText size={12} weight="bold" color={readableOn(EXPRESSIONS[expression].color)} fixed>
            {t(EXPRESSIONS[expression].label)}
          </AppText>
          <AppText size={12} color={readableOn(EXPRESSIONS[expression].color)} fixed>
            {`${Math.round((count / total) * 100)}%`}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  barLabel: { minWidth: 40, textAlign: 'right' },
  pips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pip: { alignItems: 'center', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, minWidth: 72 },
});
