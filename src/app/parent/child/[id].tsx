import { Camera } from 'expo-camera';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useFocusMode } from '@/components/FocusTracker';
import { MISSES_BEFORE_BREAK } from '@/engine/adaptive';
import { ProfileForm } from '@/components/ProfileForm';
import { isFaceDetectionAvailable } from '@/services/faceDetection';
import { useAppStore, useProfile } from '@/store/appStore';
import { BREAK_REMINDER_OPTIONS, MIN_PASSWORD_LENGTH, SCREEN_TIME_OPTIONS } from '@/store/profile';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { ChoiceChips, SectionTitle, SettingRow, Stepper, ToggleRow } from '@/ui/controls';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';

export default function ChildSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const profile = useProfile(isNew ? undefined : id);
  const { colors, space, radius, font } = useTheme();
  const updateProfile = useAppStore((s) => s.updateProfile);
  const updatePrefs = useAppStore((s) => s.updatePrefs);
  const resetProgress = useAppStore((s) => s.resetProgress);
  const deleteProfile = useAppStore((s) => s.deleteProfile);
  const profileCount = useAppStore((s) => s.profiles.length);
  const isUsernameTaken = useAppStore((s) => s.isUsernameTaken);
  const setPassword = useAppStore((s) => s.setPassword);
  const clearFocusSamples = useAppStore((s) => s.clearFocusSamples);
  const progressFocusCount = useAppStore((s) => (id ? (s.progress[id]?.focus.length ?? 0) : 0));
  const [newPassword, setNewPassword] = useState('');
  const focusMode = useFocusMode(profile?.prefs.focusHelper);

  // New children are created through the Register screen.
  if (isNew) return <Redirect href={{ pathname: '/register', params: { from: 'parent' } }} />;

  if (!profile) {
    return (
      <Screen header={<Header title="Child not found" />}>
        <AppText muted>This child may have been removed.</AppText>
      </Screen>
    );
  }

  const confirmReset = () =>
    Alert.alert(`Reset ${profile.name}'s progress?`, 'Stars, badges, levels and history will be cleared. Settings are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => resetProgress(profile.id) },
    ]);

  const confirmDelete = () =>
    Alert.alert(`Remove ${profile.name}?`, 'Their profile and all progress will be deleted from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          deleteProfile(profile.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen scroll header={<Header title={profile.name} subtitle="Child settings" />}>
      <ProfileForm
        key={profile.id}
        initial={{ name: profile.name, age: profile.age, avatar: profile.avatar }}
        submitLabel="Save details"
        onSubmit={(values) => {
          if (isUsernameTaken(values.name, profile.id)) {
            Alert.alert('Name already used', 'Another child on this device has that name. Names are used to log in, so they must be different.');
            return;
          }
          updateProfile(profile.id, values);
          Alert.alert('Saved', `${values.name}'s details were updated.`);
        }}
      />

      <SectionTitle>Password</SectionTitle>
      <SettingRow title="Set a new password" description={`For when ${profile.name} forgets it. At least ${MIN_PASSWORD_LENGTH} characters.`}>
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="New password"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="New password"
          style={{
            minHeight: 56,
            borderWidth: 1.5,
            borderRadius: radius.md,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            paddingHorizontal: 16,
            fontSize: 18,
            fontFamily: font.families.regular,
          }}
        />
        <Button
          label="Save password"
          icon="key"
          variant="secondary"
          disabled={newPassword.length < MIN_PASSWORD_LENGTH}
          onPress={async () => {
            await setPassword(profile.id, newPassword);
            setNewPassword('');
            Alert.alert('Password saved', `${profile.name} can now log in with the new password.`);
          }}
        />
      </SettingRow>

      <SectionTitle>Learning time</SectionTitle>
      <SettingRow title="Daily screen time" description="When the time is up, a friendly break screen appears. You can add time with your PIN.">
        <ChoiceChips
          accessibilityLabel="Daily screen time"
          value={profile.prefs.dailyLimitMin}
          onChange={(dailyLimitMin) => updatePrefs(profile.id, { dailyLimitMin })}
          options={SCREEN_TIME_OPTIONS.map((m) => ({ value: m, label: m === null ? 'No limit' : `${m} min` }))}
        />
      </SettingRow>
      <SettingRow
        title="Break reminder"
        description="After this much continuous play, the Wellness Advisor suggests a short outdoor break. It never interrupts an activity."
      >
        <ChoiceChips
          accessibilityLabel="Break reminder"
          value={profile.prefs.breakReminderMin}
          onChange={(breakReminderMin) => updatePrefs(profile.id, { breakReminderMin })}
          options={BREAK_REMINDER_OPTIONS.map((m) => ({ value: m, label: m === null ? 'Off' : `${m} min` }))}
        />
      </SettingRow>
      <SettingRow title="Daily plan size" description="How many activities are in each day's plan. Shorter, regular practice works best.">
        <Stepper
          label="daily plan size"
          value={profile.prefs.dailyGoal}
          min={3}
          max={6}
          step={1}
          onChange={(dailyGoal) => updatePrefs(profile.id, { dailyGoal })}
          format={(v) => `${v} activities`}
        />
      </SettingRow>
      <SettingRow
        title="Struggle sensitivity"
        description={`How quickly the app steps in when ${profile.name} struggles: after this many misses in a row it offers a calm break and an easier level.`}
      >
        <ChoiceChips
          accessibilityLabel="Struggle sensitivity"
          value={profile.prefs.struggleSensitivity}
          onChange={(struggleSensitivity) => updatePrefs(profile.id, { struggleSensitivity })}
          options={[
            { value: 'gentle', label: `Gentle (${MISSES_BEFORE_BREAK.gentle})` },
            { value: 'balanced', label: `Balanced (${MISSES_BEFORE_BREAK.balanced})` },
            { value: 'quick', label: `Quick (${MISSES_BEFORE_BREAK.quick})` },
          ]}
        />
      </SettingRow>
      <SettingRow
        title="Highest level"
        description="Activities move up a level as they get easy. Cap it here if a level is too hard for now; Learning Path goals count at this level."
      >
        <ChoiceChips
          accessibilityLabel="Highest level"
          value={profile.prefs.maxLevel}
          onChange={(maxLevel) => updatePrefs(profile.id, { maxLevel })}
          options={[
            { value: 1, label: 'Level 1' },
            { value: 2, label: 'Level 2' },
            { value: 3, label: 'Level 3 (no limit)' },
          ]}
        />
      </SettingRow>
      <AppText variant="caption" muted>
        Reading settings (font, colours, overlay and ruler) are in the Reading tab of {profile.name}&apos;s app.
      </AppText>

      <SectionTitle>Focus helper</SectionTitle>
      <ToggleRow
        title="Notice tiredness, distraction and frustration"
        description={`During activities, the front camera takes a small photo every 5 seconds. The face is checked on this device (where ${profile.name} is looking, tired eyes, and the original app's 7-expression model: happy, neutral, surprised, frustrated, sad, worried) and the photo is deleted straight away; only the expression and a focus score are saved. When the face isn't in view, or the camera can't be used, readings come from touch and speech activity instead. If ${profile.name} looks tired or stops for a while, the app suggests a change. A badge shows when it's on (👁 camera, ✋ touch).`}
        value={profile.prefs.focusHelper}
        onChange={async (focusHelper) => {
          if (!focusHelper) return updatePrefs(profile.id, { focusHelper });
          const { granted } = await Camera.requestCameraPermissionsAsync();
          updatePrefs(profile.id, { focusHelper });
          if (!granted) {
            Alert.alert('Camera not allowed', 'The Focus helper will use touch and speech activity instead. Allow camera access for LexiLeap in Settings to add camera readings.');
          }
        }}
      />
      {focusMode.kind !== 'off' ? (
        <AppText variant="caption" muted>
          {focusMode.kind === 'camera'
            ? isFaceDetectionAvailable()
              ? '👁 Working with the camera (ML Kit face detection and the expression model).'
              : '👁 Working with the camera (face detection and the expression model run in the app, e.g. in Expo Go; tiredness from eye openness needs the full app).'
            : '✋ Touch mode: camera access is off. Allow it for LexiLeap in Settings for camera readings.'}
        </AppText>
      ) : null}
      <Button
        label="Delete focus readings"
        icon="trash-outline"
        variant="secondary"
        compact
        disabled={progressFocusCount === 0}
        onPress={() =>
          Alert.alert('Delete focus readings?', `This removes ${profile.name}'s Mood Track focus history. Mood check-ins are kept.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => clearFocusSamples(profile.id) },
          ])
        }
      />

      <SectionTitle>Danger zone</SectionTitle>
      <View style={{ gap: space(3) }}>
        <Button label="Reset progress" icon="refresh" variant="secondary" onPress={confirmReset} />
        <Button label={`Remove ${profile.name}`} icon="trash" variant="danger" disabled={profileCount <= 1} onPress={confirmDelete} />
        {profileCount <= 1 ? (
          <AppText variant="caption" muted>
            Add another child before removing the only profile.
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}
