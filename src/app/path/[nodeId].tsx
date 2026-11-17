import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ACTIVITY_DEFINITIONS } from '@/activities/registry';
import { ACTIVITIES } from '@/engine/catalog';
import { NODE_MAP, nodeStatus, nodeXp, PATH_UNITS, type NodeVariant, requiredLevel } from '@/engine/path';
import { useToday } from '@/hooks/useToday';
import { activityKey, nodeTitle, skillKey, unitKey, useT, type TranslationKey } from '@/i18n';
import { useActiveProfile, useProgress } from '@/store/appStore';
import { DT } from '@/theme/dyslexiaTheme';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { BACK_BUTTON, BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { goBackOr } from '@/ui/Header';

const DIFFICULTY: Record<NodeVariant, TranslationKey> = {
  intro: 'diff_easy',
  practice: 'diff_easy',
  challenge: 'diff_medium',
  master: 'diff_hard',
  bonus: 'diff_hard',
};

/** A briefing card for one Learning Path step, then straight into the activity. */
export default function PathNodeBriefing() {
  const { nodeId } = useLocalSearchParams<{ nodeId: string }>();
  const { t } = useT();
  const { prefs, colors } = useTheme();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const today = useToday();
  const [fade] = useState(() => new Animated.Value(prefs.reduceMotion ? 1 : 0));
  const [scale] = useState(() => new Animated.Value(prefs.reduceMotion ? 1 : 0.85));

  useEffect(() => {
    if (prefs.reduceMotion) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, useNativeDriver: true }),
    ]).start();
  }, [fade, scale, prefs.reduceMotion]);

  if (!profile) return <Redirect href="/login" />;
  const node = nodeId ? NODE_MAP[nodeId] : undefined;
  const unit = node ? PATH_UNITS.find((u) => u.id === node.unit) : undefined;

  if (!node || !unit) {
    return (
      <LinearGradient colors={['#1E1B4B', '#0F0E2B']} style={styles.flex}>
        <SafeAreaView style={styles.center}>
          <AppText color="#FFFFFF">{t('brief_not_found')}</AppText>
          <Button label={t('go_back')} icon="arrow-back" variant="secondary" onPress={() => goBackOr('/path')} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const meta = ACTIVITIES[node.activityId];
  const status = nodeStatus(progress.path, node, today);
  const best = progress.path.nodes[node.id]?.best;
  const pct = Math.round(node.target * 100);
  const minutes = Math.max(2, Math.round((ACTIVITY_DEFINITIONS[node.activityId].roundsPerSession * 25) / 60));
  const needed = requiredLevel(node, profile.prefs.maxLevel);
  const goal = needed > 1 ? t('brief_goal_level', { pct, n: needed }) : t('brief_goal', { pct });

  return (
    <LinearGradient colors={['#1E1B4B', '#0F0E2B']} style={styles.flex}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.flex}>
        <View style={styles.topBar}>
          <BackButton onDark fallback="/path" />
        </View>
        <View style={styles.center}>
          <Animated.View style={[styles.card, { backgroundColor: colors.surface, opacity: fade, transform: [{ scale }] }]}>
            <LinearGradient colors={[unit.color, `${unit.color}99`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardHeader}>
              <AppText variant="label" weight="bold" color="rgba(255,255,255,0.9)">
                {unit.icon}  {t(unitKey(unit.id, 'title'))}
              </AppText>
              <AppText size={56} fixed>
                {meta.emoji}
              </AppText>
            </LinearGradient>

            <View style={styles.body}>
              <AppText variant="title" weight="bold" accessibilityRole="header">
                {nodeTitle(t, node)}
              </AppText>
              <AppText muted>
                {t(activityKey(node.activityId, 'tagline'))}. {goal}
              </AppText>

              {status === 'review' ? (
                <AppText variant="label" color={DT.accent.amber}>
                  {t('brief_review')}
                </AppText>
              ) : status === 'completed' && best !== undefined ? (
                <AppText variant="label" color={colors.success}>
                  {t('brief_completed', { pct: Math.round(best * 100) })}
                </AppText>
              ) : status === 'locked' ? (
                <AppText variant="label" muted>
                  {t('brief_locked')}
                </AppText>
              ) : null}

              <View style={styles.chips}>
                <Chip text={t('brief_xp', { n: nodeXp(node) })} />
                <Chip text={t(DIFFICULTY[node.variant])} />
                <Chip text={t('brief_minutes', { n: minutes })} />
              </View>
              <View style={[styles.skill, { borderColor: `${unit.color}88` }]}>
                <AppText variant="caption" weight="bold" color={unit.color}>
                  {t('brief_skill', { skill: t(skillKey(meta.skill)) })}
                </AppText>
              </View>

              <Button
                label={t('brief_open')}
                icon="play"
                color={unit.color}
                disabled={status === 'locked'}
                onPress={() => router.push(`/activity/${node.activityId}`)}
              />
              <AppText variant="caption" center muted>
                {t('brief_hint')}
              </AppText>
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Chip({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      <AppText variant="caption" weight="bold" muted>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { paddingLeft: BACK_BUTTON.left, paddingTop: BACK_BUTTON.top, paddingBottom: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 16 },
  card: { width: '100%', maxWidth: 460, borderRadius: 28, overflow: 'hidden', ...DT.shadow.medium },
  cardHeader: { padding: 24, alignItems: 'center', gap: 8 },
  body: { padding: 24, gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  skill: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
});
