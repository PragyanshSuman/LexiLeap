import { Redirect } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import { SidebarContent } from '@/components/SidebarContent';
import { isOverLimit } from '@/engine/progress';
import { dayKey } from '@/lib/date';
import { useActiveProfile, useAppStore, useProgress } from '@/store/appStore';
import { useTheme } from '@/theme/useTheme';

/** Widest the side menu gets (phones use 80% of the screen). */
const DRAWER_MAX_WIDTH = 360;

/** The child's area: the original app's side-drawer navigation around the Home screen. */
export default function ChildLayout() {
  const { colors, prefs } = useTheme();
  const hasParent = useAppStore((s) => s.parent !== null);
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const { width } = useWindowDimensions();
  const drawerWidth = Math.round(Math.min(DRAWER_MAX_WIDTH, width * 0.8));

  if (!hasParent) return <Redirect href="/welcome" />;
  if (!profile) return <Redirect href="/login" />;
  if (isOverLimit(profile.prefs.dailyLimitMin, progress, dayKey())) return <Redirect href="/break" />;

  return (
    <Drawer
      drawerContent={(props) => <SidebarContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: prefs.reduceMotion ? 'front' : 'slide',
        // An exact width: the drawer slides the screen by this amount, so a percentage would push a
        // tablet's whole screen away (80% of an iPad is ~820 pt).
        drawerStyle: { width: drawerWidth, backgroundColor: colors.bg },
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
