import { useState } from 'react';
import { View } from 'react-native';
import { useT } from '@/i18n';
import { isWeakPin, PIN_LENGTH } from '@/services/pin';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { PinPad } from '@/ui/PinPad';

/** Two-step "choose a PIN, then type it again" flow. */
export function PinSetup({ onDone }: { onDone: (pin: string) => void }) {
  const { colors, space } = useTheme();
  const { t } = useT();
  const [first, setFirst] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onChange = (next: string) => {
    if (next.length !== PIN_LENGTH) {
      setValue(next);
      return;
    }
    setValue('');
    if (first === null) {
      if (isWeakPin(next)) {
        setError(t('pin_weak'));
      } else {
        setFirst(next);
        setError(null);
      }
    } else if (next === first) {
      onDone(next);
    } else {
      setError(t('pin_mismatch'));
      setFirst(null);
    }
  };

  return (
    <View style={{ gap: space(5), alignItems: 'center' }}>
      <View style={{ gap: space(1) }}>
        <AppText variant="heading" center>
          {first === null ? t('pin_choose') : t('pin_again')}
        </AppText>
        <AppText variant="caption" muted center accessibilityLiveRegion="polite" color={error ? colors.danger : undefined}>
          {error ?? t('pin_hint')}
        </AppText>
      </View>
      <PinPad value={value} onChange={onChange} error={!!error && value.length === 0} />
    </View>
  );
}
