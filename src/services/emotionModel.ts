import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { parseCascade, type FaceCascade } from '@/emotion/faceDetector';
import { faceCrop, faceInput, FACE_SIZE, parseEmotionModel, rgbaToGray, runEmotionModel, type EmotionModel, type EmotionScores, type Rect } from '@/emotion/model';
import { readFaceFromGray } from '@/emotion/readFace';
import type { FaceReading } from '@/engine/focus';
import cascadeAsset from '../../assets/models/face.bin';
import modelAsset from '../../assets/models/emotion.bin';

let loading: Promise<EmotionModel> | null = null;

/** Loads the bundled facial-expression model (~225 KB) once, on first use. */
export function loadEmotionModel(): Promise<EmotionModel> {
  if (!loading) {
    loading = (async () => {
      const [asset] = await Asset.loadAsync(modelAsset);
      return parseEmotionModel(await new File(asset.localUri ?? asset.uri).arrayBuffer());
    })().catch((error) => {
      loading = null; // allow a retry
      throw error;
    });
  }
  return loading;
}

/** Set when the model can't be loaded on this device, so the Focus helper uses attention only. */
let broken = false;

/**
 * Reads the expression on the face in a photo: crops the face and shrinks it to 64×64 natively, then
 * runs the model in JavaScript. Resolves null if anything goes wrong (the reading then uses attention
 * only). The small crop is deleted straight away, like the photo.
 */
export async function readEmotions(photo: { uri: string; width: number; height: number }, face: Rect): Promise<EmotionScores | null> {
  if (broken) return null;
  let model: EmotionModel;
  try {
    model = await loadEmotionModel();
  } catch {
    broken = true;
    return null;
  }
  const crop = faceCrop(face, photo.width, photo.height);
  const context = ImageManipulator.manipulate(photo.uri)
    .crop({ originX: crop.x, originY: crop.y, width: crop.width, height: crop.height })
    .resize({ width: FACE_SIZE, height: FACE_SIZE });
  let uri: string | null = null;
  try {
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
    image.release();
    uri = saved.uri;
    const jpeg = new Uint8Array(await new File(saved.uri).arrayBuffer());
    const { data, width, height } = decode(jpeg, { useTArray: true, formatAsRGBA: true });
    return runEmotionModel(model, faceInput(data, width, height));
  } catch {
    return null;
  } finally {
    context.release();
    if (uri) {
      try {
        new File(uri).delete();
      } catch {
        // Already gone.
      }
    }
  }
}

let cascadeLoading: Promise<FaceCascade> | null = null;

/** Loads the bundled face detector (~95 KB) once, on first use. */
export function loadFaceCascade(): Promise<FaceCascade> {
  if (!cascadeLoading) {
    cascadeLoading = (async () => {
      const [asset] = await Asset.loadAsync(cascadeAsset);
      return parseCascade(await new File(asset.localUri ?? asset.uri).arrayBuffer());
    })().catch((error) => {
      cascadeLoading = null;
      throw error;
    });
  }
  return cascadeLoading;
}

/** Photos are shrunk to this width before looking for a face (fast, and plenty for a face at arm's length). */
const SEARCH_WIDTH = 240;
/**
 * Finds the face and reads its expression entirely in JavaScript (OpenCV's Haar cascade, then the
 * expression model), for when the native face detector isn't available (Expo Go) or fails. Only a
 * near-frontal face is found, so a face counts as facing the screen; eye openness isn't measured.
 * Resolves null when there is no face. The shrunk copy is deleted straight away.
 */
export async function readFaceInJs(photo: { uri: string; width: number; height: number }): Promise<{ face: FaceReading; emotions: EmotionScores | null } | null> {
  const [cascade, model] = await Promise.all([loadFaceCascade(), loadEmotionModel().catch(() => null)]);
  const context = ImageManipulator.manipulate(photo.uri).resize({ width: SEARCH_WIDTH });
  let uri: string | null = null;
  try {
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
    image.release();
    uri = saved.uri;
    const { data, width, height } = decode(new Uint8Array(await new File(saved.uri).arrayBuffer()), { useTArray: true, formatAsRGBA: true });
    return readFaceFromGray(rgbaToGray(data, width, height), width, height, cascade, model, photo.width / width);
  } finally {
    context.release();
    if (uri) {
      try {
        new File(uri).delete();
      } catch {
        // Already gone.
      }
    }
  }
}
