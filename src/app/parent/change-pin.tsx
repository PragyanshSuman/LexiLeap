import { router } from 'expo-router';
import { useCallback } from 'react';
import { Alert, View } from 'react-native';
import { PinSetup } from '@/components/PinSetup';
import { useAppStore } from '@/store/appStore';
import { useTheme } from '@/theme/useTheme';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';

export default function ChangePin() {
  const { space } = useTheme();
  const setParentPin = useAppStore((s) => s.setParentPin);
  const done = useCallback(
    async (pin: string) => {
      await setParentPin(pin);
      Alert.alert('PIN changed', 'Use your new PIN next time you open the parent zone.');
      router.back();
    },
    [setParentPin],
  );
  return (
    <Screen scroll header={<Header title="Change PIN" />}>
      <View style={{ marginTop: space(4) }}>
        <PinSetup onDone={done} />
      </View>
    </Screen>
  );
}
