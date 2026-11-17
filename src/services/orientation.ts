import { Dimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

/** Devices whose shorter side is at least this many points are treated as tablets. */
const TABLET_MIN_SIDE = 600;

export function isTablet(): boolean {
  const { width, height } = Dimensions.get('screen');
  return Math.min(width, height) >= TABLET_MIN_SIDE;
}

/**
 * Tablets rotate freely (landscape or portrait). Phones stay in portrait: in phone
 * landscape there isn't enough height for activities such as letter tracing.
 */
export async function applyOrientationPolicy(): Promise<void> {
  try {
    if (isTablet()) await ScreenOrientation.unlockAsync();
    else await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch {
    // Orientation locking isn't available everywhere (e.g. web); the app works either way.
  }
}
