import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import type { Pronunciation } from '@/services/pronunciationDictionary';
import { soundOf, type AlignedSound } from '@/speech/phonemes';
import { mix } from '@/theme/color';
import { DT } from '@/theme/dyslexiaTheme';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { SoundButton } from '@/ui/SpeechControls';

/** One colour per sound, so children can see which letters make which sound. */
const CHUNK_COLOURS = ['#4F46E5', '#DB2777', '#059669', '#D97706', '#7C3AED', '#0284C7', '#DC2626', '#65A30D'];
const STATUS_COLOURS = { correct: '#16A34A', missed: '#DC2626', changed: '#D97706' } as const;

interface PronunciationCardProps {
  pronunciation: Pronunciation | null;
  /** When given, each sound shows whether it was said right. */
  sounds?: AlignedSound[] | null;
}

/** The original Magic Words card: the word split into sounds, colour-coded, with playback. */
export function PronunciationCard({ pronunciation, sounds }: PronunciationCardProps) {
  const { t } = useT();
  const { colors, radius } = useTheme();
  const feedback = useFeedback();
  // Lighter tones on dark themes so every sound colour stays easy to read.
  const tone = (color: string) => (colors.isDark ? mix(color, '#FFFFFF', 0.45) : color);
  const frame = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }];

  if (!pronunciation) {
    return (
      <View style={[frame, styles.loading]}>
        <ActivityIndicator color={colors.primary} />
        <AppText variant="caption" muted>
          {t('card_loading')}
        </AppText>
      </View>
    );
  }

  // Status per sound (in order), used to colour both the chips and the letter groups.
  const statusAt = (index: number) => sounds?.[index]?.status;
  let soundIndex = 0;
  const chunks = (pronunciation.chunks ?? [{ letters: pronunciation.word, phonemes: pronunciation.phonemes }]).map((chunk, i) => {
    const statuses = chunk.phonemes.map(() => statusAt(soundIndex++));
    const worst = statuses.includes('missed') ? 'missed' : statuses.includes('changed') ? 'changed' : statuses.length && statuses.every((s) => s === 'correct') ? 'correct' : undefined;
    return { ...chunk, color: tone(worst ? STATUS_COLOURS[worst] : CHUNK_COLOURS[i % CHUNK_COLOURS.length]) };
  });

  return (
    <View style={frame}>
      <View style={styles.wordRow} accessible accessibilityLabel={pronunciation.word}>
        {chunks.map((chunk, i) => (
          <AppText key={i} size={44} fixed weight="bold" color={chunk.color}>
            {chunk.letters}
          </AppText>
        ))}
      </View>

      <AppText variant="caption" weight="bold" muted>
        {t('card_sounds', { n: pronunciation.phonemes.length })}
      </AppText>
      <View style={styles.chips}>
        {pronunciation.phonemes.map((phoneme, i) => {
          const info = soundOf(phoneme);
          const result = sounds?.[i];
          const color = tone(result ? STATUS_COLOURS[result.status] : CHUNK_COLOURS[i % CHUNK_COLOURS.length]);
          const label = t('card_sound_label', { sound: info.sound, example: info.example });
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={result ? `${label}, ${result.status === 'changed' ? t('sound_changed', { sound: soundOf(result.heard ?? '').sound }) : t(`sound_${result.status}`)}` : label}
              onPress={() => feedback.speak(info.example)}
              style={({ pressed }) => [styles.chip, { borderColor: color, backgroundColor: `${color}14` }, pressed && styles.pressed]}
            >
              <AppText variant="heading" weight="bold" fixed color={color}>
                {info.sound}
              </AppText>
              <AppText size={12} fixed muted>
                {result?.status === 'changed' ? t('sound_changed', { sound: soundOf(result.heard ?? '').sound }) : result ? t(`sound_${result.status}`) : info.example}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={[styles.source, { backgroundColor: colors.surfaceAlt }]}>
          <AppText variant="caption" weight="bold" muted>
            {t(pronunciation.source === 'dictionary' ? 'card_source_dict' : 'card_source_rules')}
          </AppText>
        </View>
        <SoundButton label={t('card_play')} onPress={() => feedback.speak(pronunciation.word)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 12, borderWidth: 1, ...DT.shadow.soft },
  loading: { alignItems: 'center', justifyContent: 'center', minHeight: 160 },
  wordRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { minWidth: 64, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 2 },
  pressed: { opacity: 0.7 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  source: { flexShrink: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
});
