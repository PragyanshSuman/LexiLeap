import { StyleSheet, View } from 'react-native';
import { useT, type TranslationKey } from '@/i18n';
import { DT } from '@/theme/dyslexiaTheme';
import { AppText } from '@/ui/AppText';
import type { SessionFeatureSummary } from './types';

/**
 * Every measure from one letter written in Letter Mastery, laid out like the original results page:
 * accuracy and completeness, then motion, smoothness, mechanics, shape, sequencing, orientation and
 * the handwriting model's readings. For grown-ups and clinicians (shown in the parent zone only).
 */
export function MasteryMeasures({ report }: { report: SessionFeatureSummary }) {
  const { t } = useT();
  const c = report.clinical;
  const ml = report.ml;
  const fixed = (n: number, digits: number) => (Number.isFinite(n) ? n.toFixed(digits) : '0');
  const pct = (n: number) => `${Math.round((Number.isFinite(n) ? n : 0) * 100)}%`;
  const speed = (v: number) => `${fixed(v * 1000, 1)} px/s`;
  const sections: { title: TranslationKey; subtitle: TranslationKey; rows: [TranslationKey, string, string?][] }[] = [
    {
      title: 'mastery_sec_feedback',
      subtitle: 'mastery_sec_feedback_sub',
      rows: [
        ['mastery_m_speed', speed(c.kinematics.avgVelocity)],
        ['mastery_m_fluency', pct(c.kinematics.fluencyRatio)],
        ['mastery_m_tremor', fixed(c.graphomotor.tremorAmplitude, 2)],
        ['mastery_m_pressure', fixed(c.graphomotor.avgPressure, 2)],
        ['mastery_m_time', `${fixed(report.overview.completionTime / 1000, 1)} s`],
      ],
    },
    {
      title: 'mastery_sec_kinematics',
      subtitle: 'mastery_sec_kinematics_sub',
      rows: [
        ['mastery_m_mean_velocity', speed(c.kinematics.avgVelocity)],
        ['mastery_m_peak_velocity', speed(c.kinematics.peakVelocity)],
        ['mastery_m_speed_consistency', fixed(c.kinematics.velocityCoV, 2)],
        ['mastery_m_fluency_ratio', pct(c.kinematics.fluencyRatio)],
        ['mastery_m_velocity_peaks', String(c.kinematics.velocityPeaks)],
        ['mastery_m_hesitations', String(c.kinematics.velocityValleys)],
        ['mastery_m_time_in_motion', `${fixed(c.kinematics.timeInMotion / 1000, 1)} s`],
      ],
    },
    {
      title: 'mastery_sec_dynamics',
      subtitle: 'mastery_sec_dynamics_sub',
      rows: [
        ['mastery_m_avg_jerk', fixed(c.dynamics.avgJerk, 3)],
        ['mastery_m_norm_jerk', fixed(c.dynamics.normalizedJerk, 3)],
        ['mastery_m_max_accel', fixed(c.dynamics.maxAcceleration, 2)],
        ['mastery_m_accel_symmetry', fixed(c.dynamics.accelerationSymmetry, 2)],
        ['mastery_m_ballistic', String(c.dynamics.ballisticMovements)],
      ],
    },
    {
      title: 'mastery_sec_graphomotor',
      subtitle: 'mastery_sec_graphomotor_sub',
      rows: [
        ['mastery_m_tremor_amp', fixed(c.graphomotor.tremorAmplitude, 2)],
        ['mastery_m_tremor_freq', `${fixed(c.graphomotor.tremorFrequency, 2)} Hz`],
        ['mastery_m_tremor_power', fixed(c.graphomotor.tremorPower, 2)],
        ['mastery_m_avg_pressure', fixed(c.graphomotor.avgPressure, 2)],
        ['mastery_m_pressure_var', fixed(c.graphomotor.pressureVariance, 3)],
      ],
    },
    {
      title: 'mastery_sec_shape',
      subtitle: 'mastery_sec_shape_sub',
      rows: [
        ['mastery_m_path_dev', `${fixed(c.shape.mean_path_deviation, 1)} px`],
        ['mastery_m_off_track', String(c.shape.offTrackEvents)],
        ['mastery_m_aspect', fixed(c.shape.aspect_ratio, 2)],
        ['mastery_m_compactness', fixed(c.shape.compactness_score, 2)],
        ['mastery_m_closure', pct(c.shape.closure_success_rate)],
        ['mastery_m_drift', `${fixed(c.shape.spatialDrift, 1)} px`],
      ],
    },
    {
      title: 'mastery_sec_sequencing',
      subtitle: 'mastery_sec_sequencing_sub',
      rows: [
        ['mastery_m_strokes', t('mastery_strokes_value', { n: c.sequencing.strokeCountActual, expected: c.sequencing.strokeCountExpected })],
        ['mastery_m_extra', String(c.sequencing.extraStrokes)],
        ['mastery_m_liftoff', String(c.sequencing.liftOffCount)],
        ['mastery_m_latency', `${fixed(c.sequencing.avgInterStrokeLatency, 0)} ms`],
        ['mastery_m_direction', pct(c.sequencing.directionCorrectRate)],
      ],
    },
    {
      title: 'mastery_sec_orientation',
      subtitle: 'mastery_sec_orientation_sub',
      rows: [
        ['mastery_m_reversal', t(c.orientation.reversalDetected ? 'yes' : 'no'), c.orientation.reversalDetected ? DT.accent.rose : undefined],
        ['mastery_m_mirror', pct(c.orientation.mirrorConfusionScore)],
        ['mastery_m_micropauses', String(c.orientation.micropauseCount)],
      ],
    },
  ];
  const guessLabels: TranslationKey[] = ['mastery_ml_first', 'mastery_ml_second', 'mastery_ml_third'];

  return (
    <View style={styles.root}>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <AppText size={14} weight="bold" color={DT.text.muted} center style={styles.statLabel}>
            {t('mastery_accuracy')}
          </AppText>
          <AppText size={32} weight="bold" color={DT.text.success} center fixed>
            {`${Math.round(report.overview.score)}%`}
          </AppText>
        </View>
        <View style={styles.statBox}>
          <AppText size={14} weight="bold" color={DT.text.muted} center style={styles.statLabel}>
            {t('mastery_completeness')}
          </AppText>
          <AppText size={32} weight="bold" color={DT.accent.sky} center fixed>
            {pct(c.dataQuality.completenessScore)}
          </AppText>
        </View>
      </View>

      {sections.map((section, i) => (
        <View key={section.title} style={styles.detailedMetrics}>
          <AppText size={22} weight="bold" color={DT.text.primary}>
            {i === 0 ? t(section.title) : `${i}. ${t(section.title)}`}
          </AppText>
          <AppText size={15} color={DT.text.secondary} style={styles.reportSubtitle}>
            {t(section.subtitle, { letter: report.letter })}
          </AppText>
          {section.rows.map(([label, value, color]) => (
            <View key={label} style={styles.detailRow}>
              <AppText size={16} color={DT.text.secondary} style={styles.flex}>
                {t(label)}
              </AppText>
              <AppText size={16} weight="bold" color={color ?? DT.text.primary}>
                {value}
              </AppText>
            </View>
          ))}
        </View>
      ))}

      <View style={styles.detailedMetrics}>
        <AppText size={22} weight="bold" color={DT.text.primary}>
          {`7. ${t('mastery_sec_ml')}`}
        </AppText>
        <AppText size={15} color={DT.text.secondary} style={styles.reportSubtitle}>
          {t('mastery_sec_ml_sub')}
        </AppText>
        {ml.topPredictions.length === 0 ? (
          <AppText color={DT.text.secondary}>{t('write_model_error')}</AppText>
        ) : (
          ml.topPredictions.map((p, i) => (
            <View key={`${p.char}-${i}`} style={styles.detailRow}>
              <AppText size={16} color={DT.text.secondary} style={styles.flex}>
                {`${t(guessLabels[i])} - "${p.char}"`}
              </AppText>
              <AppText size={16} weight="bold" color={i === 0 ? DT.accent.sky : DT.text.primary}>
                {t('mastery_ml_match', { n: (p.score * 100).toFixed(1) })}
              </AppText>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  flex: { flex: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'center', width: '100%', gap: 16, marginBottom: 24 },
  statBox: { flex: 1, backgroundColor: DT.surface.card, borderRadius: DT.radius.xl, padding: 20, alignItems: 'center', ...DT.shadow.soft, borderWidth: 1, borderColor: DT.surface.cardBorder },
  statLabel: { marginBottom: 8 },
  detailedMetrics: { backgroundColor: DT.surface.card, borderRadius: DT.radius.xl, padding: 24, width: '100%', marginBottom: 24, ...DT.shadow.soft, borderWidth: 1, borderColor: DT.surface.cardBorder },
  reportSubtitle: { marginTop: 4, marginBottom: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: DT.surface.divider },
});
