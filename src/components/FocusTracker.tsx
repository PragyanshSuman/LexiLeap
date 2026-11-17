import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { analyzeActivity, analyzeFace, needsFocusBreak, type FocusFeature, type FocusSample } from '@/engine/focus';
import { useT } from '@/i18n';
import { dayKey } from '@/lib/date';
import { readEmotions, readFaceInJs } from '@/services/emotionModel';
import { isFaceDetectionAvailable, readFace } from '@/services/faceDetection';
import { msSinceInteraction } from '@/services/interaction';
import { useActiveProfile, useAppStore } from '@/store/appStore';
import { AppText } from '@/ui/AppText';

/** One reading every few seconds, like the original tracker. */
const SAMPLE_MS = 5000;
/** After suggesting a break, wait this long before suggesting another. */
const BREAK_COOLDOWN_MS = 2 * 60_000;
/** After this many camera failures in a row, the screen switches to touch readings. */
const MAX_CAMERA_FAILURES = 3;

export type FocusMode = { kind: 'off' } | { kind: 'camera' } | { kind: 'touch'; reason: 'no-permission' };

/** How the Focus helper works for this child on this device right now. */
export function useFocusMode(focusHelper: boolean | undefined): FocusMode {
  const [permission] = useCameraPermissions();
  if (!focusHelper) return { kind: 'off' };
  // Faces are found with ML Kit in the full app, or in JavaScript elsewhere (e.g. Expo Go).
  if (!permission?.granted) return { kind: 'touch', reason: 'no-permission' };
  return { kind: 'camera' };
}

interface FocusTrackerProps {
  /** Where the child is, for the Mood Track report (an activity id or a studio name). */
  feature: FocusFeature;
  /** Called when the child has looked away, tired or stopped for several readings in a row. */
  onLowFocus?: () => void;
}

/**
 * The Focus helper (opt-in per child, parent-controlled). While a screen is open it takes a reading
 * every few seconds:
 *  - camera: a hidden front camera takes a small photo; ML Kit finds the face (head angle, eyes,
 *    smile) and the original 7-expression model reads it, all on the device; the photo is deleted
 *    straight away and only the result is saved;
 *  - where ML Kit isn't in the build (Expo Go), OpenCV's face detector runs in JavaScript instead;
 *  - touch (fallback): when the face isn't in view, or the camera is not allowed or failing, the reading
 *    comes from recent touches and speech.
 * A small badge shows the child it is on (👁 camera, ✋ touch). Renders nothing when switched off.
 */
export function FocusTracker({ feature, onLowFocus }: FocusTrackerProps) {
  const profile = useActiveProfile();
  const mode = useFocusMode(profile?.prefs.focusHelper);
  if (mode.kind === 'off' || !profile) return null;
  return <ActiveTracker key={mode.kind} profileId={profile.id} feature={feature} onLowFocus={onLowFocus} camera={mode.kind === 'camera'} />;
}

function ActiveTracker({ profileId, feature, onLowFocus, camera }: FocusTrackerProps & { profileId: string; camera: boolean }) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const logFocusSample = useAppStore((s) => s.logFocusSample);
  const cameraRef = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const failures = useRef(0);
  const lastBreak = useRef(0);
  const lowFocus = useRef(onLowFocus);
  useEffect(() => {
    lowFocus.current = onLowFocus;
  }, [onLowFocus]);
  const useCamera = camera && !cameraFailed;

  useFocusEffect(
    useCallback(() => {
      let busy = false;
      // Paused while the app is in the background.
      let foreground = true;
      const appState = AppState.addEventListener('change', (state) => {
        foreground = state === 'active';
      });

      /** A camera reading, or null when the camera couldn't take one. */
      const cameraReading = async (): Promise<Omit<FocusSample, 'at' | 'day' | 'feature'> | null> => {
        if (!useCamera || !ready || !cameraRef.current) return null;
        let photo: { uri: string; width: number; height: number } | undefined;
        try {
          photo = await cameraRef.current.takePictureAsync({ quality: 0.3, shutterSound: false });
          if (!photo?.uri) throw new Error('no photo');
          failures.current = 0;
        } catch {
          failures.current += 1;
          if (failures.current >= MAX_CAMERA_FAILURES) setCameraFailed(true);
          return null;
        }
        try {
          // The native detector (head angle, eyes, smile) when this build has it; otherwise OpenCV's face
          // detector in JavaScript. Either way the original expression model reads the face.
          if (isFaceDetectionAvailable()) {
            const face = await readFace(photo.uri).catch(() => null);
            // No face in view: fall back to touch activity rather than counting it as "away".
            if (!face) return null;
            const emotions = face.box ? await readEmotions(photo, face.box) : null;
            return { ...analyzeFace(face, emotions), source: 'camera' };
          }
          const found = await readFaceInJs(photo).catch(() => null);
          return found ? { ...analyzeFace(found.face, found.emotions), source: 'camera' } : null;
        } finally {
          try {
            new File(photo.uri).delete();
          } catch {
            // Already gone.
          }
        }
      };

      const sample = async () => {
        if (busy || !foreground) return;
        busy = true;
        try {
          const now = Date.now();
          const reading = (await cameraReading()) ?? { ...analyzeActivity(msSinceInteraction(now)), source: 'touch' as const };
          logFocusSample(profileId, { at: now, day: dayKey(), feature, ...reading });
          const samples = useAppStore.getState().progress[profileId]?.focus ?? [];
          if (now - lastBreak.current > BREAK_COOLDOWN_MS && needsFocusBreak(samples, feature, now)) {
            lastBreak.current = now;
            lowFocus.current?.();
          }
        } catch {
          // A missed reading is fine; the next one comes in a few seconds.
        } finally {
          busy = false;
        }
      };
      const first = setTimeout(sample, 800);
      const timer = setInterval(sample, SAMPLE_MS);
      return () => {
        clearTimeout(first);
        clearInterval(timer);
        appState?.remove();
      };
    }, [useCamera, ready, feature, profileId, logFocusSample]),
  );

  return (
    <>
      {useCamera ? (
        <View style={styles.hidden} pointerEvents="none">
          <CameraView ref={cameraRef} style={styles.camera} facing="front" mute animateShutter={false} onCameraReady={() => setReady(true)} onMountError={() => setCameraFailed(true)} />
        </View>
      ) : null}
      <View style={[styles.badge, { bottom: insets.bottom + 6, left: insets.left + 6 }]} pointerEvents="none" accessible accessibilityLabel={t(useCamera ? 'focus_on' : 'focus_on_touch')}>
        <AppText size={14} fixed>
          {useCamera ? '👁' : '✋'}
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
