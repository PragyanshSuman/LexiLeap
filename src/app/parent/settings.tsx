import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { applyBackup, pickBackup, shareBackup } from '@/services/backup';
import { useAppStore } from '@/store/appStore';
import { MAX_PROFILES } from '@/store/profile';
import { useParentSession } from '@/store/parentSession';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SectionTitle } from '@/ui/controls';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';

export default function ParentSettings() {
  const { space } = useTheme();
  const profiles = useAppStore((s) => s.profiles);
  const lock = useParentSession((s) => s.lock);
  const [busy, setBusy] = useState<'save' | 'restore' | null>(null);

  const saveBackup = async () => {
    setBusy('save');
    try {
      await shareBackup();
    } catch (e) {
      Alert.alert('Could not save the backup', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const restoreBackup = async () => {
    setBusy('restore');
    try {
      const data = await pickBackup();
      if (!data) return;
      const names = data.profiles.map((p) => p.name).join(', ');
      Alert.alert('Restore this backup?', `It contains: ${names}.\n\nThis replaces all children and progress on this device. Your PIN stays the same.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            applyBackup(data);
            router.dismissAll();
            router.replace('/login');
          },
        },
      ]);
    } catch (e) {
      Alert.alert('Could not restore', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const eraseEverything = () =>
    Alert.alert('Erase all data?', 'This removes every child, all progress and the parent PIN from this device. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase everything',
        style: 'destructive',
        onPress: async () => {
          useAppStore.setState({ profiles: [], activeProfileId: null, parent: null, progress: {} });
          await useAppStore.persist.clearStorage();
          lock();
          router.dismissAll();
          router.replace('/welcome');
        },
      },
    ]);

  return (
    <Screen scroll header={<Header title="Settings" />}>
      <SectionTitle>Children</SectionTitle>
      <View style={{ gap: space(3) }}>
        {profiles.map((p) => (
          <Card
            key={p.id}
            onPress={() => router.push({ pathname: '/parent/child/[id]', params: { id: p.id } })}
            accessibilityLabel={`Edit ${p.name}`}
            style={styles.row}
          >
            <AppText size={30} style={{ lineHeight: 38 }}>
              {p.avatar}
            </AppText>
            <View style={styles.flex}>
              <AppText variant="label">{p.name}</AppText>
              <AppText variant="caption" muted>
                Age {p.age} · {p.prefs.dailyLimitMin === null ? 'No time limit' : `${p.prefs.dailyLimitMin} min a day`} · {p.prefs.dailyGoal} activities a day
              </AppText>
            </View>
          </Card>
        ))}
        {profiles.length < MAX_PROFILES ? (
          <Button label="Add a child" icon="person-add" variant="secondary" onPress={() => router.push({ pathname: '/register', params: { from: 'parent' } })} />
        ) : (
          <AppText variant="caption" muted>
            You can add up to {MAX_PROFILES} children.
          </AppText>
        )}
      </View>

      <SectionTitle>Backup</SectionTitle>
      <View style={{ gap: space(3) }}>
        <AppText variant="caption" muted>
          Progress lives only on this device. Save a backup to Files, Google Drive or email to move it to a new phone or tablet.
        </AppText>
        <Button label="Save a backup" icon="cloud-upload-outline" variant="secondary" loading={busy === 'save'} disabled={busy !== null} onPress={saveBackup} />
        <Button label="Restore from a backup" icon="cloud-download-outline" variant="secondary" loading={busy === 'restore'} disabled={busy !== null} onPress={restoreBackup} />
      </View>

      <SectionTitle>Security</SectionTitle>
      <Button label="Change parent PIN" icon="key" variant="secondary" onPress={() => router.push('/parent/change-pin')} />

      <SectionTitle>Privacy</SectionTitle>
      <Card style={{ gap: space(2) }}>
        <AppText variant="label">Your data stays on this device</AppText>
        <AppText variant="caption" muted>
          LexiLeap has no accounts, no ads and no tracking, and never uses the camera. Progress is stored only on this device. Reports
          are shared only when you choose to. When your child reads aloud in “Say It”, the device&apos;s built-in speech recognition
          is used. Depending on the device, that may be processed by Apple or Google, and LexiLeap stores no audio.
        </AppText>
      </Card>

      <SectionTitle>About</SectionTitle>
      <Card style={{ gap: space(2) }}>
        <AppText variant="caption" muted>
          LexiLeap is a practice tool built on structured, multisensory literacy principles. It is not a diagnostic test. If you have
          concerns about your child&apos;s reading, please speak to their teacher or a qualified specialist.
        </AppText>
      </Card>

      <View style={{ marginTop: space(8) }}>
        <Button label="Erase all data" icon="trash" variant="danger" onPress={eraseEverything} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flex: { flex: 1 },
});
