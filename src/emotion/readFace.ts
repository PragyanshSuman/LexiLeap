import type { FaceReading } from '@/engine/focus';
import { detectFaces, largestFace, type FaceCascade } from './faceDetector';
import { faceCrop, faceInputFromGray, runEmotionModel, type EmotionModel, type EmotionScores } from './model';

/** Smallest face to look for in a ~240 px wide photo: a child sitting in front of the screen. */
export const MIN_FACE = 40;

/**
 * Finds the largest face in a grayscale photo and reads its expression: OpenCV's Haar cascade, then the
 * original 7-expression model on the face crop. Only near-frontal faces are found, so a found face counts
 * as facing the screen; eye openness isn't measured. `scale` maps back to the full photo's pixels.
 */
export function readFaceFromGray(
  gray: Uint8Array,
  width: number,
  height: number,
  cascade: FaceCascade,
  model: EmotionModel | null,
  scale = 1,
): { face: FaceReading; emotions: EmotionScores | null } | null {
  const box = largestFace(detectFaces(gray, width, height, cascade, { minSize: MIN_FACE }));
  if (!box) return null;
  const face: FaceReading = { yaw: 0, pitch: 0, box: { x: box.x * scale, y: box.y * scale, width: box.width * scale, height: box.height * scale } };
  const emotions = model ? runEmotionModel(model, faceInputFromGray(gray, width, height, faceCrop(box, width, height))) : null;
  return { face, emotions };
}
