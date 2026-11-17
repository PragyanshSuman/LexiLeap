import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { AssessmentResults, ASSESSMENT_ACCENT } from '@/components/AssessmentResults';
import { useT } from '@/i18n';
import { shareAssessmentReport } from '@/services/report';
import { useProfile, useProgress } from '@/store/appStore';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { goBackOr, Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';

/** A Speech Test or Write Test result, for grown-ups (parent zone, behind the PIN), with its PDF report. */
export default function AssessmentResult() {
  const { id, childId } = useLocalSearchParams<{ id: string; childId: string }>();
  const { t } = useT();
  const profile = useProfile(childId);
  const progress = useProgress(childId);
  const [sharing, setSharing] = useState(false);
  if (!profile) return <Redirect href="/parent" />;
  const assessment = progress.assessments.find((a) => a.id === id);
  const title = assessment?.kind === 'spelling' ? t('spell_title') : t('assess_title');

  return (
    <Screen
      scroll
      header={<Header title={title} subtitle={`${profile.avatar} ${profile.name}${assessment ? ` · ${new Date(assessment.takenAt).toLocaleDateString()}` : ''}`} onBack={() => goBackOr('/parent')} />}
      footer={
        assessment ? (
          <View style={styles.row}>
            <Button label={t('done')} icon="checkmark" variant="secondary" color={ASSESSMENT_ACCENT[assessment.kind]} onPress={() => goBackOr('/parent')} style={styles.flex} />
            <Button
              label={t('assess_share')}
              icon="document-text"
              color={ASSESSMENT_ACCENT[assessment.kind]}
              loading={sharing}
              style={styles.flex}
              onPress={async () => {
                setSharing(true);
                try {
                  await shareAssessmentReport(profile, assessment);
                } catch (e) {
                  Alert.alert(title, e instanceof Error ? e.message : t('something_wrong'));
                } finally {
                  setSharing(false);
                }
              }}
            />
          </View>
        ) : null
      }
    >
      {assessment ? <AssessmentResults assessment={assessment} /> : <AppText muted>{t('mastery_no_report')}</AppText>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
});
