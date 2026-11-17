import { useCallback, useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useT, type TranslationKey, type Vars } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useActiveProfile, useAppStore, useProgress } from '@/store/appStore';
import { DT } from '@/theme/dyslexiaTheme';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { ALL_ORIENTATIONS } from '@/ui/orientations';

export interface TourStep {
  title: TranslationKey;
  description: TranslationKey;
  vars?: Vars;
}

/**
 * Shows a screen's tour automatically the first time the active child opens it, and
 * whenever `open()` is called (the ⓘ button). Seen tours are remembered per child.
 */
export function useFeatureTour(tourId: string) {
  const profile = useActiveProfile();
  const seen = useProgress(profile?.id).toursSeen?.[tourId] ?? false;
  const markTourSeen = useAppStore((s) => s.markTourSeen);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (seen || !profile) return;
    const timer = setTimeout(() => setVisible(true), 700);
    return () => clearTimeout(timer);
  }, [seen, profile]);

  const close = useCallback(() => {
    setVisible(false);
    if (profile) markTourSeen(profile.id, tourId);
  }, [profile, markTourSeen, tourId]);

  return { visible, open: () => setVisible(true), close };
}

/** The original app's tour card: one step at a time, read aloud in the app language. */
export function FeatureTour({ visible, steps, onClose }: { visible: boolean; steps: TourStep[]; onClose: () => void }) {
  const { t } = useT();
  const { prefs, colors } = useTheme();
  const feedback = useFeedback();
  const [index, setIndex] = useState(0);
  const [fade] = useState(() => new Animated.Value(0));
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  // Each step fades in and is read aloud.
  useEffect(() => {
    if (!visible || !step) return;
    fade.setValue(prefs.reduceMotion ? 1 : 0);
    if (!prefs.reduceMotion) Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    feedback.say([step.title, step.description], step.vars);
  }, [visible, step, fade, prefs.reduceMotion, feedback]);

  const finish = () => {
    feedback.stopSpeaking();
    setIndex(0);
    onClose();
  };

  if (!visible || !step) return null;
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={finish} supportedOrientations={ALL_ORIENTATIONS}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { backgroundColor: colors.surface, opacity: fade }]} accessibilityViewIsModal>
          <View style={styles.dots}>
            {steps.map((s, i) => (
              <View key={s.title} style={[styles.dot, { backgroundColor: i === index ? colors.primary : colors.border }, i === index && styles.dotActive]} />
            ))}
          </View>
          <AppText variant="heading" center accessibilityRole="header">
            {t(step.title, step.vars)}
          </AppText>
          <AppText center muted>
            {t(step.description, step.vars)}
          </AppText>
          <View style={styles.actions}>
            {!last ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('tour_skip')} onPress={finish} style={styles.skip}>
                <AppText variant="label" muted>
                  {t('tour_skip')}
                </AppText>
              </Pressable>
            ) : null}
            <Button
              label={last ? t('tour_done') : t('tour_next')}
              icon={last ? 'checkmark' : 'arrow-forward'}
              compact
              onPress={() => (last ? finish() : setIndex(index + 1))}
              style={styles.next}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Small ⓘ button that replays a screen's tour. */
export function InfoButton({ onPress, light }: { onPress: () => void; light?: boolean }) {
  const { t } = useT();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('tour_info')}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.info, light ? styles.infoLight : { borderColor: colors.primary, backgroundColor: colors.primarySoft }, pressed && styles.pressed]}
    >
      <AppText size={20} fixed weight="bold" color={light ? '#FFFFFF' : colors.primary}>
        i
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 14, 43, 0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 24,
    gap: 12,
    ...DT.shadow.medium,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 22 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  skip: { paddingVertical: 10, paddingHorizontal: 12 },
  next: { minWidth: 140 },
  info: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLight: { borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.15)' },
  pressed: { opacity: 0.7 },
});
