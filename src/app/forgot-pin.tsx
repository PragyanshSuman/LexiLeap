import { Redirect, router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { PinSetup } from '@/components/PinSetup';
import { useAppStore } from '@/store/appStore';
import { useParentSession } from '@/store/parentSession';
import { ThemeScope, useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

function newChallenge() {
  const a = 6 + Math.floor(Math.random() * 4);
  const b = 6 + Math.floor(Math.random() * 4);
  return { a, b };
}

/**
 * Resetting the PIN uses an "adult check": a multiplication written in words.
 * Young children can't easily read and solve it, while adults can in seconds.
 */
export default function ForgotPin() {
  return (
    <ThemeScope>
      <ForgotPinContent />
    </ThemeScope>
  );
}

function ForgotPinContent() {
  const { colors, space, radius, font } = useTheme();
  const hasParent = useAppStore((s) => s.parent !== null);
  const setParentPin = useAppStore((s) => s.setParentPin);
  const unlock = useParentSession((s) => s.unlock);
  const [challenge, setChallenge] = useState(newChallenge);
  const [answer, setAnswer] = useState('');
  const [passed, setPassed] = useState(false);
  const [wrong, setWrong] = useState(false);
  const question = useMemo(() => `What is ${WORDS[challenge.a]} multiplied by ${WORDS[challenge.b]}?`, [challenge]);

  const done = useCallback(
    async (pin: string) => {
      await setParentPin(pin);
      unlock();
      router.replace('/parent');
    },
    [setParentPin, unlock],
  );

  if (!hasParent) return <Redirect href="/welcome" />;

  if (passed) {
    return (
      <Screen scroll header={<Header title="Set a new PIN" />}>
        <View style={{ marginTop: space(4) }}>
          <PinSetup onDone={done} />
        </View>
      </Screen>
    );
  }

  const check = () => {
    if (Number(answer.trim()) === challenge.a * challenge.b) {
      setPassed(true);
    } else {
      setWrong(true);
      setAnswer('');
      setChallenge(newChallenge());
    }
  };

  return (
    <Screen scroll header={<Header title="Forgot PIN" />}>
      <View style={{ gap: space(4), marginTop: space(4) }}>
        <AppText muted>To make sure you&apos;re a grown-up, please answer this question.</AppText>
        <AppText variant="heading">{question}</AppText>
        <TextInput
          value={answer}
          onChangeText={(t) => {
            setWrong(false);
            setAnswer(t.replace(/[^0-9]/g, '').slice(0, 3));
          }}
          keyboardType="number-pad"
          returnKeyType="done"
          onSubmitEditing={check}
          accessibilityLabel="Answer"
          placeholder="Answer in digits"
          placeholderTextColor={colors.textMuted}
          style={{
            minHeight: 56,
            borderWidth: 1.5,
            borderRadius: radius.md,
            borderColor: wrong ? colors.danger : colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            paddingHorizontal: 16,
            fontSize: 22,
            fontFamily: font.families.regular,
          }}
        />
        {wrong ? (
          <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
            That&apos;s not right. Here&apos;s a new question.
          </AppText>
        ) : null}
        <Button label="Continue" disabled={answer.length === 0} onPress={check} />
      </View>
    </Screen>
  );
}
