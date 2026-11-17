import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AVATARS, MAX_AGE, MAX_NAME_LENGTH, MIN_AGE } from '@/store/profile';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { SettingRow, Stepper } from '@/ui/controls';

export interface ProfileFormValues {
  name: string;
  age: number;
  avatar: string;
}

interface ProfileFormProps {
  initial?: ProfileFormValues;
  submitLabel: string;
  onSubmit: (values: ProfileFormValues) => void;
}

export function ProfileForm({ initial, submitLabel, onSubmit }: ProfileFormProps) {
  const { colors, radius, space, font } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [age, setAge] = useState(initial?.age ?? 6);
  const [avatar, setAvatar] = useState(initial?.avatar ?? AVATARS[0]);
  const trimmed = name.trim();

  return (
    <View style={{ gap: space(2) }}>
      <SettingRow title="Name" description="Shown to your child on their home screen.">
        <TextInput
          value={name}
          onChangeText={(t) => setName(t.slice(0, MAX_NAME_LENGTH))}
          placeholder="First name or nickname"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel="Child's name"
          style={[
            styles.input,
            { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, fontFamily: font.families.regular },
          ]}
        />
      </SettingRow>

      <SettingRow title="Age" description="Used to pick suitable activities for the daily plan.">
        <Stepper label="age" value={age} min={MIN_AGE} max={MAX_AGE} step={1} onChange={setAge} format={(v) => `${v} years old`} />
      </SettingRow>

      <SettingRow title="Avatar">
        <View style={[styles.avatars, { gap: space(2) }]} accessibilityRole="radiogroup" accessibilityLabel="Avatar">
          {AVATARS.map((a) => {
            const selected = a === avatar;
            return (
              <Pressable
                key={a}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Avatar ${a}`}
                onPress={() => setAvatar(a)}
                style={[
                  styles.avatar,
                  { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.surface },
                ]}
              >
                <AppText size={30} style={{ lineHeight: 38 }}>
                  {a}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </SettingRow>

      <Button
        label={submitLabel}
        icon="checkmark"
        disabled={trimmed.length === 0}
        onPress={() => onSubmit({ name: trimmed, age, avatar })}
        style={{ marginTop: space(4) }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 56, borderWidth: 1.5, paddingHorizontal: 16, fontSize: 18 },
  avatars: { flexDirection: 'row', flexWrap: 'wrap' },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
