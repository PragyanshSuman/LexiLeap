import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FocusTracker } from '@/components/FocusTracker';
import { PronunciationCard } from '@/components/PronunciationCard';
import { useWordListener } from '@/hooks/useWordListener';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { cleanWord, usePronunciation } from '@/services/pronunciationDictionary';
import { SPEAKING_WORDS } from '@/content/words';
import type { Level } from '@/engine/types';
import { defaultRng, sample } from '@/lib/random';
import { useActiveProfile, useProgress } from '@/store/appStore';
import { DT } from '@/theme/dyslexiaTheme';
import { accentOn } from '@/theme/color';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button, IconButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { TextField } from '@/ui/Feedback';
import { Header } from '@/ui/Header';
import { Bob, FadeInUp } from '@/ui/motion';
import { Screen } from '@/ui/Screen';

const MAX_SPELLS = 12;
/** Words offered at the child's level. */
const SUGGESTIONS = 6;
/** The Magic Words tile colour on Home. */
const ACCENT = DT.accent.rose;

/** The original "Magic Words" studio: type or say any word to see and hear its sounds. */
export default function MagicWords() {
  const { t } = useT();
  const { colors, radius } = useTheme();
  const accentText = accentOn(ACCENT, colors.surface);
  const feedback = useFeedback();
  const profile = useActiveProfile();
  const listener = useWordListener();
  const [input, setInput] = useState('');
  const [word, setWord] = useState<string | null>(null);
  const [spells, setSpells] = useState<string[]>([]);
  const pronunciation = usePronunciation(word);
  const progress = useProgress(profile?.id);
  // The original's "Adaptive Journey": words at the child's reading level, for when they can't type yet.
  const level = Math.min(progress.activities['say-it']?.level ?? 1, profile?.prefs.maxLevel ?? 3) as Level;
  const [suggestions, setSuggestions] = useState<string[]>(() => sample(defaultRng, SPEAKING_WORDS[level], SUGGESTIONS));

  // Say each new word as soon as its card is ready.
  useEffect(() => {
    if (pronunciation) feedback.speak(pronunciation.word);
  }, [pronunciation, feedback]);

  if (!profile) return <Redirect href="/login" />;

  const cast = (raw: string) => {
    const next = cleanWord(raw);
    if (!next) return;
    setWord(next);
    setInput('');
    setSpells((list) => [next, ...list.filter((w) => w !== next)].slice(0, MAX_SPELLS));
  };

  const speakWord = async () => {
    const outcome = await listener.listen('');
    if ('transcripts' in outcome && outcome.transcripts[0]) cast(outcome.transcripts[0].split(' ')[0]);
  };

  return (
    <Screen scroll header={<Header title={t('magic_title')} subtitle={t('magic_subtitle')} />} overlay={<FocusTracker feature="magic" />}>
      <FadeInUp>
        <Card style={styles.inputRow}>
          <TextField
            value={input}
            onChangeText={setInput}
            placeholder={t('magic_placeholder')}
            returnKeyType="go"
            onSubmitEditing={() => cast(input)}
            accessibilityLabel={t('magic_placeholder')}
            maxLength={20}
          />
          <Button label={t('magic_go')} compact color={ACCENT} onPress={() => cast(input)} />
          {listener.available ? (
            <IconButton
              icon={listener.listening ? 'radio-button-on' : 'mic'}
              label={t('magic_mic')}
              onPress={() => void speakWord()}
              disabled={listener.listening}
              color={listener.listening ? colors.danger : ACCENT}
            />
          ) : null}
        </Card>
      </FadeInUp>

      <FadeInUp index={1}>
        <View style={styles.spellsHeader}>
          <AppText variant="label" weight="bold">
            {t('magic_suggestions')}
          </AppText>
          <Button
            label={t('magic_another')}
            icon="shuffle"
            variant="ghost"
            compact
            color={ACCENT}
            onPress={() => {
              const next = sample(defaultRng, SPEAKING_WORDS[level], SUGGESTIONS);
              setSuggestions(next);
              cast(next[0]);
            }}
          />
        </View>
        <View style={styles.spellChips}>
          {suggestions.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={s}
              onPress={() => {
                feedback.tap();
                cast(s);
              }}
              style={({ pressed }) => [styles.spellChip, { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md }, pressed && styles.pressed]}
            >
              <AppText variant="label">{s}</AppText>
            </Pressable>
          ))}
        </View>
      </FadeInUp>

      <View style={styles.body}>
        {word ? (
          <PronunciationCard pronunciation={pronunciation} />
        ) : (
          <FadeInUp index={1} style={styles.welcome}>
            <Bob>
              <AppText size={64} fixed center>
                🪄
              </AppText>
            </Bob>
            <AppText variant="title" center>
              {t('magic_welcome')}
            </AppText>
            <AppText center muted>
              {t('magic_ready')}
            </AppText>
            <AppText variant="caption" center muted>
              {t('magic_try')}
            </AppText>
          </FadeInUp>
        )}

        {spells.length > 0 ? (
          <View style={styles.spells}>
            <View style={styles.spellsHeader}>
              <AppText variant="label" weight="bold">
                {t('magic_spells')}
              </AppText>
              <Button label={t('magic_clear')} icon="trash-outline" variant="ghost" compact color={ACCENT} onPress={() => setSpells([])} />
            </View>
            <View style={styles.spellChips}>
              {spells.map((s) => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityLabel={s}
                  onPress={() => {
                    feedback.tap();
                    cast(s);
                  }}
                  style={({ pressed }) => [styles.spellChip, { borderColor: ACCENT, backgroundColor: colors.surface, borderRadius: radius.md }, pressed && styles.pressed]}
                >
                  <AppText variant="label" color={accentText}>
                    ✨ {s}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 12 },
  body: { gap: 20, marginTop: 20 },
  welcome: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  spells: { gap: 10 },
  spellsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spellChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spellChip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 2 },
  pressed: { opacity: 0.7 },
});
