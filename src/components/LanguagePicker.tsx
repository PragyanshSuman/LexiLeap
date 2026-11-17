import { Pressable, StyleSheet, View } from 'react-native';
import { LANGUAGES } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useAppStore } from '@/store/appStore';
import { readableOn } from '@/theme/color';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';

/** English / தமிழ் / हिंदी chips, as in the original app's sidebar. */
export function LanguagePicker({ compact }: { compact?: boolean }) {
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const feedback = useFeedback();
  const { colors } = useTheme();
  return (
    <View style={[styles.row, compact && styles.compactRow]} accessibilityRole="radiogroup" accessibilityLabel="Language">
      {LANGUAGES.map((lang) => {
        const selected = lang.code === language;
        return (
          <Pressable
            key={lang.code}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={lang.label}
            onPress={() => {
              feedback.tap();
              setLanguage(lang.code);
            }}
            style={[styles.chip, selected ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          >
            <AppText variant="label" weight="bold" fixed color={selected ? readableOn(colors.primary) : colors.textMuted}>
              {lang.flag} {lang.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12 },
  compactRow: { justifyContent: 'center', paddingHorizontal: 0, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 2,
    minHeight: 48,
    justifyContent: 'center',
  },
});
