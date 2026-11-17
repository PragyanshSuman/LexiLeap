import { act, render, screen } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';
import { FocusTracker } from '@/components/FocusTracker';
import { detectFaces, parseCascade } from '@/emotion/faceDetector';
import { EMOTIONS, faceCrop, faceInput, parseEmotionModel, runEmotionModel, type EmotionScores } from '@/emotion/model';
import { readFaceFromGray } from '@/emotion/readFace';
import { ACTIVE_SCORE, analyzeActivity, analyzeFace, emotionIndex, needsFocusBreak, summarizeFocus, type FaceReading, type FocusSample } from '@/engine/focus';
import { emptyProgress } from '@/engine/progress';
import { markInteraction } from '@/services/interaction';
import { useAppStore } from '@/store/appStore';
import { DEFAULT_PREFS, type Profile } from '@/store/profile';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return { useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]) };
});
jest.mock('expo-camera', () => ({ useCameraPermissions: () => [{ granted: true }, jest.fn()], CameraView: () => null }));

const ROOT = join(__dirname, '..', '..');

describe('facial-expression model (the original server model, now on the device)', () => {
  const file = readFileSync(join(ROOT, 'assets', 'models', 'emotion.bin'));
  const model = parseEmotionModel(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
  const { labels, vectors } = JSON.parse(readFileSync(join(ROOT, 'jest', 'emotionVectors.json'), 'utf8')) as { labels: string[]; vectors: { input: number[]; output: number[] }[] };

  it('uses the original label order', () => {
    expect(labels).toEqual([...EMOTIONS]);
  });

  it('matches the Keras reference outputs', () => {
    for (const vector of vectors) {
      const scores = runEmotionModel(model, Float32Array.from(vector.input));
      EMOTIONS.forEach((e, i) => expect(scores[e]).toBeCloseTo(vector.output[i], 4));
    }
  });

  it('rejects a damaged weights file', () => {
    expect(() => parseEmotionModel(file.buffer.slice(file.byteOffset, file.byteOffset + 100) as ArrayBuffer)).toThrow();
  });
});

describe('face preprocessing', () => {
  it('crops a square around the face with a margin, inside the photo', () => {
    expect(faceCrop({ x: 100, y: 100, width: 100, height: 120 }, 640, 480)).toEqual({ x: 80, y: 90, width: 139, height: 139 });
    const edge = faceCrop({ x: 600, y: -20, width: 100, height: 100 }, 640, 480);
    expect(edge.x + edge.width).toBeLessThanOrEqual(640);
    expect(edge.y).toBe(0);
  });

  it('turns RGBA pixels into the model range (-1..1) at 64×64', () => {
    const size = 128;
    const white = new Uint8Array(size * size * 4).fill(255);
    const input = faceInput(white, size, size);
    expect(input).toHaveLength(64 * 64);
    expect(input[0]).toBeCloseTo(1);
    const black = faceInput(new Uint8Array(64 * 64 * 4), 64, 64);
    expect(black[100]).toBeCloseTo(-1);
  });
});

const scores = (main: keyof EmotionScores, p: number): EmotionScores => {
  const rest = (1 - p) / 6;
  return Object.fromEntries(EMOTIONS.map((e) => [e, e === main ? p : rest])) as EmotionScores;
};
const facing: FaceReading = { yaw: 0, pitch: 0, smiling: 0.1, leftEyeOpen: 0.9, rightEyeOpen: 0.9 };

describe('reading the face', () => {
  it('keeps the original concentration index', () => {
    expect(emotionIndex(scores('neutral', 1))).toBe(100);
    expect(emotionIndex(scores('angry', 1))).toBe(0);
  });

  it('shows the expression and lowers focus for frustration, sadness and worry', () => {
    const neutral = analyzeFace(facing, scores('neutral', 0.9));
    expect(neutral).toMatchObject({ expression: 'focused', emotion: 'neutral' });
    const angry = analyzeFace(facing, scores('angry', 0.9));
    expect(angry).toMatchObject({ expression: 'frustrated', emotion: 'angry' });
    expect(angry.concentration).toBeLessThan(neutral.concentration);
    expect(analyzeFace(facing, scores('sad', 0.8)).expression).toBe('sad');
    expect(analyzeFace(facing, scores('fear', 0.8)).expression).toBe('worried');
    expect(analyzeFace(facing, scores('surprise', 0.8)).expression).toBe('surprised');
  });

  it('puts looking away and tired eyes first, and ignores an unsure expression', () => {
    expect(analyzeFace({ ...facing, yaw: 45 }, scores('happy', 0.9)).expression).toBe('looking-away');
    expect(analyzeFace({ ...facing, leftEyeOpen: 0.1, rightEyeOpen: 0.1 }, scores('neutral', 0.9)).expression).toBe('tired');
    expect(analyzeFace({ ...facing, smiling: 0.9 }, scores('sad', 0.3)).expression).toBe('happy');
  });

  it('still works without the expression model (attention only)', () => {
    expect(analyzeFace(facing, null)).toEqual({ expression: 'focused', concentration: 100 });
  });
});

describe('touch fallback', () => {
  it('counts recent touches or speech as busy, and a long stop as away', () => {
    expect(analyzeActivity(3000)).toEqual({ expression: 'active', concentration: ACTIVE_SCORE });
    expect(analyzeActivity(60_000)).toEqual({ expression: 'away', concentration: 0 });
  });

  it('suggests a break after several idle readings, but not while the child is busy', () => {
    const now = 1_000_000;
    const at = (i: number, expression: 'active' | 'away'): FocusSample => ({ at: now - (2 - i) * 5000, day: '2026-11-17', feature: 'rhyme', source: 'touch', ...analyzeActivity(expression === 'active' ? 0 : 60_000) });
    expect(needsFocusBreak([0, 1, 2].map((i) => at(i, 'away')), 'rhyme', now)).toBe(true);
    expect(needsFocusBreak([0, 1, 2].map((i) => at(i, 'active')), 'rhyme', now)).toBe(false);
  });

  it('reports where readings came from (older readings were all from the camera)', () => {
    const base = { day: '2026-11-17', feature: 'rhyme' as const };
    const [summary] = summarizeFocus([
      { ...base, at: 1, expression: 'focused', concentration: 90 },
      { ...base, at: 2, expression: 'active', concentration: ACTIVE_SCORE, source: 'touch' },
      { ...base, at: 3, expression: 'frustrated', concentration: 40, source: 'camera', emotion: 'angry' },
    ]);
    expect(summary.sources).toEqual({ camera: 2, touch: 1 });
  });
});

describe('face detection in JavaScript (Expo Go, or when ML Kit fails)', () => {
  const read = (file: string) => {
    const f = readFileSync(join(ROOT, file));
    return f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength) as ArrayBuffer;
  };
  const cascade = parseCascade(read('assets/models/face.bin'));
  const model = parseEmotionModel(read('assets/models/emotion.bin'));
  const { vectors, scaleFactor, minNeighbors, minSize } = JSON.parse(readFileSync(join(ROOT, 'jest', 'faceVectors.json'), 'utf8')) as {
    scaleFactor: number;
    minNeighbors: number;
    minSize: number;
    vectors: { name: string; width: number; height: number; gray: string; opencv: number[][] }[];
  };
  const photo = (name: string) => {
    const v = vectors.find((x) => x.name === name)!;
    return { ...v, pixels: Uint8Array.from(Buffer.from(v.gray, 'base64')) };
  };

  it("finds exactly the faces OpenCV finds", () => {
    for (const v of vectors) {
      const { pixels } = photo(v.name);
      const faces = detectFaces(pixels, v.width, v.height, cascade, { scaleFactor, minNeighbors, minSize });
      expect(faces.map((f) => [f.x, f.y, f.width, f.height])).toEqual(v.opencv);
    }
  });

  it('reads the expression of the face it finds, and nothing when there is no face', () => {
    const astronaut = photo('astronaut');
    const found = readFaceFromGray(astronaut.pixels, astronaut.width, astronaut.height, cascade, model, 2);
    // The same face OpenCV finds (its box, at half size, overlaps ours almost completely).
    const [ox, oy, ow, oh] = astronaut.opencv[0].map((v) => v * 2);
    const b = found!.face.box!;
    const overlap = Math.max(0, Math.min(b.x + b.width, ox + ow) - Math.max(b.x, ox)) * Math.max(0, Math.min(b.y + b.height, oy + oh) - Math.max(b.y, oy));
    expect(overlap / (b.width * b.height + ow * oh - overlap)).toBeGreaterThan(0.7);
    const total = Object.values(found!.emotions!).reduce((sum, p) => sum + p, 0);
    expect(total).toBeCloseTo(1);
    expect(analyzeFace(found!.face, found!.emotions).expression).not.toBe('looking-away');
    const coffee = photo('coffee');
    expect(readFaceFromGray(coffee.pixels, coffee.width, coffee.height, cascade, model)).toBeNull();
  });
});

describe('Focus helper modes', () => {
  const profile: Profile = { id: 'kid', name: 'Ada', avatar: '🦊', age: 7, createdAt: '2026-01-01T00:00:00.000Z', prefs: { ...DEFAULT_PREFS, focusHelper: true } };

  it('uses the camera even without ML Kit (e.g. Expo Go), and takes a touch reading until the camera is ready', async () => {
    useAppStore.setState({ profiles: [profile], activeProfileId: profile.id, parent: null, progress: { [profile.id]: emptyProgress() } });
    markInteraction();
    const { unmount } = await render(<FocusTracker feature="rhyme" />);
    expect(screen.getByLabelText('Focus helper is on')).toBeTruthy();
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 1000)));
    const [reading] = useAppStore.getState().progress[profile.id].focus;
    expect(reading).toMatchObject({ feature: 'rhyme', source: 'touch', expression: 'active', concentration: ACTIVE_SCORE });
    await unmount();
  });

  it('records nothing when a parent has it switched off', async () => {
    useAppStore.setState({ profiles: [{ ...profile, prefs: { ...DEFAULT_PREFS, focusHelper: false } }], activeProfileId: profile.id, parent: null, progress: { [profile.id]: emptyProgress() } });
    const { unmount } = await render(<FocusTracker feature="rhyme" />);
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 1000)));
    expect(useAppStore.getState().progress[profile.id].focus).toHaveLength(0);
    await unmount();
  });
});
