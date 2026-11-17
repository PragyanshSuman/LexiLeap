import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACTIVITIES } from '@/engine/catalog';
import type { ActivityId } from '@/engine/types';
import { activityKey, useT, type TranslationKey } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useWellness } from '@/store/wellness';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Bob } from '@/ui/motion';

/** Slide-up sheet with a gradient header, used by the AI Roadmap advisors. */
function Sheet({
  visible,
  colors,
  icon,
  label,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  colors: [string, string];
  icon: string;
  label: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useT();
  const { prefs, colors: theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [slide] = useState(() => new Animated.Value(80));
  const [fade] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    if (prefs.reduceMotion) {
      slide.setValue(0);
      fade.setValue(1);
      return;
    }
    slide.setValue(80);
    fade.setValue(0);
    Animated.parallel([
      Animated.spring(slide, { toValue: 0, damping: 18, stiffness: 200, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [visible, slide, fade, prefs.reduceMotion]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Animated.View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16, transform: [{ translateY: slide }] }]} accessibilityViewIsModal>
          <LinearGradient colors={colors} style={styles.header}>
            <Bob distance={4}>
              <View style={styles.iconCircle}>
                <AppText size={28} fixed>
                  {icon}
                </AppText>
              </View>
            </Bob>
            <View style={styles.flex}>
              <AppText variant="caption" weight="bold" color="rgba(255,255,255,0.85)">
                {label}
              </AppText>
              <AppText variant="heading" weight="bold" color="#FFFFFF" accessibilityRole="header">
                {title}
              </AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} hitSlop={10} style={styles.close}>
              <AppText size={18} fixed weight="bold" color="#FFFFFF">
                ✕
              </AppText>
            </Pressable>
          </LinearGradient>
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/** Activities suggested when a child is struggling: low-stakes, game-like ones. */
const FUN_ACTIVITIES: { id: ActivityId; subtitle: TranslationKey }[] = [
  { id: 'rhyme', subtitle: 'tile_rhyme' },
  { id: 'sight-words', subtitle: 'tile_sight_words' },
  { id: 'odd-one-out', subtitle: 'tile_odd_one_out' },
  { id: 'memory', subtitle: 'tile_memory' },
  { id: 'trace', subtitle: 'tile_trace' },
];

/**
 * US-17 Adaptive Pathing: when a child is struggling, offer a breath, an easier level,
 * or a switch to something more playful. Replaces a plain "try again" loop.
 */
export function AdaptivePathingSheet({
  current,
  canEase,
  onContinue,
  onEase,
  onStop,
  onSwitch,
  reason = 'struggle',
}: {
  current: ActivityId;
  canEase: boolean;
  onContinue: () => void;
  onEase: () => void;
  onStop: () => void;
  onSwitch: (id: ActivityId) => void;
  /** Why it opened: several misses in a row, or the Focus helper noticed tiredness or distraction. */
  reason?: 'struggle' | 'focus';
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const feedback = useFeedback();
  useEffect(() => {
    feedback.say(['ai_title', 'break_title']);
  }, [feedback]);

  return (
    <Sheet visible colors={['#6366F1', '#8B5CF6']} icon="🤖" label={t('ai_label')} title={t('ai_title')} onClose={onContinue}>
      <View style={styles.body}>
        <AppText center muted>
          {t(reason === 'focus' ? 'ai_hint_focus' : 'ai_hint')}
        </AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
          {FUN_ACTIVITIES.filter((a) => a.id !== current).map((a) => {
            const meta = ACTIVITIES[a.id];
            return (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={t(activityKey(a.id, 'title'))}
                onPress={() => {
                  feedback.tap();
                  onSwitch(a.id);
                }}
                style={({ pressed }) => [styles.card, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, pressed && styles.pressed]}
              >
                <View style={[styles.cardIcon, { backgroundColor: `${meta.color}22` }]}>
                  <AppText size={28} fixed>
                    {meta.emoji}
                  </AppText>
                </View>
                <AppText variant="label" weight="bold" center numberOfLines={1} color={meta.color}>
                  {t(activityKey(a.id, 'title'))}
                </AppText>
                <AppText variant="caption" center numberOfLines={2} muted>
                  {t(a.subtitle)}
                </AppText>
                <View style={[styles.go, { backgroundColor: meta.color }]}>
                  <AppText variant="caption" weight="bold" fixed color="#FFFFFF">
                    {t('ai_go')}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        {canEase ? <Button label={t('break_easier')} icon="leaf" variant="secondary" onPress={onEase} /> : null}
        <Button label={t('ai_keep_going')} icon="play" onPress={onContinue} color="#6366F1" />
        <Button label={t('break_stop')} variant="ghost" color={colors.textMuted} onPress={onStop} />
      </View>
    </Sheet>
  );
}

const OUTDOOR: { icon: string; key: string }[] = [
  { icon: '🚶', key: 'walk' },
  { icon: '🤸', key: 'jump' },
  { icon: '🌱', key: 'plants' },
  { icon: '☁️', key: 'clouds' },
  { icon: '🎨', key: 'chalk' },
  { icon: '🐦', key: 'birds' },
  { icon: '🏃', key: 'course' },
];

/** US-18 Wellness Advisor: after a long stretch of play, suggest an outdoor break. */
export function WellnessAdvisorSheet() {
  const { t } = useT();
  const { colors } = useTheme();
  const feedback = useFeedback();
  const { visible, minutes, dismiss } = useWellness();

  useEffect(() => {
    if (visible) feedback.say(['wellness_title', 'wellness_time'], { n: minutes });
  }, [visible, minutes, feedback]);

  const takeBreak = () => {
    dismiss();
    router.dismissTo('/home');
  };

  return (
    <Sheet visible={visible} colors={['#10B981', '#059669']} icon="🌞" label={t('wellness_label')} title={t('wellness_title')} onClose={dismiss}>
      <ScrollView style={styles.wellnessScroll} contentContainerStyle={styles.body}>
        <View style={[styles.timeBadge, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
          <AppText size={22} fixed>
            ⏱
          </AppText>
          <AppText variant="label" style={styles.flex} color="#065F46">
            {t('wellness_time', { n: minutes })}
          </AppText>
        </View>
        <AppText variant="label" weight="bold">
          {t('wellness_pick')}
        </AppText>
        {OUTDOOR.map((o) => (
          <View key={o.key} style={styles.outdoorRow}>
            <View style={[styles.outdoorIcon, { backgroundColor: colors.successSoft }]}>
              <AppText size={24} fixed>
                {o.icon}
              </AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="label">
                {t(`outdoor_${o.key}_title` as TranslationKey)}
              </AppText>
              <AppText variant="caption" muted>
                {t(`outdoor_${o.key}_desc` as TranslationKey)}
              </AppText>
            </View>
          </View>
        ))}
        <Button label={t('wellness_take_break')} icon="leaf" onPress={takeBreak} color="#059669" />
        <Button label={t('wellness_continue')} variant="ghost" color={colors.textMuted} onPress={dismiss} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,15,30,0.65)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '90%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    elevation: 24,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20 },
  iconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20, gap: 12 },
  cards: { gap: 12, paddingVertical: 4 },
  card: { width: 132, padding: 12, borderRadius: 18, borderWidth: 1, alignItems: 'center', gap: 6 },
  cardIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  go: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, marginTop: 2 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  wellnessScroll: { flexGrow: 0 },
  timeBadge: { flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 16, padding: 14, borderWidth: 1 },
  outdoorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  outdoorIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
