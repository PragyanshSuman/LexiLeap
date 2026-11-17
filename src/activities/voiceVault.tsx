import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { pictureFor } from '@/content/words';
import { ACTIVITIES } from '@/engine/catalog';
import { useT, type TranslationKey } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { pronounce } from '@/services/pronunciationDictionary';
import { restoreAudioMode } from '@/services/sounds';
import { isSpeechRecognitionAvailable, listenForWord, type ListenError } from '@/services/speechRecognition';
import { findSpokenRhyme } from '@/speech/rhyme';
import { useActiveProfile, useAppStore, useProgress } from '@/store/appStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { MicButton, SoundButton } from '@/ui/SpeechControls';
import { generateVoiceVaultRounds, type VoiceVaultRound } from './generators';
import { RecordCheck } from '@/components/RecordCheck';
import { Prompt } from './shared';
import type { ActivityDefinition, RoundProps } from './types';

/** Give up listening after this long, in case the recogniser never reports back. */
const LISTEN_TIMEOUT_MS = 9000;

const ERROR_TEXT: Record<ListenError, TranslationKey> = {
  'no-speech': 'round_no_speech',
  permission: 'round_mic_off',
  unavailable: 'round_no_recognition',
  other: 'round_mic_error',
};

/**
 * Voice Vault (the original Rhyme Time's other "coming soon" mode, now playable): Polly the parrot says a
 * word and the child says any word that rhymes with it. The rhyme is checked on the device with the
 * pronunciation dictionary, and every new rhyme is locked in the child's vault. Without a microphone or
 * speech recognition, a grown-up (or the child) marks the answer instead, like Say It.
 */
function VoiceVaultRoundView({ round, revealed, disabled, onAnswer, accent }: RoundProps<VoiceVaultRound>) {
  const { t } = useT();
  const { colors, space } = useTheme();
  const feedback = useFeedback();
  const profile = useActiveProfile();
  const vault = useProgress(profile?.id).rhymeVault ?? {};
  const addToRhymeVault = useAppStore((s) => s.addToRhymeVault);
  const [canListen, setCanListen] = useState(() => isSpeechRecognitionAvailable());
  const [status, setStatus] = useState<'idle' | 'listening' | 'checking'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const cancel = useRef<(() => void) | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);
  const mounted = useRef(true);

  const stopListening = () => {
    active.current = false;
    cancel.current?.();
    cancel.current = null;
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
  };
  useEffect(
    () => () => {
      mounted.current = false;
      stopListening();
    },
    [],
  );

  const check = async (transcripts: string[]) => {
    setStatus('checking');
    const { rhyme, heard } = await findSpokenRhyme(round.word, transcripts, async (w) => (await pronounce(w)).phonemes);
    if (!mounted.current) return;
    setStatus('idle');
    if (rhyme) {
      if (profile) addToRhymeVault(profile.id, round.word, rhyme);
      setSaved(rhyme);
      setMessage(null);
      onAnswer({ correct: true, score: 1 });
    } else {
      setMessage(heard ? t('vault_not_rhyme', { heard, word: round.word }) : null);
      onAnswer({ correct: false });
    }
  };

  const listen = async () => {
    if (disabled || revealed || status !== 'idle') return;
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
        if (error === 'permission' || error === 'unavailable') setCanListen(false);
      },
    });
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

  const mine = vault[round.word] ?? [];
  const totalSaved = Object.values(vault).reduce((sum, words) => sum + words.length, 0);

  return (
    <View style={styles.root}>
      <Prompt>
        <View style={styles.parrotRow}>
          <AppText size={64} fixed accessibilityElementsHidden importantForAccessibility="no">
            🦜
          </AppText>
          <View style={[styles.bubble, { backgroundColor: colors.surface, borderColor: accent }]}>
            <AppText size={44} fixed>
              {pictureFor(round.word)}
            </AppText>
            <AppText size={40} weight="bold" center style={{ lineHeight: 52 }} accessibilityRole="header">
              {round.word}
            </AppText>
          </View>
        </View>
        <AppText variant="label" center>
          {t('vault_prompt', { word: round.word })}
        </AppText>
        <SoundButton label={t('round_hear_it')} color={accent} onPress={() => feedback.speak(round.word)} />
      </Prompt>

      {saved ? (
        <AppText variant="heading" center color={colors.success} accessibilityLiveRegion="polite">
          {t('vault_saved', { word: saved })}
        </AppText>
      ) : revealed ? (
        <AppText variant="label" center>
          {t('vault_reveal', { word: round.word, rhymes: round.rhymes.join(', ') })}
        </AppText>
      ) : canListen ? (
        <MicButton
          label={t('vault_tap_mic')}
          listeningLabel={t('round_listening')}
          listening={status === 'listening'}
          busy={status === 'checking'}
          disabled={disabled || revealed}
          color={accent}
          message={message}
          onPress={listen}
        />
      ) : (
        <RecordCheck color={accent} disabled={disabled || revealed} onMark={(correct) => onAnswer(correct ? { correct: true, score: 1 } : { correct: false })} />
      )}

      <View style={[styles.vault, { borderColor: colors.border, backgroundColor: colors.surfaceAlt, gap: space(2) }]} accessible accessibilityLabel={t('vault_count', { n: totalSaved })}>
        <AppText variant="caption" weight="bold" muted>
          {`🔐 ${t('vault_count', { n: totalSaved })}`}
        </AppText>
        {mine.length > 0 ? (
          <View style={styles.chips}>
            {mine.map((w) => (
              <View key={w} style={[styles.chip, { backgroundColor: `${accent}22`, borderColor: accent }]}>
                <AppText size={14} fixed weight="bold">
                  {w}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}


export const voiceVault: ActivityDefinition<VoiceVaultRound> = {
  meta: ACTIVITIES['voice-vault'],
  roundsPerSession: 5,
  maxAttempts: 3,
  generate: ({ level, rng }) => generateVoiceVaultRounds(level, rng, 5),
  prompt: (r) => `${r.word}. Can you say a word that rhymes with ${r.word}?`,
  reveal: (r) => `${r.rhymes.join(', ')} all rhyme with ${r.word}.`,
  timesResponses: false,
  tour: [
    { title: 'tour_vault_title', description: 'tour_vault_desc' },
    { title: 'tour_vault_lock_title', description: 'tour_vault_lock_desc' },
  ],
  Round: VoiceVaultRoundView,
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-evenly' },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  parrotRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bubble: { borderWidth: 3, borderRadius: 24, paddingVertical: 8, paddingHorizontal: 20, alignItems: 'center', minWidth: 140 },
  vault: { borderWidth: 1, borderRadius: 16, padding: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
});
