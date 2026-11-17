import { Pressable, StyleSheet, View } from 'react-native';
import type { Mood } from '@/engine/types';
import { useT, type TranslationKey } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';

export const MOODS: { mood: Mood; emoji: string }[] = [
  { mood: 'great', emoji: '😄' },
  { mood: 'good', emoji: '🙂' },
  { mood: 'okay', emoji: '😐' },
  { mood: 'tired', emoji: '😴' },
  { mood: 'upset', emoji: '😟' },
];

export const moodLabelKey = (mood: Mood) => `mood_${mood}` as TranslationKey;
const moodReplyKey = (mood: Mood) => `mood_reply_${mood}` as TranslationKey;

/**
 * A once-a-day, child-reported feeling. This replaces camera-based emotion tracking:
 * nothing is recorded or sent anywhere, and the child stays in control.
 */
export function MoodCheckIn({ mood, onPick }: { mood: Mood | undefined; onPick: (mood: Mood) => void }) {
  const { colors, space, radius } = useTheme();
  const { t } = useT();
  const feedback = useFeedback();

  if (mood) {
    const picked = MOODS.find((m) => m.mood === mood)!;
    return (
      <Card style={styles.row}>
        <AppText size={32} style={{ lineHeight: 40 }}>
          {picked.emoji}
        </AppText>
        <AppText variant="label" style={styles.flex}>
          {t(moodReplyKey(mood))}
        </AppText>
      </Card>
    );
  }

  return (
    <Card style={{ gap: space(3) }}>
      <AppText variant="label">{t('mood_question')}</AppText>
      <View style={styles.moods}>
        {MOODS.map((m) => (
          <Pressable
            key={m.mood}
            accessibilityRole="button"
            accessibilityLabel={t(moodLabelKey(m.mood))}
            onPress={() => {
              feedback.tap();
              feedback.say(moodReplyKey(m.mood));
              onPick(m.mood);
            }}
            style={({ pressed }) => [styles.mood, { borderRadius: radius.md, backgroundColor: pressed ? colors.primarySoft : colors.surfaceAlt }]}
          >
            <AppText size={30} style={{ lineHeight: 38 }}>
              {m.emoji}
            </AppText>
            <AppText variant="caption" numberOfLines={1}>
              {t(moodLabelKey(m.mood))}
            </AppText>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  moods: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  mood: { flex: 1, alignItems: 'center', paddingVertical: 8, minHeight: 64 },
});
