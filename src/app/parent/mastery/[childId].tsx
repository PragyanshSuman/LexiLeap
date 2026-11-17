import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '@/ui/BackButton';
import { useT, type TranslationKey } from '@/i18n';
import { useProfile, useProgress } from '@/store/appStore';
import { DT } from '@/theme/dyslexiaTheme';
import { shareMasteryReport } from '@/services/report';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { StatusPie, TrendChart } from '@/writing/Charts';
import { ALPHABET } from '@/writing/letterPaths';
import { summarizeMastery } from '@/writing/mastery';

type Tab = 'overview' | 'details' | 'risk';
const TABS: { id: Tab; label: TranslationKey }[] = [
  { id: 'overview', label: 'mastery_tab_overview' },
  { id: 'details', label: 'mastery_tab_details' },
  { id: 'risk', label: 'mastery_tab_risk' },
];
const RISK_COLOR = { low: DT.text.success, moderate: DT.accent.amber, high: DT.text.error } as const;
const CONTENT_MAX = 760;

/** The original Progress Dashboard for Letter Mastery, for grown-ups (parent zone, behind the PIN). */
export default function MasteryDashboard() {
  const { t, language } = useT();
  const { width } = useWindowDimensions();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const profile = useProfile(childId);
  const progress = useProgress(childId);
  const [tab, setTab] = useState<Tab>('overview');
  const [sharing, setSharing] = useState(false);
  if (!profile) return <Redirect href="/parent" />;

  const reports = progress.mastery ?? [];
  const summary = summarizeMastery(reports, ALPHABET);
  const chartWidth = Math.min(width, CONTENT_MAX) - 72;
  const dateLocale = language === 'en' ? undefined : `${language}-IN`;
  const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });

  const overview = () => {
    const mastered = summary.mastered.length;
    const struggling = summary.struggling.length;
    return (
      <View>
        <Section title={t('mastery_overall')}>
          <View style={styles.card}>
            <View style={styles.progressRow}>
              <View style={styles.progressCircle}>
                <AppText size={20} weight="bold" fixed color={DT.text.primary}>{`${Math.round((mastered / ALPHABET.length) * 100)}%`}</AppText>
              </View>
              <View style={styles.flex}>
                <AppText size={16} weight="bold" color={DT.text.primary}>
                  {t('mastery_mastered_count', { n: mastered, total: ALPHABET.length })}
                </AppText>
                <AppText size={14} color={DT.text.secondary} style={styles.mt4}>
                  {t('mastery_practice_count', { n: struggling })}
                </AppText>
              </View>
            </View>
          </View>
        </Section>

        <Section title={t('mastery_key_metrics')}>
          <View style={styles.metricsGrid}>
            <MetricCard title={t('mastery_sessions')} value={String(summary.totalSessions)} color={DT.accent.navy} />
            <MetricCard title={t('mastery_avg_accuracy')} value={`${summary.averageAccuracy}%`} color={DT.text.success} />
            <MetricCard title={t('mastery_avg_duration')} value={`${summary.averageDurationSec}s`} color={DT.accent.sky} />
            <MetricCard title={t('mastery_risk_level')} value={reports.length ? t(`mastery_risk_${summary.risk.level}`) : '—'} color={DT.accent.teal} />
          </View>
        </Section>

        <Section title={t('mastery_accuracy_trend')}>
          <View style={styles.chartCard}>
            {summary.trend.length > 0 ? (
              <TrendChart
                points={summary.trend.map((p) => ({ label: shortDate(p.day), value: p.accuracy }))}
                width={chartWidth}
                accessibilityLabel={summary.trend.map((p) => `${shortDate(p.day)}: ${p.accuracy}%`).join(', ')}
              />
            ) : (
              <AppText color={DT.text.secondary} center style={styles.empty}>
                {t('mastery_no_sessions')}
              </AppText>
            )}
          </View>
        </Section>

        <Section title={t('mastery_letter_status')}>
          <View style={styles.chartCard}>
            <StatusPie
              width={chartWidth}
              slices={[
                { name: t('mastery_status_mastered'), count: mastered, color: DT.text.success },
                { name: t('mastery_status_learning'), count: ALPHABET.length - mastered - struggling, color: DT.accent.amber },
                { name: t('mastery_status_struggling'), count: struggling, color: DT.text.error },
              ]}
            />
          </View>
        </Section>
      </View>
    );
  };

  const details = () => (
    <Section title={t('mastery_history')}>
      {reports.length === 0 ? (
        <AppText color={DT.text.secondary}>{t('mastery_no_sessions')}</AppText>
      ) : (
        [...reports].reverse().map((r) => (
          <Pressable
            key={r.sessionId}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/parent/mastery/session/[id]', params: { id: r.sessionId, childId: profile.id } })}
            style={({ pressed }) => [styles.sessionCard, pressed && styles.pressed]}
          >
            <View style={styles.sessionHeader}>
              <AppText size={32} weight="bold" fixed color={DT.accent.navy}>
                {r.letter}
              </AppText>
              <AppText size={14} color={DT.text.muted}>
                {new Date(r.timestamp).toLocaleDateString(dateLocale)}
              </AppText>
            </View>
            <View style={styles.sessionMetrics}>
              <View style={styles.center}>
                <AppText size={12} color={DT.text.muted}>
                  {t('mastery_accuracy')}
                </AppText>
                <AppText size={16} weight="bold" color={DT.text.success}>{`${Math.round(r.overview.score)}%`}</AppText>
              </View>
              <View style={styles.center}>
                <AppText size={12} color={DT.text.muted}>
                  {t('mastery_duration')}
                </AppText>
                <AppText size={16} weight="bold" color={DT.text.primary}>{`${Math.round(r.overview.completionTime / 1000)}s`}</AppText>
              </View>
            </View>
          </Pressable>
        ))
      )}
    </Section>
  );

  const risk = () => (
    <Section title={t('mastery_screening')} subtitle={t('mastery_screening_sub')}>
      <View style={styles.card}>
        <AppText size={16} color={DT.text.secondary} center style={styles.mb4}>
          {t('mastery_overall_risk')}
        </AppText>
        <AppText size={32} weight="bold" center color={reports.length ? RISK_COLOR[summary.risk.level] : DT.text.muted}>
          {reports.length ? t(`mastery_risk_${summary.risk.level}`) : '—'}
        </AppText>
      </View>
      <View style={styles.riskGrid}>
        <RiskMetric label={t('mastery_risk_visual')} value={summary.risk.visualSpatial} />
        <RiskMetric label={t('mastery_risk_motor')} value={summary.risk.motor} />
        <RiskMetric label={t('mastery_risk_orientation')} value={summary.risk.orientation} />
      </View>
      <View style={styles.infoBox}>
        <AppText size={14} color={DT.text.primary}>
          {t('mastery_disclaimer')}
        </AppText>
      </View>
    </Section>
  );

  return (
    <View style={styles.container}>
    <SafeAreaView edges={['top', 'bottom']} style={styles.flex}>
      <View style={styles.topNav}>
        <AppText size={20} weight="bold" color={DT.text.primary} accessibilityRole="header">
          {t('mastery_dashboard_title')}
        </AppText>
        <AppText size={14} color={DT.text.secondary}>{`${profile.avatar} ${profile.name}`}</AppText>
        <Button
          label={t('mastery_share_pdf')}
          icon="document-text"
          compact
          variant="secondary"
          color={DT.accent.navy}
          loading={sharing}
          disabled={reports.length === 0}
          style={styles.pdf}
          onPress={async () => {
            setSharing(true);
            try {
              await shareMasteryReport(profile, reports);
            } catch (e) {
              Alert.alert(t('mastery_share_pdf'), e instanceof Error ? e.message : t('something_wrong'));
            } finally {
              setSharing(false);
            }
          }}
        />
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map(({ id, label }) => (
          <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabActive]}>
            <AppText size={15} weight="bold" color={tab === id ? DT.accent.navy : DT.text.secondary}>
              {t(label)}
            </AppText>
          </Pressable>
        ))}
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        {tab === 'overview' ? overview() : tab === 'details' ? details() : risk()}
      </ScrollView>
    </SafeAreaView>
      <BackButton placement="floating" fallback="/parent" />
    </View>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText size={18} weight="bold" color={DT.text.primary} style={styles.sectionTitle}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText size={14} color={DT.text.secondary} style={styles.sectionSubtitle}>
          {subtitle}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

function MetricCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <View style={[styles.metricCard, { borderLeftColor: color }]}>
      <AppText size={12} weight="bold" color={DT.text.muted}>
        {title}
      </AppText>
      <AppText size={24} weight="bold" color={color} style={styles.mt4}>
        {value}
      </AppText>
    </View>
  );
}

function RiskMetric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.riskCard} accessible accessibilityLabel={`${label}: ${value}%`}>
      <AppText size={14} weight="bold" color={DT.text.primary} style={styles.mb8}>
        {label}
      </AppText>
      <View style={styles.riskBar}>
        <View style={[styles.riskFill, { width: `${Math.min(100, value)}%`, backgroundColor: value < 30 ? DT.text.success : DT.accent.amber }]} />
      </View>
      <AppText size={14} weight="bold" color={DT.text.secondary} style={styles.right}>{`${Math.round(value)}%`}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: DT.bg.cream },
  topNav: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 72, paddingVertical: 20, minHeight: 60, gap: 4 },
  pdf: { marginTop: 8 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: DT.accent.navy },
  scroll: { paddingBottom: 40, width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center' },
  section: { paddingHorizontal: 20, paddingBottom: 24 },
  sectionTitle: { marginBottom: 12, letterSpacing: DT.typography.letterSpacingUI },
  sectionSubtitle: { marginBottom: 16 },
  card: { backgroundColor: DT.surface.card, borderRadius: DT.radius.lg, padding: 20, ...DT.shadow.soft, borderWidth: 1, borderColor: DT.surface.cardBorder },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  progressCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: DT.bg.sage, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: DT.text.success },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { flexBasis: '47%', flexGrow: 1, backgroundColor: DT.surface.card, padding: 16, borderRadius: DT.radius.md, ...DT.shadow.soft, borderWidth: 1, borderColor: DT.surface.cardBorder, borderLeftWidth: 4 },
  chartCard: { backgroundColor: DT.surface.card, borderRadius: DT.radius.lg, padding: 16, alignItems: 'center', ...DT.shadow.soft, borderWidth: 1, borderColor: DT.surface.cardBorder },
  empty: { paddingVertical: 24 },
  sessionCard: { backgroundColor: DT.surface.card, borderRadius: DT.radius.md, padding: 16, marginBottom: 12, ...DT.shadow.soft, borderWidth: 1, borderColor: DT.surface.cardBorder },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sessionMetrics: { flexDirection: 'row', justifyContent: 'space-around' },
  center: { alignItems: 'center' },
  riskGrid: { gap: 12, marginTop: 12 },
  riskCard: { backgroundColor: DT.surface.card, padding: 16, borderRadius: DT.radius.md, ...DT.shadow.soft },
  riskBar: { height: 8, backgroundColor: DT.bg.stone, borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  riskFill: { height: '100%', borderRadius: 4 },
  infoBox: { marginTop: 20, padding: 16, backgroundColor: DT.bg.sage, borderRadius: DT.radius.md },
  right: { textAlign: 'right' },
  mt4: { marginTop: 4 },
  mb4: { marginBottom: 4 },
  mb8: { marginBottom: 8 },
  pressed: { opacity: 0.8 },
});
