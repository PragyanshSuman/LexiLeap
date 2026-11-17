import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ACTIVITIES } from '@/engine/catalog';
import { useFeedback } from '@/services/feedback';
import { restoreAudioMode } from '@/services/sounds';
import { scoreSpeech } from '@/services/speechScoring';
import { isSpeechRecognitionAvailable, listenForWord, type ListenError } from '@/services/speechRecognition';
import { AppText } from '@/ui/AppText';
import { MicButton, SoundButton } from '@/ui/SpeechControls';
import { generateSayItRounds, type SayItRound } from './generators';
import { RecordCheck } from '@/components/RecordCheck';
import { Picture, Prompt } from './shared';
import type { ActivityDefinition, RoundProps } from './types';
import { useT, type TranslationKey } from '@/i18n';

/** Give up listening after this long, in case the recogniser never reports back. */
const LISTEN_TIMEOUT_MS = 9000;

type Status = 'idle' | 'listening' | 'heard';

const ERROR_TEXT: Record<ListenError, TranslationKey> = {
  'no-speech': 'round_no_speech',
  permission: 'round_mic_off',
  unavailable: 'round_no_recognition',
  other: 'round_mic_error',
};

function SayItRoundView({ round, revealed, disabled, onAnswer, accent }: RoundProps<SayItRound>) {
  const { t } = useT();
  const feedback = useFeedback();
  const [canListen, setCanListen] = useState(() => isSpeechRecognitionAvailable());
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const cancel = useRef<(() => void) | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True from tapping the mic until a result or error arrives. */
  const active = useRef(false);

  const stopListening = () => {
    active.current = false;
    cancel.current?.();
    cancel.current = null;
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
  };
  useEffect(() => stopListening, []);

  /** Scores what the microphone heard sound by sound (phoneme accuracy, as in the original). */
  const check = async (transcripts: string[]) => {
    setStatus('heard');
    const result = await scoreSpeech(round.word, transcripts);
    const right = Math.round((result.score ?? 0) * 100);
    setMessage(result.correct ? t('sayit_sounds_right', { n: right }) : t('sayit_heard_sounds', { word: result.heard ?? '', n: right }));
    onAnswer(result.correct ? { correct: true, score: result.score ?? 1 } : { correct: false });
  };

  const listen = async () => {
    if (disabled || revealed || status === 'listening') return;
    feedback.stopSpeaking();
    setMessage(null);
    setStatus('listening');
    active.current = true;
    const cancelListening = await listenForWord(round.word, {
      onResult: (transcripts) => {
        stopListening();
        restoreAudioMode();
        void check(transcripts);
      },
      onError: (error) => {
        stopListening();
        restoreAudioMode();
        setStatus('idle');
        setMessage(t(ERROR_TEXT[error]));
        // Without a working microphone, switch to listen-and-check practice for the rest of the round.
        if (error === 'permission' || error === 'unavailable') setCanListen(false);
      },
    });
    // The listener may already have finished (e.g. permission denied) or the round unmounted.
    if (!active.current) {
      cancelListening();
      return;
    }
    cancel.current = cancelListening;
    timeout.current = setTimeout(() => {
      stopListening();
      restoreAudioMode();
      setStatus('idle');
      setMessage(t(ERROR_TEXT['no-speech']));
    }, LISTEN_TIMEOUT_MS);
  };

  return (
    <View style={styles.root}>
      <Prompt>
        <Picture emoji={round.emoji} size={88} />
        <AppText size={52} weight="bold" center style={{ lineHeight: 68 }} accessibilityRole="header">
          {round.word}
        </AppText>
        <SoundButton label={t('round_hear_it')} color={accent} onPress={() => feedback.speak(round.word)} />
      </Prompt>

      {canListen ? (
        <MicButton
          label={t('round_tap_mic')}
          listeningLabel={t('round_listening')}
          listening={status === 'listening'}
          disabled={disabled || revealed}
          color={accent}
          message={message}
          onPress={listen}
        />
      ) : (
        <RecordCheck color={accent} disabled={disabled || revealed} onMark={(correct) => onAnswer(correct ? { correct: true, score: 1 } : { correct: false })} />
      )}
    </View>
  );
}


export const sayIt: ActivityDefinition<SayItRound> = {
  meta: ACTIVITIES['say-it'],
  roundsPerSession: 6,
  maxAttempts: 3,
  generate: ({ level, rng }) => generateSayItRounds(level, rng, 6),
  // Don't read the word out: the point is for the child to read it first.
  prompt: () => 'Can you read this word out loud?',
  reveal: (r) => `This word is ${r.word}.`,
  timesResponses: false,
  Round: SayItRoundView,
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-evenly' },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
});
