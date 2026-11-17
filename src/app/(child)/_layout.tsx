import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { SidebarContent } from '@/components/SidebarContent';
import { isOverLimit } from '@/engine/progress';
import { dayKey } from '@/lib/date';
import { useActiveProfile, useAppStore, useProgress } from '@/store/appStore';
import { useTheme } from '@/theme/useTheme';

/** The child's area: the original app's side-drawer navigation around the Home screen. */
export default function ChildLayout() {
  const { colors, prefs } = useTheme();
  const hasParent = useAppStore((s) => s.parent !== null);
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);

  if (!hasParent) return <Redirect href="/welcome" />;
  if (!profile) return <Redirect href="/login" />;
  if (isOverLimit(profile.prefs.dailyLimitMin, progress, dayKey())) return <Redirect href="/break" />;

  return (
    <Drawer
      drawerContent={(props) => <SidebarContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: prefs.reduceMotion ? 'front' : 'slide',
        drawerStyle: { width: '80%', maxWidth: 360, backgroundColor: colors.bg },
        overlayColor: 'rgba(44, 36, 23, 0.45)',
        sceneStyle: { backgroundColor: colors.bg },
        swipeEdgeWidth: 32,
      }}
    >
      <Drawer.Screen name="home" options={{ title: 'Home' }} />
      <Drawer.Screen name="play" options={{ title: 'All activities' }} />
      <Drawer.Screen name="rewards" options={{ title: 'My rewards' }} />
      <Drawer.Screen name="comfort" options={{ title: 'Reading settings' }} />
    </Drawer>
  );
}
