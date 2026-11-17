import { NativeModules, Platform } from 'react-native';
import type { FaceReading } from '@/engine/focus';

type Detector = typeof import('@react-native-ml-kit/face-detection').default;

/**
 * ML Kit face detection is a native module, so it exists in development and store builds but not
 * in Expo Go. Loading it lazily lets the rest of the app run anywhere; the Focus helper simply
 * reports that it isn't available.
 */
let cached: Detector | null | undefined;
function getDetector(): Detector | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === 'web' || !NativeModules.FaceDetection) return (cached = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('@react-native-ml-kit/face-detection').default as Detector;
  } catch {
    cached = null;
  }
  return cached;
}

export function isFaceDetectionAvailable(): boolean {
  return getDetector() !== null;
}

/** Finds the largest face in a photo. Resolves null when there is no face (or no detector). */
export async function readFace(imageUri: string): Promise<FaceReading | null> {
  const detector = getDetector();
  if (!detector) return null;
  const faces = await detector.detect(imageUri, { performanceMode: 'fast', classificationMode: 'all', minFaceSize: 0.15 });
  const face = [...faces].sort((a, b) => b.frame.width * b.frame.height - a.frame.width * a.frame.height)[0];
  if (!face) return null;
  return {
    yaw: face.rotationY,
    pitch: face.rotationX,
    smiling: face.smilingProbability,
    leftEyeOpen: face.leftEyeOpenProbability,
    rightEyeOpen: face.rightEyeOpenProbability,
    box: { x: face.frame.left, y: face.frame.top, width: face.frame.width, height: face.frame.height },
  };
}
