import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { analyzeFace, needsFocusBreak, type FocusFeature } from '@/engine/focus';
import { useT } from '@/i18n';
import { dayKey } from '@/lib/date';
import { isFaceDetectionAvailable, readFace } from '@/services/faceDetection';
import { useActiveProfile, useAppStore } from '@/store/appStore';
import { AppText } from '@/ui/AppText';

/** One reading every few seconds, like the original tracker. */
const SAMPLE_MS = 5000;
/** After suggesting a break, wait this long before suggesting another. */
const BREAK_COOLDOWN_MS = 2 * 60_000;

interface FocusTrackerProps {
  /** Where the child is, for the Mood Track report (an activity id or a studio name). */
  feature: FocusFeature;
  /** Called when the child has looked away or tired for several readings in a row. */
  onLowFocus?: () => void;
}

/**
 * The Focus helper (opt-in per child, parent-controlled): while a screen is open, a hidden front
 * camera takes a small photo every few seconds, ML Kit checks it on the device, and the photo is
 * deleted straight away. Only the result (expression and a concentration score) is saved.
 * A small eye badge shows the child when it is on. Renders nothing when off or unavailable.
 */
export function FocusTracker({ feature, onLowFocus }: FocusTrackerProps) {
  const profile = useActiveProfile();
  const [permission] = useCameraPermissions();
  const enabled = !!profile?.prefs.focusHelper && !!permission?.granted && isFaceDetectionAvailable();
  if (!enabled || !profile) return null;
  return <ActiveTracker profileId={profile.id} feature={feature} onLowFocus={onLowFocus} />;
}

function ActiveTracker({ profileId, feature, onLowFocus }: FocusTrackerProps & { profileId: string }) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const logFocusSample = useAppStore((s) => s.logFocusSample);
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const lastBreak = useRef(0);
  const lowFocus = useRef(onLowFocus);
  useEffect(() => {
    lowFocus.current = onLowFocus;
  }, [onLowFocus]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      let busy = false;
      // Paused while the app is in the background.
      let foreground = true;
      const appState = AppState.addEventListener('change', (state) => {
        foreground = state === 'active';
      });
      const sample = async () => {
        if (busy || !foreground || !camera.current) return;
        busy = true;
        let uri: string | undefined;
        try {
          uri = (await camera.current.takePictureAsync({ quality: 0.1, shutterSound: false }))?.uri;
          if (!uri) return;
          const now = Date.now();
          logFocusSample(profileId, { at: now, day: dayKey(), feature, ...analyzeFace(await readFace(uri)) });
          const samples = useAppStore.getState().progress[profileId]?.focus ?? [];
          if (now - lastBreak.current > BREAK_COOLDOWN_MS && needsFocusBreak(samples, feature, now)) {
            lastBreak.current = now;
            lowFocus.current?.();
          }
        } catch {
          // A missed reading is fine; the next one comes in a few seconds.
        } finally {
          if (uri) {
            try {
              new File(uri).delete();
            } catch {
              // Already gone.
            }
          }
          busy = false;
        }
      };
      const first = setTimeout(sample, 500);
      const timer = setInterval(sample, SAMPLE_MS);
      return () => {
        clearTimeout(first);
        clearInterval(timer);
        appState?.remove();
      };
    }, [ready, feature, profileId, logFocusSample]),
  );

  return (
    <>
      <View style={styles.hidden} pointerEvents="none">
        <CameraView ref={camera} style={styles.camera} facing="front" mute animateShutter={false} onCameraReady={() => setReady(true)} />
      </View>
      <View style={[styles.badge, { bottom: insets.bottom + 6, left: insets.left + 6 }]} pointerEvents="none" accessible accessibilityLabel={t('focus_on')}>
        <AppText size={14} fixed>
          👁
        </AppText>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // Off-screen and nearly transparent: the camera must be mounted to take photos, but isn't shown.
  hidden: { position: 'absolute', top: 0, left: 0, width: 2, height: 2, opacity: 0.01, overflow: 'hidden' },
  camera: { width: 2, height: 2 },
  badge: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
});
