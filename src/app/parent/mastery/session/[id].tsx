import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '@/ui/BackButton';
import { useT, type TranslationKey } from '@/i18n';
import { useProfile, useProgress } from '@/store/appStore';
import { DT } from '@/theme/dyslexiaTheme';
import { AppText } from '@/ui/AppText';
import { goBackOr } from '@/ui/Header';
import { masteryScores, riskLevel } from '@/writing/featureExtractor';
import { MasteryMeasures } from '@/writing/MasteryMeasures';
import { ProgressRing } from '@/writing/WritingParts';

type Tab = 'overview' | 'detailed' | 'diagnostic';
const TABS: { id: Tab; label: TranslationKey }[] = [
  { id: 'overview', label: 'mastery_tab_overview' },
  { id: 'detailed', label: 'mastery_tab_detailed' },
  { id: 'diagnostic', label: 'mastery_tab_diagnostic' },
];
const RISK_COLOR = { low: DT.text.success, moderate: DT.accent.amber, high: DT.text.error } as const;
const REVERSAL_TEXT = { horizontal_flip: 'write_mirrored', vertical_flip: 'write_upside_down', rotation_180: 'write_rotated' } as const;

/** The original Session Report for one letter written in Letter Mastery, for grown-ups (parent zone). */
export default function MasterySessionReport() {
  const { id, childId } = useLocalSearchParams<{ id: string; childId: string }>();
  const { t, language } = useT();
  const profile = useProfile(childId);
  const progress = useProgress(childId);
  const [tab, setTab] = useState<Tab>('overview');
  if (!profile) return <Redirect href="/parent" />;

  const report = (progress.mastery ?? []).find((r) => r.sessionId === id);
  const header = (
    <View style={styles.header}>
      <AppText size={20} weight="bold" color={DT.text.primary} accessibilityRole="header">
        {t('mastery_report_title')}
      </AppText>
    </View>
  );

  if (!report) {
    return (
      <View style={styles.container}>
    <SafeAreaView edges={['top', 'bottom']} style={styles.flex}>
        {header}
        <View style={styles.emptyState}>
          <AppText size={64} fixed style={styles.mb16}>
            📋
          </AppText>
          <AppText size={24} weight="bold" color={DT.text.primary} center style={styles.mb8}>
            {t('mastery_no_report')}
          </AppText>
          <AppText size={15} color={DT.text.secondary} center style={styles.mb32}>
            {t('mastery_no_report_body')}
          </AppText>
          <Pressable accessibilityRole="button" onPress={() => goBackOr('/parent')} style={[styles.doneBtn, styles.wide]}>
            <AppText size={16} weight="bold" color={DT.text.onDark}>
              {t('go_back')}
            </AppText>
          </Pressable>
        </View>
      </SafeAreaView>
        <BackButton placement="floating" fallback="/parent" />
      </View>
    );
  }

  const scores = masteryScores(report);
  const level = riskLevel(scores);
  const c = report.clinical;
  const fixed = (n: number, digits: number) => (Number.isFinite(n) ? n.toFixed(digits) : '0');
  const strokesMatch = c.sequencing.strokeSequenceCorrect;
  const dateLocale = language === 'en' ? undefined : `${language}-IN`;

  const overview = (
    <>
      <View style={styles.headerCard}>
        <AppText size={80} weight="bold" fixed color={DT.accent.navy} style={styles.letter}>
          {report.letter}
        </AppText>
        <AppText size={14} color={DT.text.muted} style={styles.mb12}>
          {new Date(report.timestamp).toLocaleString(dateLocale)}
        </AppText>
        <View style={styles.statusBadge}>
          <AppText size={12} weight="bold" color={report.overview.isCorrect ? DT.text.success : DT.accent.amber}>
            {t(report.overview.isCorrect ? 'mastery_read_correct' : 'mastery_read_as', { letter: report.ml.predictedChar })}
          </AppText>
        </View>
      </View>
      <Section title={t('mastery_performance')}>
        <View style={styles.scoreGrid}>
          <ScoreCard title={t('mastery_accuracy')} score={scores.accuracy} />
          <ScoreCard title={t('mastery_fluency')} score={scores.fluency} />
          <ScoreCard title={t('mastery_coverage')} score={scores.coverage} />
          <ScoreCard title={t('mastery_duration')} score={scores.durationScore} />
        </View>
      </Section>
      <Section title={t('mastery_session_metrics')}>
        <Row label={t('mastery_duration')} value={`${fixed(report.overview.completionTime / 1000, 1)}s`} />
        <Row label={t('mastery_m_strokes_drawn')} value={String(c.sequencing.strokeCountActual)} />
        <Row label={t('mastery_m_speed')} value={`${fixed(c.kinematics.avgVelocity * 1000, 1)} px/s`} />
        <Row label={t('mastery_m_time_in_motion')} value={`${fixed(c.kinematics.timeInMotion / 1000, 1)}s`} />
      </Section>
      <Section title={t('mastery_stroke_analysis')}>
        <Row label={t('mastery_stroke_match')} value={t(strokesMatch ? 'mastery_stroke_perfect' : 'mastery_stroke_deviation')} color={strokesMatch ? DT.text.success : DT.accent.amber} />
        <Row label={t('mastery_expected_strokes')} value={String(c.sequencing.strokeCountExpected)} />
        <Row label={t('mastery_actual_strokes')} value={String(c.sequencing.strokeCountActual)} />
        <Row label={t('mastery_m_direction')} value={`${Math.round(c.sequencing.directionCorrectRate * 100)}%`} />
      </Section>
    </>
  );

  // Every measure, as on the original results page.
  const detailed = (
    <View style={styles.measures}>
      <MasteryMeasures report={report} />
    </View>
  );

  const diagnostic = (
    <>
      <Section title={t('mastery_screening_results')}>
        <View style={styles.riskBig}>
          <AppText size={14} weight="bold" color={DT.text.muted} style={styles.mb4}>
            {t('mastery_risk_level')}
          </AppText>
          <AppText size={36} weight="bold" color={RISK_COLOR[level]}>
            {t(`mastery_risk_${level}`)}
          </AppText>
        </View>
        <View style={styles.mt20}>
          <RiskBar label={t('mastery_risk_visual')} score={scores.visualSpatialRisk} />
          <RiskBar label={t('mastery_risk_motor')} score={scores.motorRisk} />
          <RiskBar label={t('mastery_risk_orientation')} score={scores.reversalRisk} />
        </View>
      </Section>
      <Section title={t('mastery_orientation_analysis')}>
        <Row label={t('mastery_m_mirror')} value={`${Math.round(c.orientation.mirrorConfusionScore * 100)}%`} subtitle={t('mastery_check_bd')} />
        <Row label={t('mastery_m_reversal')} value={report.ml.reversalType ? t(REVERSAL_TEXT[report.ml.reversalType]) : t('no')} color={report.ml.reversalType ? DT.accent.rose : undefined} />
      </Section>
      <View style={styles.disclaimer}>
        <AppText size={16} weight="bold" color={DT.text.error} style={styles.mb8}>
          {t('mastery_disclaimer_title')}
        </AppText>
        <AppText size={13} color={DT.text.primary}>
          {t('mastery_disclaimer_body')}
        </AppText>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
    <SafeAreaView edges={['top', 'bottom']} style={styles.flex}>
      {header}
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map(({ id: tabId, label }) => (
          <Pressable key={tabId} accessibilityRole="tab" accessibilityState={{ selected: tab === tabId }} onPress={() => setTab(tabId)} style={[styles.tab, tab === tabId && styles.tabActive]}>
            <AppText size={14} weight="bold" color={tab === tabId ? DT.accent.navy : DT.text.secondary}>
              {t(label)}
            </AppText>
          </Pressable>
        ))}
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'overview' ? overview : tab === 'detailed' ? detailed : diagnostic}
      </ScrollView>
      <View style={styles.actionBar}>
        <Pressable accessibilityRole="button" onPress={() => goBackOr('/parent')} style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}>
          <AppText size={16} weight="bold" color={DT.text.onDark}>
            {t('done')}
          </AppText>
        </Pressable>
      </View>
    </SafeAreaView>
      <BackButton placement="floating" fallback="/parent" />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText size={18} weight="bold" color={DT.text.primary} style={styles.sectionTitle}>
        {title}
      </AppText>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({ label, value, color, subtitle }: { label: string; value: string; color?: string; subtitle?: string }) {
  return (
    <View style={styles.row}>
      <AppText size={15} color={DT.text.secondary} style={styles.flex}>
        {label}
      </AppText>
      <View style={styles.rowValue}>
        <AppText size={16} weight="bold" color={color ?? DT.text.primary}>
          {value}
        </AppText>
        {subtitle ? (
          <AppText size={11} color={DT.text.muted}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function ScoreCard({ title, score }: { title: string; score: number }) {
  const color = score >= 80 ? DT.text.success : DT.accent.amber;
  return (
    <View style={styles.scoreCard} accessible accessibilityLabel={`${title}: ${Math.round(score)}%`}>
      <ProgressRing progress={score / 100} size={70} color={color} />
      <View style={styles.flex}>
        <AppText size={12} weight="bold" color={DT.text.muted}>
          {title}
        </AppText>
        <AppText size={18} weight="bold" color={color}>{`${Math.round(score)}%`}</AppText>
      </View>
    </View>
  );
}

function RiskBar({ label, score }: { label: string; score: number }) {
  return (
    <View style={styles.mb16} accessible accessibilityLabel={`${label}: ${Math.round(score)}%`}>
      <AppText size={14} weight="bold" color={DT.text.primary} style={styles.mb6}>
        {label}
      </AppText>
      <View style={styles.riskTrack}>
        <View style={[styles.riskFill, { width: `${Math.min(100, score)}%`, backgroundColor: score < 30 ? DT.text.success : DT.accent.amber }]} />
      </View>
      <AppText size={12} weight="bold" color={DT.text.secondary} style={styles.right}>{`${Math.round(score)}%`}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: DT.bg.cream },
  header: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 72, paddingVertical: 20, minHeight: 60 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, width: '100%', maxWidth: 760, alignSelf: 'center' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: DT.accent.navy },
  measures: { paddingHorizontal: 16 },
  scroll: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 16 },
  headerCard: { alignItems: 'center', paddingVertical: 24, backgroundColor: DT.surface.card, margin: 16, borderRadius: DT.radius.xl, ...DT.shadow.soft, borderWidth: 1, borderColor: DT.surface.cardBorder },
  letter: { marginBottom: 4, lineHeight: 96 },
  statusBadge: { backgroundColor: DT.bg.sage, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { marginBottom: 12, marginLeft: 4, letterSpacing: DT.typography.letterSpacingUI },
  sectionCard: { backgroundColor: DT.surface.card, borderRadius: DT.radius.lg, padding: 16, ...DT.shadow.soft, borderWidth: 1, borderColor: DT.surface.cardBorder },
  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  scoreCard: { flexBasis: '46%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: DT.bg.stone, padding: 12, borderRadius: DT.radius.md, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: DT.surface.divider },
  rowValue: { alignItems: 'flex-end' },
  riskBig: { alignItems: 'center', padding: 20, backgroundColor: DT.bg.stone, borderRadius: DT.radius.lg },
  riskTrack: { height: 10, backgroundColor: DT.bg.stone, borderRadius: 5, overflow: 'hidden', marginBottom: 4 },
  riskFill: { height: '100%', borderRadius: 5 },
  disclaimer: { margin: 16, padding: 16, backgroundColor: DT.bg.blush, borderRadius: DT.radius.lg, borderLeftWidth: 4, borderLeftColor: DT.text.error },
  actionBar: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: DT.surface.divider, width: '100%', maxWidth: 760, alignSelf: 'center' },
  retryBtn: { flex: 1, backgroundColor: DT.bg.lavender, paddingVertical: 16, borderRadius: DT.radius.lg, alignItems: 'center', borderWidth: 2, borderColor: DT.accent.indigo },
  doneBtn: { flex: 1, backgroundColor: DT.accent.navy, paddingVertical: 16, borderRadius: DT.radius.lg, alignItems: 'center', ...DT.shadow.medium },
  wide: { flex: 0, alignSelf: 'stretch' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  right: { textAlign: 'right' },
  mt20: { marginTop: 20 },
  mb4: { marginBottom: 4 },
  mb6: { marginBottom: 6 },
  mb8: { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
  mb32: { marginBottom: 32 },
  pressed: { opacity: 0.8 },
});
