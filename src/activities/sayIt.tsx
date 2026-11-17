import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ACTIVITIES } from '@/engine/catalog';
import { useFeedback } from '@/services/feedback';
import { restoreAudioMode } from '@/services/sounds';
import { matchSpokenWord } from '@/services/speechMatch';
import { isSpeechRecognitionAvailable, listenForWord, type ListenError } from '@/services/speechRecognition';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { MicButton, SoundButton } from '@/ui/SpeechControls';
import { generateSayItRounds, type SayItRound } from './generators';
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
        const { match, heard } = matchSpokenWord(round.word, transcripts);
        setStatus('heard');
        if (match === 'none') setMessage(heard ? t('round_heard', { word: heard }) : null);
        onAnswer(match === 'none' ? { correct: false } : { correct: true, score: match === 'exact' ? 1 : 0.7 });
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
        <SelfCheck accent={accent} word={round.word} disabled={disabled || revealed} message={message} onAnswer={onAnswer} />
      )}
    </View>
  );
}

/**
 * Practice mode for devices without speech recognition (or with the microphone off):
 * the child reads the word aloud, hears it, and says whether theirs matched.
 */
function SelfCheck({ accent, word, disabled, message, onAnswer }: { accent: string; word: string; disabled: boolean; message: string | null; onAnswer: RoundProps<SayItRound>['onAnswer'] }) {
  const { space } = useTheme();
  const { t } = useT();
  const feedback = useFeedback();
  const [listened, setListened] = useState(false);
  return (
    <View style={{ gap: space(3) }}>
      {message ? (
        <AppText variant="caption" muted center>
          {message}
        </AppText>
      ) : null}
      <AppText center>{t('round_self_check')}</AppText>
      <Button
        label={t('round_check')}
        icon="ear"
        variant="secondary"
        color={accent}
        disabled={disabled}
        onPress={() => {
          feedback.speak(word);
          setListened(true);
        }}
      />
      {listened ? (
        <View style={[styles.row, { gap: space(3) }]}>
          <Button label={t('round_not_yet')} icon="refresh" variant="secondary" color={accent} disabled={disabled} onPress={() => onAnswer({ correct: false })} style={styles.flex} />
          <Button label={t('round_said_it')} icon="checkmark" color={accent} disabled={disabled} onPress={() => onAnswer({ correct: true, score: 1 })} style={styles.flex} />
        </View>
      ) : null}
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
