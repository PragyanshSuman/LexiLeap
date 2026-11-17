import { StyleSheet, View } from 'react-native';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { MicButton } from '@/ui/SpeechControls';

interface RecordCheckProps {
  color: string;
  disabled?: boolean;
  /** A grown-up's verdict after listening to the recording. Omit to show only record and play back. */
  onMark?: (correct: boolean) => void;
}

/**
 * The microphone where the app has no speech recogniser (the Expo Go preview): the child records
 * themselves with the same big microphone, a grown-up plays it back and marks it. In the installed app
 * the microphone instead listens and scores every sound automatically.
 */
export function RecordCheck({ color, disabled, onMark }: RecordCheckProps) {
  const { t } = useT();
  const { space } = useTheme();
  const recorder = useVoiceRecorder();
  const recording = recorder.status === 'recording';

  return (
    <View style={{ gap: space(3) }}>
      <MicButton
        label={t('record_tap')}
        listeningLabel={t('record_recording')}
        listening={recording}
        stoppable
        disabled={disabled}
        color={color}
        message={recorder.status === 'denied' ? t('round_mic_off') : null}
        onPress={() => void (recording ? recorder.stop() : recorder.start())}
      />
      {recorder.status === 'recorded' ? (
        <View style={{ gap: space(3) }}>
          <Button label={t('record_play')} icon="play" variant="secondary" color={color} disabled={disabled} onPress={recorder.play} />
          {onMark ? (
            <View style={styles.row}>
              <Button
                label={t('round_not_yet')}
                icon="refresh"
                variant="secondary"
                color={color}
                disabled={disabled}
                style={styles.flex}
                onPress={() => {
                  recorder.reset();
                  onMark(false);
                }}
              />
              <Button label={t('record_sounded_right')} icon="checkmark" color={color} disabled={disabled} style={styles.flex} onPress={() => onMark(true)} />
            </View>
          ) : null}
        </View>
      ) : null}
      <AppText variant="caption" muted center>
        {t('record_note')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});
