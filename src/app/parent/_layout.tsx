import { Redirect, Stack } from 'expo-router';
import { useParentSession } from '@/store/parentSession';
import { ThemeScope, useTheme } from '@/theme/useTheme';

/**
 * Everything under /parent requires the PIN. The unlock expires after a few minutes and
 * is cleared when the child's home screen is shown again (see the Today tab).
 */
export default function ParentLayout() {
  const unlocked = useParentSession((s) => s.unlocked);
  if (!unlocked) return <Redirect href="/parent-gate" />;
  return (
    <ThemeScope>
      <ParentStack />
    </ThemeScope>
  );
}

function ParentStack() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
