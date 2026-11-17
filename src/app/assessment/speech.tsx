import * as Crypto from 'expo-crypto';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FocusTracker } from '@/components/FocusTracker';
import { RecordCheck } from '@/components/RecordCheck';
import { TestFinished } from '@/components/TestFinished';
import { pictureFor } from '@/content/words';
import { SPEECH_TEST_WORDS } from '@/engine/assessment';
import type { SoundResult, SpeechAssessment } from '@/engine/types';
import { useWordListener } from '@/hooks/useWordListener';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { scoreSpeech } from '@/services/speechScoring';
import { useActiveProfile, useAppStore } from '@/store/appStore';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ProgressBar } from '@/ui/controls';
import { FeedbackBanner, ScreenIntro } from '@/ui/Feedback';
import { Header } from '@/ui/Header';
import { PopIn } from '@/ui/motion';
import { Screen } from '@/ui/Screen';
import { MicButton, SoundButton } from '@/ui/SpeechControls';

type Phase = 'intro' | 'testing' | 'done';
/** The Speech Test tile colour on Home. */
const ACCENT = '#1E3A5F';

/** The original clinical speech assessment, scored on the device. */
export default function SpeechTest() {
  const { t } = useT();
  const feedback = useFeedback();
  const profile = useActiveProfile();
  const saveAssessment = useAppStore((s) => s.saveAssessment);
  const listener = useWordListener();
  const auto = listener.available;
  const [phase, setPhase] = useState<Phase>('intro');
  const [items, setItems] = useState<SoundResult[]>([]);
  const [checking, setChecking] = useState(false);
  const [flash, setFlash] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<SpeechAssessment | null>(null);

  if (!profile) return <Redirect href="/login" />;
  const index = items.length;
  const word = SPEECH_TEST_WORDS[index];
  const tracker = <FocusTracker feature="speech-test" />;

  const record = (result: SoundResult) => {
    setMessage(null);
    const next = [...items, result];
    setItems(next);
    if (next.length === SPEECH_TEST_WORDS.length) {
      const assessment: SpeechAssessment = { id: Crypto.randomUUID(), kind: 'speech', takenAt: new Date().toISOString(), method: auto || next.every((r) => r.score !== null) ? 'auto' : 'adult', items: next };
      saveAssessment(profile.id, assessment);
      setSaved(assessment);
      setPhase('done');
      feedback.complete();
    }
  };

  const listen = async () => {
    setMessage(null);
    const outcome = await listener.listen(word);
    if ('error' in outcome) {
      setMessage(t(outcome.error === 'no-speech' ? 'round_no_speech' : outcome.error === 'permission' ? 'round_mic_off' : 'round_mic_error'));
      return;
    }
    await scoreHeard(outcome.transcripts);
  };

  /** Scores what the microphone heard, sound by sound. */
  const scoreHeard = async (transcripts: string[]) => {
    setMessage(null);
    setChecking(true);
    const result = await scoreSpeech(word, transcripts);
    setChecking(false);
    setFlash(result.correct);
    setTimeout(() => {
      setFlash(null);
      record(result);
    }, 900);
  };

  const mark = (correct: boolean) => record({ word, score: null, correct, missed: [], changed: [] });
  const skip = () => record({ word, score: auto ? 0 : null, correct: false, missed: [], changed: [] });

  if (phase === 'intro') {
    return (
      <Screen
        scroll
        header={<Header title={t('assess_title')} />}
        footer={<Button label={t('assess_start')} icon="play" color={ACCENT} onPress={() => setPhase('testing')} />}
        overlay={tracker}
      >
        <ScreenIntro emoji="🩺" title={t('assess_intro_title')} body={t('assess_intro', { n: SPEECH_TEST_WORDS.length })} note={auto ? `🎤 ${t('assess_auto')}` : `👤 ${t('assess_adult')}`} />
      </Screen>
    );
  }

  if (phase === 'done' && saved) {
    // The child just hears that they finished; the results are for grown-ups (parent zone).
    return <TestFinished title={t('assess_title')} color={ACCENT} overlay={tracker} />;
  }

  return (
    <Screen
      header={<Header title={t('assess_title')} subtitle={t('of', { a: index + 1, b: SPEECH_TEST_WORDS.length })} />}
      footer={
        auto ? (
          <Button label={t('assess_skip')} icon="play-skip-forward" variant="ghost" color={ACCENT} disabled={listener.listening || checking} onPress={skip} />
        ) : (
          <View style={styles.row}>
            <Button label={t('assess_wrong')} icon="refresh" variant="secondary" color={ACCENT} onPress={() => mark(false)} style={styles.flex} />
            <Button label={t('assess_correct')} icon="checkmark-circle" color={ACCENT} onPress={() => mark(true)} style={styles.flex} />
          </View>
        )
      }
      overlay={tracker}
    >
      <View style={styles.testBody}>
        <ProgressBar value={index / SPEECH_TEST_WORDS.length} color={ACCENT} />
        <AppText variant="label" center muted>
          {t('assess_read')}
        </AppText>
        <PopIn key={word}>
          <Card style={styles.wordCard}>
            {pictureFor(word) ? (
              <AppText size={48} fixed center>
                {pictureFor(word)}
              </AppText>
            ) : null}
            <AppText size={56} fixed weight="bold" center>
              {word}
            </AppText>
            {/* When an adult marks the words, they can play a word for a child who is stuck. */}
            {auto ? null : <SoundButton label={t('card_play')} color={ACCENT} onPress={() => feedback.speak(word)} />}
          </Card>
        </PopIn>

        {flash !== null ? (
          <FeedbackBanner kind={flash ? 'correct' : 'tryAgain'} text={t(flash ? 'praise_1' : 'encourage_2')} />
        ) : !auto ? (
          <RecordCheck key={word} color={ACCENT} />
        ) : (
          <MicButton
            label={t('phonic_tap_mic')}
            listeningLabel={t('phonic_listening')}
            listening={listener.listening}
            busy={checking}
            color={ACCENT}
            message={message}
            onPress={() => void listen()}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
  center: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  stats: { flexDirection: 'row', gap: 10 },
  tricky: { gap: 10, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { alignItems: 'center', minWidth: 72, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 2 },
  testBody: { flex: 1, gap: 18, justifyContent: 'center' },
  wordCard: { alignItems: 'center', gap: 8, paddingVertical: 24 },
});
