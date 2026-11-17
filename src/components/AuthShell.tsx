import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '@/ui/BackButton';
import { useT } from '@/i18n';
import { DT } from '@/theme/dyslexiaTheme';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Bob, FadeInUp } from '@/ui/motion';

/**
 * The original app's sign-in look: a soft pastel gradient, a white emoji badge,
 * a big friendly title and a frosted "glass" form card.
 */
export function AuthShell({
  emoji,
  title,
  subtitle,
  background,
  children,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  background: [string, string, string];
  children: ReactNode;
}) {
  // Register can be opened from Login or the parent zone; the very first screen has nothing to go back to.
  const canGoBack = router.canGoBack();
  return (
    <View style={styles.flex}>
    <SafeAreaView style={styles.flex}>
      <LinearGradient colors={background} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FadeInUp index={0} style={styles.logo}>
            <Bob>
              <View style={styles.emojiCircle}>
                <AppText size={50} fixed>
                  {emoji}
                </AppText>
              </View>
            </Bob>
            <AppText size={34} weight="bold" center color={DT.text.primary} accessibilityRole="header">
              {title}
            </AppText>
            <AppText variant="label" center color={DT.text.secondary} style={styles.subtitle}>
              {subtitle}
            </AppText>
          </FadeInUp>
          <FadeInUp index={1}>
            <View style={styles.glass}>{children}</View>
          </FadeInUp>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    {canGoBack ? <BackButton placement="floating" fallback="/login" /> : null}
    </View>
  );
}

/** Field label + large rounded input, as in the original forms (sentence case for easier reading). */
export function AuthField({ label, secure, ...input }: TextInputProps & { label: string; secure?: boolean }) {
  const { font } = useTheme();
  const { t } = useT();
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.field}>
      <AppText size={13} weight="bold" color={DT.text.primary} style={styles.label}>
        {label}
      </AppText>
      <View>
        <TextInput
          placeholderTextColor={DT.text.muted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={label}
          secureTextEntry={secure && hidden}
          {...input}
          style={[styles.input, { fontFamily: font.families.semibold }, secure && styles.inputWithToggle]}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? t('show_password') : t('hide_password')}
            onPress={() => setHidden((h) => !h)}
            style={styles.eye}
            hitSlop={8}
          >
            <AppText size={20} fixed>
              {hidden ? '👁️' : '🙈'}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** "New here? Create an account ✨" style link. */
export function AuthSwitch({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${prompt} ${action}`} onPress={onPress} style={styles.switch}>
      <AppText variant="label" center color={DT.text.secondary}>
        {prompt}{' '}
        <AppText variant="label" weight="bold" color={DT.accent.indigo}>
          {action}
        </AppText>
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, width: '100%', maxWidth: 520, alignSelf: 'center' },
  logo: { alignItems: 'center', marginBottom: 28 },
  emojiCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: DT.bg.cream,
    ...DT.shadow.medium,
  },
  subtitle: { marginTop: 8 },
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: DT.accent.navy,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  field: { marginBottom: 20 },
  label: { marginBottom: 8 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 18,
    color: DT.text.primary,
  },
  inputWithToggle: { paddingRight: 52 },
  eye: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  switch: { marginTop: 20, paddingVertical: 10 },
});
