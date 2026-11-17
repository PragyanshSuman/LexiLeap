import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { PinGate } from '@/components/PinGate';
import { useAppStore } from '@/store/appStore';
import { useT } from '@/i18n';
import { ThemeScope, useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';

export default function ParentGate() {
  return (
    <ThemeScope>
      <GateContent />
    </ThemeScope>
  );
}

function GateContent() {
  const { space } = useTheme();
  const { t } = useT();
  const hasParent = useAppStore((s) => s.parent !== null);
  const { next } = useLocalSearchParams<{ next?: string }>();
  // Only ever continue into the parent zone.
  const target = typeof next === 'string' && next.startsWith('/parent/') && !next.includes('//') ? next : '/parent';
  if (!hasParent) return <Redirect href="/welcome" />;
  return (
    <Screen scroll header={<Header title={t('parent_zone')} />}>
      <View style={{ marginTop: space(6) }}>
        <PinGate title={t('pin_grownups_only')} onSuccess={() => router.replace(target as never)} />
      </View>
      <Button label={t('forgot_pin')} variant="ghost" compact onPress={() => router.push('/forgot-pin')} style={{ marginTop: space(6) }} />
    </Screen>
  );
}
