import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FocusTracker } from '@/components/FocusTracker';
import { WritingPad } from '@/components/WritingPad';
import type { LetterAttempt } from '@/engine/types';
import type { InkStroke } from '@/handwriting/raster';
import { checkLetter, type LetterCheck } from '@/handwriting/recognize';
import { useT } from '@/i18n';
import { dayKey } from '@/lib/date';
import { defaultRng, pick } from '@/lib/random';
import { useFeedback } from '@/services/feedback';
import { useHandwritingModel } from '@/services/handwritingModel';
import { useActiveProfile, useAppStore, useProgress } from '@/store/appStore';
import { DT } from '@/theme/dyslexiaTheme';
import { accentOn } from '@/theme/color';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { FeedbackBanner, StatTile } from '@/ui/Feedback';
import { Header } from '@/ui/Header';
import { PopIn } from '@/ui/motion';
import { Screen } from '@/ui/Screen';
import { SoundButton } from '@/ui/SpeechControls';

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'];
const isCapital = (letter: string) => letter !== letter.toLowerCase();
const REVERSAL_TEXT = { mirrored: 'write_mirrored', 'upside-down': 'write_upside_down', rotated: 'write_rotated' } as const;
/** The Write & Score tile colour on Home. */
const ACCENT = DT.accent.gold;

interface Attempt {
  letter: string;
  startedAt: number;
}

/**
 * The original "Write & Score" Writing Challenge: hear a letter, write it, and the app reads it.
 * The time taken is recorded for grown-ups but not shown, so there is no pressure to hurry.
 */
export default function WriteAndScore() {
  const { t } = useT();
  const { colors } = useTheme();
  const accentText = accentOn(ACCENT, colors.surface);
  const feedback = useFeedback();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const logLetterAttempt = useAppStore((s) => s.logLetterAttempt);
  const model = useHandwritingModel();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [result, setResult] = useState<LetterCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [padSize, setPadSize] = useState(0);

  if (!profile) return <Redirect href="/login" />;

  const speakPrompt = (letter: string) => feedback.say(isCapital(letter) ? 'write_say_capital' : 'write_say_small', { letter });

  const ask = (letter: string) => {
    setAttempt({ letter, startedAt: Date.now() });
    setStrokes([]);
    setResult(null);
    speakPrompt(letter);
  };
  const newLetter = () => ask(pick(defaultRng, LETTERS.filter((l) => l !== attempt?.letter)));

  const check = () => {
    if (!attempt || model.status !== 'ready' || strokes.length === 0) return;
    const seconds = (Date.now() - attempt.startedAt) / 1000;
    setChecking(true);
    // Let the spinner render before the (synchronous) model runs.
    setTimeout(() => {
      const checked = checkLetter(model.model, strokes, attempt.letter);
      setChecking(false);
      if (!checked) return;
      setResult(checked);
      const entry: LetterAttempt = { ...checked, letter: attempt.letter, seconds: Math.round(seconds * 10) / 10, day: dayKey() };
      logLetterAttempt(profile.id, entry);
      if (checked.correct) feedback.correct();
      else feedback.tryAgain();
    }, 30);
  };

  const total = progress.writing.length;
  const correct = progress.writing.filter((a) => a.correct).length;

  const footer = !attempt ? (
    <Button label={t('write_new')} icon="sparkles" color={ACCENT} disabled={model.status !== 'ready'} loading={model.status === 'loading'} onPress={newLetter} />
  ) : result ? (
    <View style={styles.row}>
      <Button label={t('phonic_try_again')} icon="refresh" variant="secondary" color={ACCENT} onPress={() => ask(attempt.letter)} style={styles.flex} />
      <Button label={t('write_new')} icon="arrow-forward" color={ACCENT} onPress={newLetter} style={styles.flex} />
    </View>
  ) : (
    <View style={styles.row}>
      <Button label={t('write_clear')} icon="trash-outline" variant="secondary" color={ACCENT} disabled={strokes.length === 0 || checking} onPress={() => setStrokes([])} style={styles.flex} />
      <Button label={t('write_check')} icon="checkmark-circle" color={ACCENT} loading={checking} disabled={strokes.length === 0} onPress={check} style={styles.flex} />
    </View>
  );

  return (
    <Screen header={<Header title={t('write_title')} subtitle={t('write_subtitle')} />} footer={footer} overlay={<FocusTracker feature="writing" />}>
      <View style={styles.body}>
        <View style={styles.stats}>
          <StatTile label={t('write_tests')} value={String(total)} />
          <StatTile label={t('write_correct_count')} value={String(correct)} color={colors.success} />
          <StatTile label={t('write_accuracy')} value={`${total ? Math.round((correct / total) * 100) : 0}%`} />
        </View>

        <Card style={styles.prompt}>
          <View style={styles.flex}>
            <AppText variant="label" muted>
              {attempt ? t('write_prompt') : t('write_begin')}
            </AppText>
            <AppText size={56} fixed weight="bold" color={accentText}>
              {attempt?.letter ?? '?'}
            </AppText>
          </View>
          <SoundButton label={t('write_replay')} color={ACCENT} disabled={!attempt} onPress={() => attempt && speakPrompt(attempt.letter)} />
        </Card>

        <View testID="pad-area" style={styles.padArea} onLayout={(e) => setPadSize(Math.floor(Math.min(e.nativeEvent.layout.width, e.nativeEvent.layout.height)))}>
          {padSize > 0 ? (
            <WritingPad strokes={strokes} onChange={setStrokes} size={padSize} disabled={!attempt || result !== null || checking} accessibilityLabel={t('write_pad')} />
          ) : null}
        </View>

        {result ? (
          <PopIn>
            <FeedbackBanner
              kind={result.correct ? 'correct' : 'tryAgain'}
              text={result.correct ? t('praise_1') : t('write_wrong', { read: result.read, letter: result.target })}
              detail={[result.reversal ? t(REVERSAL_TEXT[result.reversal]) : null, t('write_confidence', { letter: result.target, n: Math.round(result.confidence * 100) })]
                .filter(Boolean)
                .join('\n')}
            />
          </PopIn>
        ) : model.status === 'error' ? (
          <FeedbackBanner kind="info" text={t('write_model_error')} />
        ) : model.status === 'loading' ? (
          <AppText variant="caption" center muted>
            {t('write_loading')}
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
  body: { flex: 1, gap: 12, paddingBottom: 4 },
  stats: { flexDirection: 'row', gap: 10 },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  padArea: { flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center' },
});
