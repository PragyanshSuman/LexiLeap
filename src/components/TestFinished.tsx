import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { PopIn } from '@/ui/motion';
import { Screen } from '@/ui/Screen';

/**
 * The end of a Speech Test or Write Test, as the child sees it: praise for the effort and no scores.
 * The results and the PDF report are in the parent zone.
 */
export function TestFinished({ title, color, overlay }: { title: string; color: string; overlay?: ReactNode }) {
  const { t } = useT();
  const feedback = useFeedback();
  useEffect(() => {
    feedback.correct();
    feedback.say(['test_done_title', 'test_done_body']);
    // Once, when the test ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Screen
      header={<Header title={title} onBack={null} />}
      footer={<Button label={t('done')} icon="home" color={color} onPress={() => router.dismissTo('/home')} />}
      overlay={overlay}
    >
      <View style={styles.center}>
        <PopIn>
          <AppText size={80} fixed center accessibilityElementsHidden>
            🏅
          </AppText>
        </PopIn>
        <AppText variant="title" center accessibilityRole="header">
          {t('test_done_title')}
        </AppText>
        <AppText center muted>
          {t('test_done_body')}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
});
