import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PinGate } from '@/components/PinGate';
import { isOverLimit } from '@/engine/progress';
import { useT } from '@/i18n';
import { dayKey } from '@/lib/date';
import { useActiveProfile, useAppStore, useProgress } from '@/store/appStore';
import { useParentSession } from '@/store/parentSession';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

const BONUS_MINUTES = 15;

/** Shown when today's screen-time limit is reached. Only a parent can add more time. */
export default function Break() {
  const { space } = useTheme();
  const { t } = useT();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const grantBonusMinutes = useAppStore((s) => s.grantBonusMinutes);
  const lock = useParentSession((s) => s.lock);
  const [askingParent, setAskingParent] = useState(false);

  if (!profile) return <Redirect href="/login" />;
  // Arrived here by mistake (limit raised, new day): go back to learning.
  if (!isOverLimit(profile.prefs.dailyLimitMin, progress, dayKey())) return <Redirect href="/home" />;

  if (askingParent) {
    return (
      <Screen scroll>
        <View style={{ marginTop: space(10) }}>
          <PinGate
            title={t('break_add_time_title', { n: BONUS_MINUTES, name: profile.name })}
            onSuccess={() => {
              grantBonusMinutes(profile.id, BONUS_MINUTES);
              // Adding time shouldn't leave the parent zone unlocked on the child's device.
              lock();
              router.replace('/home');
            }}
          />
        </View>
        <Button label={t('cancel')} icon="close" variant="ghost" onPress={() => setAskingParent(false)} style={{ marginTop: space(4) }} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={{ gap: space(3) }}>
          <Button label={t('break_switch')} icon="people" variant="secondary" onPress={() => router.replace('/login')} />
          <Button label={t('break_add_time')} icon="lock-closed" variant="ghost" onPress={() => setAskingParent(true)} />
        </View>
      }
    >
      <View style={[styles.center, { gap: space(4) }]}>
        <AppText size={88} style={{ lineHeight: 104 }}>
          🌙
        </AppText>
        <AppText variant="title" center accessibilityRole="header">
          {t('break_screen_title', { name: profile.name })}
        </AppText>
        <AppText center muted>
          {t('break_screen_body')}
        </AppText>
        <AppText variant="heading" center>
          ⭐ {t('stars_count', { n: progress.stars })}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
