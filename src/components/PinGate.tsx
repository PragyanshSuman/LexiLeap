import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useT } from '@/i18n';
import { PIN_LENGTH } from '@/services/pin';
import { useAppStore } from '@/store/appStore';
import { useParentSession } from '@/store/parentSession';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { PinPad } from '@/ui/PinPad';

const secondsUntil = (epochMs: number) => Math.max(0, Math.ceil((epochMs - Date.now()) / 1000));

/** Asks for the parent PIN. After 5 wrong tries, input pauses for 30 seconds. */
export function PinGate({ title, onSuccess }: { title: string; onSuccess: () => void }) {
  const { colors, space } = useTheme();
  const { t } = useT();
  const verify = useAppStore((s) => s.verifyParentPin);
  const { lockedOutUntil, registerFailure, unlock } = useParentSession();
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lockedFor, setLockedFor] = useState(0);

  // Count down while PIN entry is paused; the input re-enables itself at zero.
  useEffect(() => {
    const tick = () => setLockedFor(secondsUntil(lockedOutUntil));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [lockedOutUntil]);

  const onChange = async (next: string) => {
    setError(false);
    setValue(next);
    if (next.length !== PIN_LENGTH || checking || secondsUntil(useParentSession.getState().lockedOutUntil) > 0) return;
    setChecking(true);
    const ok = await verify(next);
    setChecking(false);
    if (ok) {
      unlock();
      onSuccess();
    } else {
      registerFailure();
      setError(true);
      setValue('');
    }
  };

  return (
    <View style={{ gap: space(5), alignItems: 'center' }}>
      <View style={{ gap: space(1) }}>
        <AppText variant="heading" center>
          {title}
        </AppText>
        <AppText variant="caption" center muted accessibilityLiveRegion="polite" color={error || lockedFor > 0 ? colors.danger : undefined}>
          {lockedFor > 0 ? t('pin_locked', { n: lockedFor }) : error ? t('pin_wrong') : t('pin_enter')}
        </AppText>
      </View>
      <PinPad value={value} onChange={onChange} disabled={lockedFor > 0 || checking} error={error} />
    </View>
  );
}
