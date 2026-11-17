import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FocusTracker } from '@/components/FocusTracker';
import { PronunciationCard } from '@/components/PronunciationCard';
import { RecordCheck } from '@/components/RecordCheck';
import { SPEAKING_WORDS } from '@/content/words';
import type { SoundResult } from '@/engine/types';
import { useWordListener } from '@/hooks/useWordListener';
import { dayKey } from '@/lib/date';
import { useT, type TranslationKey } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { cleanWord, usePronunciation } from '@/services/pronunciationDictionary';
import { scoreSpeech } from '@/services/speechScoring';
import { soundOf } from '@/speech/phonemes';
import { useActiveProfile, useAppStore, useProgress } from '@/store/appStore';
import { DT } from '@/theme/dyslexiaTheme';
import { AppText } from '@/ui/AppText';
import { Button, IconButton } from '@/ui/Button';
import { ChoiceChips } from '@/ui/controls';
import { FeedbackBanner, TextField } from '@/ui/Feedback';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';
import { MicButton } from '@/ui/SpeechControls';

type Mode = 'list' | 'custom';
/** The Say It Right tile colour on Home. */
const ACCENT = DT.accent.indigo;

/** The original "Say It Right" studio: say a word and see exactly which sounds were right. */
export default function PhonicCheck() {
  const { t } = useT();
  const feedback = useFeedback();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const logSpeechCheck = useAppStore((s) => s.logSpeechCheck);
  const listener = useWordListener();
  const words = SPEAKING_WORDS[progress.activities['say-it']?.level ?? 1];
  const [mode, setMode] = useState<Mode>('list');
  const [index, setIndex] = useState(0);
  const [custom, setCustom] = useState('');
  const [customWord, setCustomWord] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ word: string; result: SoundResult } | null>(null);
  const [message, setMessage] = useState<TranslationKey | null>(null);

  const word = mode === 'list' ? words[index % words.length] : customWord;
  const pronunciation = usePronunciation(word);
  const shown = result && result.word === word ? result.result : null;

  if (!profile) return <Redirect href="/login" />;

  const record = async () => {
    if (!word || !pronunciation) return;
    setMessage(null);
    const outcome = await listener.listen(word);
    if ('error' in outcome) {
      setMessage(outcome.error === 'no-speech' ? 'round_no_speech' : outcome.error === 'permission' ? 'round_mic_off' : 'round_mic_error');
      return;
    }
    await scoreHeard(outcome.transcripts);
  };

  /** Scores what the microphone heard, sound by sound. */
  const scoreHeard = async (transcripts: string[]) => {
    if (!word || !pronunciation) return;
    setMessage(null);
    setChecking(true);
    const scored = await scoreSpeech(word, transcripts);
    setChecking(false);
    setResult({ word, result: scored });
    logSpeechCheck(profile.id, { ...scored, day: dayKey() });
    if (scored.correct) feedback.correct();
    else feedback.tryAgain();
  };

  const next = () => {
    setResult(null);
    setMessage(null);
    setIndex((i) => i + 1);
  };
  const applyCustom = () => setCustomWord(cleanWord(custom) || null);

  const alignment = shown && pronunciation ? alignmentFor(pronunciation.phonemes, shown) : null;
  const practise = shown ? [...shown.changed.map(([p]) => p), ...shown.missed].map((p) => soundOf(p).sound) : [];

  const footer = shown ? (
    <View style={styles.row}>
      <Button label={t('phonic_try_again')} icon="refresh" variant="secondary" color={ACCENT} onPress={() => setResult(null)} style={styles.flex} />
      {mode === 'list' ? <Button label={t('phonic_next')} icon="arrow-forward" color={ACCENT} onPress={next} style={styles.flex} /> : null}
    </View>
  ) : undefined;

  return (
    <Screen scroll header={<Header title={t('phonic_title')} subtitle={t('phonic_subtitle')} />} footer={footer} overlay={<FocusTracker feature="phonic-check" />}>
      <ChoiceChips
        accessibilityLabel={t('phonic_title')}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setResult(null);
        }}
        options={[
          { value: 'list', label: t('phonic_mode_list') },
          { value: 'custom', label: t('phonic_mode_custom') },
        ]}
      />

      <View style={styles.body}>
        {mode === 'list' ? (
          <View style={styles.nav}>
            <IconButton icon="arrow-back" label={t('phonic_previous')} onPress={() => setIndex((i) => (i - 1 + words.length) % words.length)} />
            <AppText variant="label" muted>
              {t('phonic_progress', { a: (index % words.length) + 1, b: words.length })}
            </AppText>
            <IconButton icon="arrow-forward" label={t('phonic_next')} onPress={next} />
          </View>
        ) : (
          <View style={styles.row}>
            <TextField
              value={custom}
              onChangeText={setCustom}
              placeholder={t('phonic_placeholder')}
              returnKeyType="done"
              onSubmitEditing={applyCustom}
              accessibilityLabel={t('phonic_type')}
              maxLength={20}
            />
            <Button label={t('magic_go')} compact color={ACCENT} onPress={applyCustom} />
          </View>
        )}

        {word ? <PronunciationCard pronunciation={pronunciation} sounds={alignment} /> : null}

        {shown ? (
          <FeedbackBanner
            kind={shown.correct ? 'correct' : 'tryAgain'}
            text={shown.score === 1 || (shown.score === null && shown.correct) ? t('phonic_perfect') : shown.score === null ? t('encourage_2') : t('phonic_score', { n: Math.round(shown.score * 100) })}
            detail={[shown.heard ? t('phonic_heard', { word: shown.heard }) : null, practise.length ? `${t('phonic_practice')} ${practise.join(', ')}` : null].filter(Boolean).join('\n')}
          />
        ) : word && listener.available ? (
          <MicButton
            label={t('phonic_tap_mic')}
            listeningLabel={t('phonic_listening')}
            listening={listener.listening}
            busy={checking}
            disabled={!pronunciation}
            color={ACCENT}
            message={message ? t(message) : null}
            onPress={() => void record()}
          />
        ) : word ? (
          <RecordCheck
            color={ACCENT}
            onMark={(correct) => {
              const marked: SoundResult = { word, score: null, correct, missed: [], changed: [] };
              setResult({ word, result: marked });
              logSpeechCheck(profile.id, { ...marked, day: dayKey() });
              if (correct) feedback.correct();
              else feedback.tryAgain();
            }}
          />
        ) : (
          <AppText center muted>
            {t('phonic_type')}
          </AppText>
        )}
      </View>
    </Screen>
  );
}

/** Rebuilds the per-sound verdicts from a stored result (missed and changed sounds). */
function alignmentFor(target: string[], result: SoundResult) {
  const missed = [...result.missed];
  const changed = [...result.changed];
  return target.map((phoneme) => {
    const m = missed.indexOf(phoneme);
    if (m !== -1) {
      missed.splice(m, 1);
      return { phoneme, status: 'missed' as const };
    }
    const c = changed.findIndex(([p]) => p === phoneme);
    if (c !== -1) {
      const [, heard] = changed.splice(c, 1)[0];
      return { phoneme, status: 'changed' as const, heard };
    }
    return { phoneme, status: 'correct' as const };
  });
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  body: { gap: 20, marginTop: 16 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
