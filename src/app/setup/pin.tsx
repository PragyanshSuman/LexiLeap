import { Redirect } from 'expo-router';
import { useCallback } from 'react';
import { PinSetup } from '@/components/PinSetup';
import { useAppStore } from '@/store/appStore';
import { useParentSession } from '@/store/parentSession';
import { useT } from '@/i18n';
import { ThemeScope } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';

export default function SetupPin() {
  const hasParent = useAppStore((s) => s.parent !== null);
  const setParentPin = useAppStore((s) => s.setParentPin);
  const unlock = useParentSession((s) => s.unlock);
  const { t } = useT();

  const done = useCallback(
    async (pin: string) => {
      await setParentPin(pin);
      unlock();
      // Saving the PIN re-renders this screen, and the redirect below moves on to step 2.
    },
    [setParentPin, unlock],
  );

  if (hasParent) return <Redirect href="/register" />;
  return (
    <ThemeScope>
      <Screen scroll header={<Header title={t('setup_step1')} subtitle={t('setup_parent_pin')} />}>
        <AppText muted center style={{ marginVertical: 16 }}>
          {t('setup_pin_intro')}
        </AppText>
        <PinSetup onDone={done} />
      </Screen>
    </ThemeScope>
  );
}
