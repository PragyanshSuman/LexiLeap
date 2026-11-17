import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AuthField, AuthShell, AuthSwitch } from '@/components/AuthShell';
import { LanguagePicker } from '@/components/LanguagePicker';
import { useT } from '@/i18n';
import { useFeedback } from '@/services/feedback';
import { useAppStore } from '@/store/appStore';
import { MAX_PROFILES, usernameKey } from '@/store/profile';
import { DT } from '@/theme/dyslexiaTheme';
import { ThemeScope } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';

export default function Login() {
  return (
    <ThemeScope>
      <LoginContent />
    </ThemeScope>
  );
}

function LoginContent() {
  const feedback = useFeedback();
  const { t } = useT();
  const hasParent = useAppStore((s) => s.parent !== null);
  const profiles = useAppStore((s) => s.profiles);
  const logIn = useAppStore((s) => s.logIn);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!hasParent) return <Redirect href="/welcome" />;
  if (profiles.length === 0) return <Redirect href="/register" />;

  const findAccount = (name: string) => profiles.find((p) => usernameKey(p.name) === usernameKey(name));
  const chosen = findAccount(username);
  const needsPassword = !chosen || !!chosen.passwordHash;

  const submit = async (name = username, pass = password) => {
    const account = findAccount(name);
    if (!name.trim() || ((!account || account.passwordHash) && !pass)) {
      setError(t('login_missing'));
      return;
    }
    setBusy(true);
    const result = await logIn(name, pass);
    setBusy(false);
    if (result === 'ok') {
      feedback.complete();
      router.dismissTo('/home');
    } else {
      feedback.tryAgain();
      setError(result === 'unknown-user' ? t('login_unknown') : t('login_wrong_password'));
      setPassword('');
    }
  };

  return (
    <AuthShell emoji="🌟" title={t('app_name')} subtitle={t('login_subtitle')} background={[DT.bg.lavender, DT.bg.cream, DT.bg.skyBlue]}>
      <LanguagePicker compact />
      <AppText size={13} weight="bold" color={DT.text.primary} style={styles.label}>
        {t('login_who')}
      </AppText>
      <View style={styles.chips}>
        {profiles.map((p) => {
          const selected = chosen?.id === p.id;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={p.name}
              onPress={() => {
                feedback.tap();
                setError(null);
                setUsername(p.name);
                setPassword('');
                // Profiles without a password open straight away.
                if (!p.passwordHash) void submit(p.name, '');
              }}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <AppText size={26} fixed>
                {p.avatar}
              </AppText>
              <AppText variant="caption" weight="bold" numberOfLines={1} color={DT.text.primary}>
                {p.name}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <AuthField label={t('login_username')} placeholder="e.g. HeroStudent" value={username} onChangeText={(t) => { setUsername(t); setError(null); }} />
      {needsPassword ? (
        <AuthField
          label={t('login_password')}
          placeholder="••••••••"
          secure
          value={password}
          onChangeText={(t) => { setPassword(t); setError(null); }}
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />
      ) : null}
      {error ? (
        <AppText variant="label" color={DT.text.error} center accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </AppText>
      ) : null}

      <Button label={t('login_play_now')} icon="log-in" loading={busy} onPress={() => void submit()} />

      {profiles.length < MAX_PROFILES ? <AuthSwitch prompt={t('login_new_here')} action={t('login_create')} onPress={() => router.push('/register')} /> : null}
      <AuthSwitch prompt={t('login_grownup')} action={t('login_parent_link')} onPress={() => router.push('/parent-gate')} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  chip: {
    width: 84,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    gap: 2,
  },
  chipSelected: { borderColor: DT.accent.indigo, backgroundColor: DT.bg.lavender },
  error: { marginBottom: 12 },
});
