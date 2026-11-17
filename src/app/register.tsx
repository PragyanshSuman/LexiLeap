import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AuthField, AuthShell, AuthSwitch } from '@/components/AuthShell';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useAppStore } from '@/store/appStore';
import { AVATARS, MAX_AGE, MAX_NAME_LENGTH, MAX_PROFILES, MIN_AGE, MIN_PASSWORD_LENGTH } from '@/store/profile';
import { DT } from '@/theme/dyslexiaTheme';
import { ThemeScope } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Stepper } from '@/ui/controls';

/**
 * Create a learner account. Opened from Login ("Create an account"), on first run, or by a
 * parent from the parent zone (`?from=parent`), in which case it returns there afterwards.
 */
export default function Register() {
  return (
    <ThemeScope>
      <RegisterContent />
    </ThemeScope>
  );
}

function RegisterContent() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const byParent = from === 'parent';
  const feedback = useFeedback();
  const { t } = useT();
  const hasParent = useAppStore((s) => s.parent !== null);
  const profileCount = useAppStore((s) => s.profiles.length);
  const addProfile = useAppStore((s) => s.addProfile);
  const isUsernameTaken = useAppStore((s) => s.isUsernameTaken);
  const setActiveProfile = useAppStore((s) => s.setActiveProfile);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState(6);
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!hasParent) return <Redirect href="/setup/pin" />;
  if (profileCount >= MAX_PROFILES) return <Redirect href={byParent ? '/parent/settings' : '/login'} />;

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError(t('register_missing_name'));
    if (isUsernameTaken(trimmed)) return setError(t('register_name_taken'));
    if (password.length < MIN_PASSWORD_LENGTH) return setError(t('register_short_password', { n: MIN_PASSWORD_LENGTH }));
    setBusy(true);
    try {
      const id = await addProfile({ name: trimmed, age, avatar }, password);
      feedback.complete();
      if (byParent) {
        router.back();
      } else {
        setActiveProfile(id);
        router.dismissTo('/home');
      }
    } catch {
      setError(t('something_wrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell emoji="🎈" title={t('register_title')} subtitle={t('register_subtitle')} background={[DT.bg.lemon, DT.bg.cream, DT.bg.skyBlue]}>
      <AuthField
        label={t('register_username')}
        placeholder="e.g. StarReader"
        value={name}
        autoCapitalize="words"
        maxLength={MAX_NAME_LENGTH}
        onChangeText={(t) => {
          setName(t);
          setError(null);
        }}
      />
      <AuthField
        label={t('register_password')}
        placeholder="••••••••"
        secure
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setError(null);
        }}
      />

      <AppText size={13} weight="bold" color={DT.text.primary} style={styles.label}>
        {t('register_age')}
      </AppText>
      <View style={styles.block}>
        <Stepper label="age" value={age} min={MIN_AGE} max={MAX_AGE} step={1} onChange={setAge} format={(v) => t('register_age_value', { n: v })} />
      </View>

      <AppText size={13} weight="bold" color={DT.text.primary} style={styles.label}>
        {t('register_buddy')}
      </AppText>
      <View style={[styles.avatars, styles.block]} accessibilityRole="radiogroup" accessibilityLabel="Avatar">
        {AVATARS.map((a) => {
          const selected = a === avatar;
          return (
            <Pressable
              key={a}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Avatar ${a}`}
              onPress={() => {
                feedback.tap();
                setAvatar(a);
              }}
              style={[styles.avatar, selected && styles.avatarSelected]}
            >
              <AppText size={26} fixed>
                {a}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <AppText variant="label" color={DT.text.error} center accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </AppText>
      ) : null}

      <Button label={t('register_button')} icon="person-add" loading={busy} onPress={() => void submit()} color={DT.accent.rose} />

      {byParent ? (
        <AuthSwitch prompt={t('register_changed_mind')} action={t('go_back')} onPress={() => router.back()} />
      ) : profileCount > 0 ? (
        <AuthSwitch prompt={t('register_have_account')} action={t('register_login')} onPress={() => router.replace('/login')} />
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 8 },
  block: { marginBottom: 20 },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelected: { borderColor: DT.accent.rose, backgroundColor: DT.bg.blush },
  error: { marginBottom: 12 },
});
