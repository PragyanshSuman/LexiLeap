import { StyleSheet, View } from 'react-native';
import { summarizeResults } from '@/engine/assessment';
import { summarizeSpelling, type SpellingFlag } from '@/engine/spelling';
import type { Assessment, SpeechAssessment, SpellingAssessment, SpellingError } from '@/engine/types';
import { useT, type TranslationKey } from '@/i18n';
import { soundOf } from '@/speech/phonemes';
import { accentOn } from '@/theme/color';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { StatTile } from '@/ui/Feedback';

/** The Clinical Tools' colours (their tiles on Home). */
export const ASSESSMENT_ACCENT = { speech: '#1E3A5F', spelling: '#5B21B6' } as const;

const FLAG_KEY: Record<SpellingFlag, TranslationKey> = {
  'on-track': 'spell_flag_on_track',
  monitor: 'spell_flag_monitor',
  'high-risk': 'spell_flag_high_risk',
};
const ERROR_ORDER: SpellingError[] = ['reversal', 'transposition', 'omission', 'insertion', 'substitution', 'blank'];

/** A Speech Test or Write Test result, for grown-ups (parent zone). */
export function AssessmentResults({ assessment }: { assessment: Assessment }) {
  return assessment.kind === 'speech' ? <SpeechResults assessment={assessment} /> : <SpellingResults assessment={assessment} />;
}

function SpeechResults({ assessment }: { assessment: SpeechAssessment }) {
  const { t } = useT();
  const { colors } = useTheme();
  const accent = ASSESSMENT_ACCENT.speech;
  const summary = summarizeResults(assessment.items);
  return (
    <View>
      <View style={styles.center}>
        <AppText variant="heading" center color={accentOn(accent, colors.surface)}>
          {t('assess_words', { a: summary.wordsRight, b: summary.wordsTotal })}
        </AppText>
      </View>
      {summary.soundAccuracy !== null ? (
        <View style={styles.stats}>
          <StatTile label={t('journey_stat_phonics')} value={`${Math.round(summary.soundAccuracy * 100)}%`} color={accent} />
        </View>
      ) : null}
      <Card style={styles.block}>
        <AppText variant="label" weight="bold">
          {t('assess_tricky')}
        </AppText>
        {summary.trickySounds.length === 0 ? (
          <AppText muted>{t('assess_none')}</AppText>
        ) : (
          <View style={styles.chips}>
            {summary.trickySounds.slice(0, 8).map(({ phoneme, count }) => (
              <View key={phoneme} style={[styles.chip, { borderColor: colors.warning, backgroundColor: colors.warningSoft }]}>
                <AppText variant="heading" weight="bold" color={colors.warning} fixed>
                  {soundOf(phoneme).sound}
                </AppText>
                <AppText size={12} fixed muted>
                  {`${soundOf(phoneme).example} · ×${count}`}
                </AppText>
              </View>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}

function SpellingResults({ assessment }: { assessment: SpellingAssessment }) {
  const { t } = useT();
  const { colors } = useTheme();
  const accent = ASSESSMENT_ACCENT.spelling;
  const summary = summarizeSpelling(assessment.items);
  const patterns = ERROR_ORDER.filter((e) => summary.errorCounts[e] > 0);
  const flagColour: Record<SpellingFlag, string> = { 'on-track': colors.success, monitor: colors.primary, 'high-risk': colors.warning };
  return (
    <View>
      <View style={styles.center}>
        <AppText variant="heading" center color={accentOn(accent, colors.surface)}>
          {t('assess_words', { a: summary.wordsRight, b: summary.wordsTotal })}
        </AppText>
        <AppText variant="label" center muted>
          {t('spell_accuracy', { n: Math.round(summary.accuracy * 100) })}
        </AppText>
        <View style={[styles.flag, { borderColor: flagColour[summary.flag] }]}>
          <AppText variant="label" weight="bold" color={flagColour[summary.flag]}>
            {t(FLAG_KEY[summary.flag])}
          </AppText>
        </View>
      </View>
      <Card style={styles.block}>
        <AppText variant="label" weight="bold">
          {t('spell_patterns')}
        </AppText>
        {patterns.length === 0 ? (
          <AppText muted>{t('spell_no_errors')}</AppText>
        ) : (
          patterns.map((e) => (
            <View key={e} style={styles.patternRow}>
              <AppText muted>{t(`spell_err_${e}`)}</AppText>
              <AppText weight="bold">{`×${summary.errorCounts[e]}`}</AppText>
            </View>
          ))
        )}
      </Card>
      <Card style={styles.block}>
        {assessment.items.map((item) => (
          <View key={item.word} style={styles.patternRow}>
            <AppText weight="bold">{item.word}</AppText>
            <AppText muted>{item.written || '—'}</AppText>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  stats: { flexDirection: 'row', gap: 10 },
  block: { gap: 10, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { alignItems: 'center', minWidth: 72, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 2 },
  flag: { borderWidth: 2, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 4 },
  patternRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
