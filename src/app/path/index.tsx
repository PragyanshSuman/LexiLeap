import { Redirect, router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FeatureTour, InfoButton, useFeatureTour, type TourStep } from '@/components/FeatureTour';
import { ACTIVITIES } from '@/engine/catalog';
import { nodeStatus, PATH_UNITS, pathLevel, suggestedNode, unitNodes, XP_PER_LEVEL, type NodeStatus, type PathNode, type PathState, type PathUnit } from '@/engine/path';
import { currentStreak } from '@/engine/streak';
import { useToday } from '@/hooks/useToday';
import type { DayKey } from '@/lib/date';
import { nodeTitle, unitKey, useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useActiveProfile, useAppStore, useProgress } from '@/store/appStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { BACK_BUTTON, BackButton } from '@/ui/BackButton';
import { FadeInUp, PressableScale } from '@/ui/motion';

const NODE_SIZE = 64;

const TOUR: TourStep[] = [
  { title: 'tour_path_map_title', description: 'tour_path_map_desc' },
  { title: 'tour_path_today_title', description: 'tour_path_today_desc' },
  { title: 'tour_path_xp_title', description: 'tour_path_xp_desc' },
];

const GEM_COLOURS: Record<NodeStatus, [string, string]> = {
  locked: ['#374151', '#1F2937'],
  completed: ['#16A34A', '#15803D'],
  review: ['#D97706', '#B45309'],
  available: ['#000000', '#000000'], // replaced by the unit colour
};

/** The original "DysPath" map: units of gems on a deep indigo night sky. */
export default function LearningPath() {
  const { t } = useT();
  const { prefs } = useTheme();
  const { width } = useWindowDimensions();
  const feedback = useFeedback();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const ensurePlan = useAppStore((s) => s.ensurePlan);
  const today = useToday();
  const tour = useFeatureTour('path');
  const [pulse] = useState(() => new Animated.Value(1));

  useFocusEffect(
    useCallback(() => {
      if (profile) ensurePlan(profile.id, today);
    }, [profile, ensurePlan, today]),
  );

  // Available gems gently pulse, as in the original.
  useEffect(() => {
    if (prefs.reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, prefs.reduceMotion]);

  if (!profile) return <Redirect href="/login" />;

  const plan = progress.plan?.day === today ? progress.plan : null;
  const planned = new Set(plan?.items.filter((i) => !i.done).map((i) => i.activityId) ?? []);
  const xp = pathLevel(progress.path.xp);
  const streak = currentStreak(progress.streak, today);
  const contentWidth = Math.min(width, 720) - 32;
  const nodeWidth = Math.floor((contentWidth - 24) / 3);
  const next = suggestedNode(progress, today);

  const openNode = (node: PathNode) => {
    feedback.tap();
    router.push({ pathname: '/path/[nodeId]', params: { nodeId: node.id } });
  };

  return (
    <View style={styles.flex}>
      <StatusBar style="light" />
      <LinearGradient colors={['#312E81', '#1E1B4B', '#0F0E2B']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex}>
        <FadeInUp>
          <View style={styles.header}>
            <BackButton onDark fallback="/home" />
            <View style={styles.flex}>
              <AppText variant="heading" weight="bold" color="#FFFFFF" accessibilityRole="header">
                {t('path_title')}
              </AppText>
              <View style={styles.xpRow} accessible accessibilityLabel={`${t('path_level', { n: xp.level })}, ${t('path_xp', { a: xp.inLevel, b: XP_PER_LEVEL })}`}>
                <View style={styles.levelBadge}>
                  <AppText size={11} fixed weight="bold" color="#1F2937">
                    {t('path_level', { n: xp.level })}
                  </AppText>
                </View>
                <View style={styles.xpBar}>
                  <View style={[styles.xpFill, { width: `${Math.round(xp.fraction * 100)}%` }]} />
                </View>
                <AppText size={11} fixed weight="semibold" color="#C7D2FE">
                  {t('path_xp', { a: xp.inLevel, b: XP_PER_LEVEL })}
                </AppText>
              </View>
            </View>
            <View style={styles.streak} accessible accessibilityLabel={`🔥 ${streak}`}>
              <AppText size={22} fixed>
                🔥
              </AppText>
              <AppText size={14} fixed weight="bold" color="#FCD34D">
                {String(streak)}
              </AppText>
            </View>
            <InfoButton light onPress={tour.open} />
          </View>
        </FadeInUp>

        <ScrollView contentContainerStyle={[styles.scroll, { width: contentWidth + 32 }]} showsVerticalScrollIndicator={false}>
          {plan ? (
            <FadeInUp index={1}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={plan.completed ? t('home_today_complete') : t('path_today_lesson')}
                disabled={plan.completed || !next}
                onPress={() => next && openNode(next)}
                style={styles.hero}
                innerStyle={styles.heroInner}
                pressedScale={0.97}
              >
                <LinearGradient colors={plan.completed ? ['#2E7D32', '#1B5E20'] : ['#5B6EC8', '#3730A3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroGradient}>
                  <View style={styles.flex}>
                    <AppText variant="caption" weight="bold" color="rgba(255,255,255,0.85)">
                      {plan.completed ? t('home_today_complete') : t('path_today_lesson')}
                    </AppText>
                    <AppText variant="heading" weight="bold" color="#FFFFFF">
                      {t('path_recommended', { n: plan.items.length })}
                    </AppText>
                    <View style={styles.heroDots}>
                      {plan.items.map((item, i) => (
                        <View key={`${item.activityId}-${i}`} style={[styles.heroDot, item.done && styles.heroDotDone]}>
                          <AppText size={16} fixed>
                            {item.done ? '✓' : ACTIVITIES[item.activityId].emoji}
                          </AppText>
                        </View>
                      ))}
                    </View>
                  </View>
                  {!plan.completed && next ? (
                    <View style={styles.heroButton}>
                      <AppText variant="label" weight="bold" fixed color="#FFFFFF">
                        {t('path_start')}
                      </AppText>
                    </View>
                  ) : null}
                </LinearGradient>
              </PressableScale>
              <View style={styles.reason}>
                <AppText variant="caption" color="#A5B4FC">
                  🤖 {plan.reason}
                </AppText>
              </View>
            </FadeInUp>
          ) : null}

          {PATH_UNITS.map((unit, u) => (
            <FadeInUp key={unit.id} index={u + 2}>
              <UnitSection unit={unit} path={progress.path} today={today} nodeWidth={nodeWidth} pulse={pulse} planned={planned} onOpen={openNode} />
            </FadeInUp>
          ))}
          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>
      <FeatureTour visible={tour.visible} steps={TOUR} onClose={tour.close} />
    </View>
  );
}

interface SectionProps {
  unit: PathUnit;
  path: PathState;
  today: DayKey;
  nodeWidth: number;
  pulse: Animated.Value;
  planned: Set<string>;
  onOpen: (node: PathNode) => void;
}

function UnitSection({ unit, path, today, nodeWidth, pulse, planned, onOpen }: SectionProps) {
  const { t } = useT();
  const nodes = unitNodes(unit.id);
  const statuses = nodes.map((n) => nodeStatus(path, n, today));
  const completed = statuses.filter((s) => s === 'completed' || s === 'review').length;
  const locked = statuses.every((s) => s === 'locked');
  return (
    <View style={styles.unit}>
      <LinearGradient colors={[`${unit.color}DD`, `${unit.color}88`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.unitHeader}>
        <AppText size={32} fixed>
          {locked ? '🔒' : unit.icon}
        </AppText>
        <View style={styles.flex}>
          <AppText variant="heading" weight="bold" color="#FFFFFF">
            {t(unitKey(unit.id, 'title'))}
          </AppText>
          <AppText variant="caption" weight="semibold" color="rgba(255,255,255,0.75)">
            {t(unitKey(unit.id, 'subtitle'))}
          </AppText>
        </View>
        <View style={styles.unitCount}>
          <AppText variant="label" weight="bold" fixed color="#FFFFFF">
            {`${completed}/${nodes.length}`}
          </AppText>
        </View>
      </LinearGradient>
      <View style={styles.unitBar}>
        <View style={[styles.unitFill, { width: `${Math.round((completed / nodes.length) * 100)}%`, backgroundColor: unit.color }]} />
      </View>
      <View style={styles.nodes}>
        {nodes.map((n, i) => (
          <Gem
            key={n.id}
            node={n}
            status={statuses[i]}
            best={path.nodes[n.id]?.best}
            color={unit.color}
            width={nodeWidth}
            isToday={planned.has(n.activityId) && (statuses[i] === 'available' || statuses[i] === 'review')}
            pulse={pulse}
            onPress={() => onOpen(n)}
          />
        ))}
      </View>
    </View>
  );
}

interface GemProps {
  node: PathNode;
  status: NodeStatus;
  best: number | undefined;
  color: string;
  width: number;
  isToday: boolean;
  pulse: Animated.Value;
  onPress: () => void;
}

/** One activity "gem": colour shows its state; available gems pulse. */
function Gem({ node, status, best, color, width, isToday, pulse, onPress }: GemProps) {
  const { t } = useT();
  const gemColor = status === 'locked' ? '#4B5563' : status === 'completed' ? '#22C55E' : status === 'review' ? '#F59E0B' : color;
  const fill: [string, string] = status === 'available' ? [color, `${color}BB`] : GEM_COLOURS[status];
  const icon = status === 'completed' ? '✓' : status === 'review' ? '🔄' : status === 'locked' ? '🔒' : ACTIVITIES[node.activityId].emoji;
  const label = nodeTitle(t, node);
  const statusText = status === 'locked' ? t('node_locked') : status === 'review' ? t('node_review') : status === 'completed' ? t('node_done') : '';
  const gem = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[label, statusText, isToday ? t('node_today') : ''].filter(Boolean).join(', ')}
      onPress={onPress}
      style={[styles.gemTouch, { width }]}
    >
      <View style={[styles.gemOuter, { borderColor: gemColor }, isToday && styles.gemToday]}>
        <LinearGradient colors={fill} style={styles.gem}>
          <AppText size={26} fixed style={status === 'locked' ? styles.lockedIcon : undefined} color="#FFFFFF">
            {icon}
          </AppText>
        </LinearGradient>
      </View>
      <AppText size={11} fixed weight="semibold" center numberOfLines={2} color={status === 'locked' ? '#6B7280' : '#E0E7FF'} style={styles.gemLabel}>
        {label}
      </AppText>
      {best !== undefined ? (
        <View style={[styles.pill, { backgroundColor: `${gemColor}33` }]}>
          <AppText size={11} fixed weight="bold" color={gemColor}>
            {`${Math.round(best * 100)}%`}
          </AppText>
        </View>
      ) : null}
      {isToday ? (
        <View style={styles.todayBadge}>
          <AppText size={10} fixed weight="bold" color="#1F2937">
            {t('node_today')}
          </AppText>
        </View>
      ) : null}
      {node.variant === 'bonus' ? (
        <View style={styles.bonusBadge}>
          <AppText size={10} fixed weight="bold" color="#FFFFFF">
            {t('node_bonus_badge')}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
  const pulsing = status === 'available' || status === 'review' || isToday;
  return pulsing ? <Animated.View style={{ transform: [{ scale: pulse }] }}>{gem}</Animated.View> : gem;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Full width, with the back button at the standard spot (BACK_BUTTON).
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: BACK_BUTTON.left, paddingRight: 16, paddingTop: BACK_BUTTON.top, paddingBottom: 12, gap: 12, width: '100%' },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  levelBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  xpBar: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 4 },
  streak: { alignItems: 'center' },
  scroll: { alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8 },
  hero: { borderRadius: 20, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  heroInner: { borderRadius: 20, overflow: 'hidden' },
  heroGradient: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 },
  heroDots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  heroDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDotDone: { backgroundColor: '#22C55E', borderColor: '#16A34A' },
  heroButton: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  reason: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  unit: { marginBottom: 32 },
  unitHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderRadius: 18, marginBottom: 4 },
  unitCount: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  unitBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', marginBottom: 16 },
  unitFill: { height: '100%', borderRadius: 2 },
  nodes: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gemTouch: { alignItems: 'center', paddingVertical: 4 },
  gemOuter: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 3,
    padding: 3,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  gemToday: { borderWidth: 4, shadowOpacity: 0.6 },
  gem: { flex: 1, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  lockedIcon: { opacity: 0.5 },
  gemLabel: { marginTop: 6 },
  pill: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  todayBadge: { backgroundColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
  bonusBadge: { backgroundColor: '#7C3AED', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
});
