import { Redirect } from 'expo-router';
import { useActiveProfile, useAppStore } from '@/store/appStore';

/** Sends the user to the right place for the app's current state. */
export default function Index() {
  const hasParent = useAppStore((s) => s.parent !== null);
  const profileCount = useAppStore((s) => s.profiles.length);
  const active = useActiveProfile();

  if (!hasParent) return <Redirect href="/welcome" />;
  if (profileCount === 0) return <Redirect href="/register" />;
  if (!active) return <Redirect href="/login" />;
  return <Redirect href="/home" />;
}
