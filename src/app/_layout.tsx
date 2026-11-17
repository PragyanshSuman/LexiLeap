import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WellnessAdvisorSheet } from '@/components/AdvisorSheet';
import { FriendlyError } from '@/components/FriendlyError';
import { isChildRoute, UsageTracker } from '@/components/UsageTracker';
import { applyOrientationPolicy } from '@/services/orientation';
import { markInteraction } from '@/services/interaction';
import { configureAudio } from '@/services/sounds';
import { useHydrated } from '@/store/appStore';
import { FONT_ASSETS } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { ReadingOverlay } from '@/ui/ReadingOverlay';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** A crash anywhere shows a calm, child-friendly screen instead of a developer error page. */
export const ErrorBoundary = FriendlyError;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const hydrated = useHydrated();
  // A font that fails to load falls back to the system font rather than blocking the app.
  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => {
    void configureAudio();
    void applyOrientationPolicy();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Every touch anywhere counts as activity, for the Focus helper's touch fallback. */}
      <View style={{ flex: 1 }} onTouchStart={() => markInteraction()}>
        <AppShell />
      </View>
    </GestureHandlerRootView>
  );
}

function AppShell() {
  const { colors, prefs } = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => undefined);
  }, [colors.bg]);

  return (
    <>
      <StatusBar style={colors.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: prefs.reduceMotion ? 'none' : 'default',
        }}
      >
        <Stack.Screen name="activity/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="assessment/speech" options={{ gestureEnabled: false }} />
        <Stack.Screen name="assessment/spelling" options={{ gestureEnabled: false }} />
        {/* Drawing screens: a sideways finger drag must trace, not swipe back to the previous screen (iPad). */}
        <Stack.Screen name="tracing/trace/[letter]" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
        <Stack.Screen name="mastery/write/[letter]" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
        <Stack.Screen name="break" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
      <UsageTracker />
      {/* Reading aids belong to the child's experience, not setup or the parent zone. */}
      {isChildRoute(pathname) ? <ReadingOverlay /> : null}
      <WellnessAdvisorSheet />
    </>
  );
}
