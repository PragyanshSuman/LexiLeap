import { router, type ErrorBoundaryProps } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';

/**
 * Shown instead of a screen that crashed, so a child never sees a developer error page: a calm
 * message, the reassurance that progress is saved, and two ways out. Details only in development.
 */
export function FriendlyError({ error, retry }: ErrorBoundaryProps) {
  const { t } = useT();
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.body}>
        <AppText size={72} fixed center accessibilityElementsHidden>
          🐢
        </AppText>
        <AppText variant="title" center accessibilityRole="header">
          {t('error_title')}
        </AppText>
        <AppText center muted>
          {t('error_body')}
        </AppText>
        {__DEV__ ? (
          <AppText variant="caption" muted selectable>
            {error.message}
          </AppText>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Button
          label={t('error_home')}
          icon="home"
          variant="secondary"
          style={styles.flex}
          onPress={() => {
            router.replace('/');
            void retry();
          }}
        />
        <Button label={t('error_retry')} icon="refresh" style={styles.flex} onPress={() => void retry()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, justifyContent: 'space-between' },
  body: { flex: 1, justifyContent: 'center', gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center' },
  actions: { flexDirection: 'row', gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
});
