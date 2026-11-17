import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { Bob } from './motion';
import { Card } from './Card';

export type FeedbackKind = 'correct' | 'tryAgain' | 'info';

/**
 * How every screen tells a child how they did: an icon and a short, kind sentence on a soft colour.
 * Mistakes are amber "let's try again", never red, so feedback encourages rather than alarms.
 */
export function FeedbackBanner({ kind, text, detail }: { kind: FeedbackKind; text: string; detail?: string | null }) {
  const { colors, radius } = useTheme();
  const look = {
    correct: { bg: colors.successSoft, fg: colors.success, icon: 'checkmark-circle' as const },
    tryAgain: { bg: colors.warningSoft, fg: colors.warning, icon: 'refresh-circle' as const },
    info: { bg: colors.primarySoft, fg: colors.primary, icon: 'bulb' as const },
  }[kind];
  return (
    <View accessibilityLiveRegion="polite" style={[styles.banner, { backgroundColor: look.bg, borderColor: look.fg, borderRadius: radius.md }]}>
      <Ionicons name={look.icon} size={28} color={look.fg} />
      <View style={styles.flex}>
        <AppText variant="label" weight="bold">
          {text}
        </AppText>
        {detail ? (
          <AppText variant="caption" muted>
            {detail}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/** A large, theme-coloured text input in the reading font. */
export function TextField({ style, ...input }: TextInputProps & { style?: StyleProp<ViewStyle> }) {
  const { colors, radius, font } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      autoCapitalize="none"
      autoCorrect={false}
      {...input}
      style={[
        styles.input,
        { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, borderRadius: radius.md, fontFamily: font.families.semibold },
        style,
      ]}
    />
  );
}

/** A number with a short label underneath, for score rows and report summaries. */
export function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.stat}>
      <AppText variant="heading" weight="bold" center color={color ?? colors.text}>
        {value}
      </AppText>
      <AppText variant="caption" center muted>
        {label}
      </AppText>
    </Card>
  );
}

/** The opening panel of a test or studio: a big emoji, a title and a short explanation. */
export function ScreenIntro({ emoji, title, body, note, children }: { emoji: string; title: string; body: string; note?: string | null; children?: ReactNode }) {
  return (
    <View style={styles.intro}>
      <Bob>
        <AppText size={72} fixed center>
          {emoji}
        </AppText>
      </Bob>
      <AppText variant="title" center accessibilityRole="header">
        {title}
      </AppText>
      <Card style={styles.introCard}>
        {/* Left-aligned: easier to read than centred paragraphs. */}
        <AppText>{body}</AppText>
        {note ? <AppText muted>{note}</AppText> : null}
        {children}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 2 },
  input: { flex: 1, minHeight: 56, borderWidth: 2, paddingHorizontal: 16, fontSize: 20 },
  stat: { flexBasis: '30%', flexGrow: 1, alignItems: 'center', gap: 2, paddingVertical: 12 },
  intro: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  introCard: { alignSelf: 'stretch', gap: 10 },
});
