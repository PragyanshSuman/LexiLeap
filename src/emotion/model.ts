/**
 * Pure TypeScript inference for the original app's facial-expression model (mini-XCEPTION trained on
 * FER-2013, from the `fer` package the original server used). 64×64 grayscale face in, 7 expression
 * probabilities out. Batch norm is folded into the convolutions by scripts/export-emotion-model.py.
 * About 58k weights, so it runs in a fraction of a second without native code.
 */

export const FACE_SIZE = 64;
export const EMOTIONS = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral'] as const;
export type Emotion = (typeof EMOTIONS)[number];
export type EmotionScores = Record<Emotion, number>;

const MAGIC = 'LXEM';
const VERSION = 1;
const BLOCK_CHANNELS = [16, 32, 64, 128];

/** A feature map, channels last. */
interface Tensor {
  h: number;
  w: number;
  c: number;
  data: Float32Array;
}

interface Conv {
  /** [kh][kw][in][out] */
  kernel: Float32Array;
  bias: Float32Array;
  k: number;
  cin: number;
  cout: number;
}

interface Separable {
  /** [3][3][in] */
  depthwise: Float32Array;
  /** [in][out] */
  pointwise: Float32Array;
  bias: Float32Array;
  cin: number;
  cout: number;
}

interface Block {
  shortcut: Conv;
  sep1: Separable;
  sep2: Separable;
}

export interface EmotionModel {
  conv1: Conv;
  conv2: Conv;
  blocks: Block[];
  final: Conv;
}

/** Reads the weights file; throws if it's not the expected format or size. */
export function parseEmotionModel(buffer: ArrayBuffer): EmotionModel {
  const bytes = new Uint8Array(buffer);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== MAGIC || new DataView(buffer).getUint32(4, true) !== VERSION) {
    throw new Error('Unknown emotion model format');
  }
  let offset = 8;
  const floats = (count: number) => {
    if (offset + count * 4 > buffer.byteLength) throw new Error('Emotion model file is too short');
    const view = new DataView(buffer, offset, count * 4);
    offset += count * 4;
    return Float32Array.from({ length: count }, (_, i) => view.getFloat32(i * 4, true));
  };
  const conv = (k: number, cin: number, cout: number): Conv => ({ kernel: floats(k * k * cin * cout), bias: floats(cout), k, cin, cout });
  const separable = (cin: number, cout: number): Separable => ({ depthwise: floats(9 * cin), pointwise: floats(cin * cout), bias: floats(cout), cin, cout });

  const conv1 = conv(3, 1, 8);
  const conv2 = conv(3, 8, 8);
  let cin = 8;
  const blocks = BLOCK_CHANNELS.map((c) => {
    const block = { shortcut: conv(1, cin, c), sep1: separable(cin, c), sep2: separable(c, c) };
    cin = c;
    return block;
  });
  const final = conv(3, 128, EMOTIONS.length);
  if (offset !== buffer.byteLength) throw new Error('Emotion model file has unexpected extra data');
  return { conv1, conv2, blocks, final };
}

/** TensorFlow's "same" padding: output size and padding before, for a kernel and stride. */
function same(size: number, k: number, stride: number) {
  const out = Math.ceil(size / stride);
  const total = Math.max((out - 1) * stride + k - size, 0);
  return { out, before: Math.floor(total / 2) };
}

function conv2d(x: Tensor, layer: Conv, stride: number, padding: 'same' | 'valid'): Tensor {
  const { k, cin, cout, kernel, bias } = layer;
  const sh = padding === 'same' ? same(x.h, k, stride) : { out: Math.floor((x.h - k) / stride) + 1, before: 0 };
  const sw = padding === 'same' ? same(x.w, k, stride) : { out: Math.floor((x.w - k) / stride) + 1, before: 0 };
  const out = new Float32Array(sh.out * sw.out * cout);
  for (let oy = 0; oy < sh.out; oy++) {
    for (let ox = 0; ox < sw.out; ox++) {
      const o = (oy * sw.out + ox) * cout;
      for (let co = 0; co < cout; co++) out[o + co] = bias[co];
      for (let ky = 0; ky < k; ky++) {
        const iy = oy * stride + ky - sh.before;
        if (iy < 0 || iy >= x.h) continue;
        for (let kx = 0; kx < k; kx++) {
          const ix = ox * stride + kx - sw.before;
          if (ix < 0 || ix >= x.w) continue;
          const xi = (iy * x.w + ix) * cin;
          const ki = (ky * k + kx) * cin * cout;
          for (let ci = 0; ci < cin; ci++) {
            const v = x.data[xi + ci];
            if (v === 0) continue;
            const kr = ki + ci * cout;
            for (let co = 0; co < cout; co++) out[o + co] += v * kernel[kr + co];
          }
        }
      }
    }
  }
  return { h: sh.out, w: sw.out, c: cout, data: out };
}

/** Depthwise 3×3 ("same", stride 1) then pointwise 1×1 with the folded bias. */
function separableConv(x: Tensor, layer: Separable): Tensor {
  const { cin, cout, depthwise, pointwise, bias } = layer;
  const depth = new Float32Array(x.h * x.w * cin);
  for (let y = 0; y < x.h; y++) {
    for (let xx = 0; xx < x.w; xx++) {
      const o = (y * x.w + xx) * cin;
      for (let ky = 0; ky < 3; ky++) {
        const iy = y + ky - 1;
        if (iy < 0 || iy >= x.h) continue;
        for (let kx = 0; kx < 3; kx++) {
          const ix = xx + kx - 1;
          if (ix < 0 || ix >= x.w) continue;
          const xi = (iy * x.w + ix) * cin;
          const ki = (ky * 3 + kx) * cin;
          for (let ci = 0; ci < cin; ci++) depth[o + ci] += x.data[xi + ci] * depthwise[ki + ci];
        }
      }
    }
  }
  const out = new Float32Array(x.h * x.w * cout);
  for (let p = 0; p < x.h * x.w; p++) {
    const o = p * cout;
    const di = p * cin;
    for (let co = 0; co < cout; co++) out[o + co] = bias[co];
    for (let ci = 0; ci < cin; ci++) {
      const v = depth[di + ci];
      if (v === 0) continue;
      const kr = ci * cout;
      for (let co = 0; co < cout; co++) out[o + co] += v * pointwise[kr + co];
    }
  }
  return { h: x.h, w: x.w, c: cout, data: out };
}

function relu(x: Tensor): Tensor {
  for (let i = 0; i < x.data.length; i++) if (x.data[i] < 0) x.data[i] = 0;
  return x;
}

/** 3×3 max pooling, stride 2, "same" padding. */
function maxPool(x: Tensor): Tensor {
  const sh = same(x.h, 3, 2);
  const sw = same(x.w, 3, 2);
  const out = new Float32Array(sh.out * sw.out * x.c).fill(-Infinity);
  for (let oy = 0; oy < sh.out; oy++) {
    for (let ox = 0; ox < sw.out; ox++) {
      const o = (oy * sw.out + ox) * x.c;
      for (let ky = 0; ky < 3; ky++) {
        const iy = oy * 2 + ky - sh.before;
        if (iy < 0 || iy >= x.h) continue;
        for (let kx = 0; kx < 3; kx++) {
          const ix = ox * 2 + kx - sw.before;
          if (ix < 0 || ix >= x.w) continue;
          const xi = (iy * x.w + ix) * x.c;
          for (let c = 0; c < x.c; c++) if (x.data[xi + c] > out[o + c]) out[o + c] = x.data[xi + c];
        }
      }
    }
  }
  return { h: sh.out, w: sw.out, c: x.c, data: out };
}

function add(a: Tensor, b: Tensor): Tensor {
  for (let i = 0; i < a.data.length; i++) a.data[i] += b.data[i];
  return a;
}

/**
 * Runs the model on a 64×64 grayscale face (row-major, values -1..1 as in the original's
 * preprocessing). Returns the probability of each expression.
 */
export function runEmotionModel(model: EmotionModel, face: Float32Array): EmotionScores {
  if (face.length !== FACE_SIZE * FACE_SIZE) throw new Error('Expected a 64×64 face');
  let x: Tensor = { h: FACE_SIZE, w: FACE_SIZE, c: 1, data: Float32Array.from(face) };
  x = relu(conv2d(x, model.conv1, 1, 'valid'));
  x = relu(conv2d(x, model.conv2, 1, 'valid'));
  for (const block of model.blocks) {
    const shortcut = conv2d(x, block.shortcut, 2, 'same');
    let y = relu(separableConv(x, block.sep1));
    y = maxPool(separableConv(y, block.sep2));
    x = add(y, shortcut);
  }
  const logits = conv2d(x, model.final, 1, 'same');
  // Global average pooling, then softmax.
  const pooled = new Array<number>(logits.c).fill(0);
  for (let p = 0; p < logits.h * logits.w; p++) for (let c = 0; c < logits.c; c++) pooled[c] += logits.data[p * logits.c + c] / (logits.h * logits.w);
  const max = Math.max(...pooled);
  const exps = pooled.map((v) => Math.exp(v - max));
  const sum = exps.reduce((s, v) => s + v, 0);
  return Object.fromEntries(EMOTIONS.map((e, i) => [e, exps[i] / sum])) as EmotionScores;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The part of the photo to give the model, as the original prepared it: a square around the face with
 * a small margin (the original added 10 px around faces in ~640 px photos), kept inside the photo.
 */
export function faceCrop(face: Rect, imageWidth: number, imageHeight: number): Rect {
  const side = Math.max(face.width, face.height) * 1.16;
  const size = Math.max(1, Math.min(side, imageWidth, imageHeight));
  const cx = face.x + face.width / 2;
  const cy = face.y + face.height / 2;
  const x = Math.min(Math.max(0, cx - size / 2), imageWidth - size);
  const y = Math.min(Math.max(0, cy - size / 2), imageHeight - size);
  return { x: Math.round(x), y: Math.round(y), width: Math.round(size), height: Math.round(size) };
}

/**
 * Turns an RGBA face crop into the model's input: luminance (OpenCV's weights, as the original's
 * BGR→gray), resized to 64×64 if needed (bilinear), scaled to -1..1.
 */
export function faceInput(rgba: Uint8Array, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) gray[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  const at = (x: number, y: number) => gray[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))];
  const out = new Float32Array(FACE_SIZE * FACE_SIZE);
  const sx = width / FACE_SIZE;
  const sy = height / FACE_SIZE;
  for (let j = 0; j < FACE_SIZE; j++) {
    for (let i = 0; i < FACE_SIZE; i++) {
      const x = (i + 0.5) * sx - 0.5;
      const y = (j + 0.5) * sy - 0.5;
      const fx = Math.floor(x);
      const fy = Math.floor(y);
      const ax = x - fx;
      const ay = y - fy;
      const v = at(fx, fy) * (1 - ax) * (1 - ay) + at(fx + 1, fy) * ax * (1 - ay) + at(fx, fy + 1) * (1 - ax) * ay + at(fx + 1, fy + 1) * ax * ay;
      out[j * FACE_SIZE + i] = (v / 255) * 2 - 1;
    }
  }
  return out;
}

/** The model's input cut straight from a grayscale photo (0–255): the face crop, resized to 64×64, scaled to -1..1. */
export function faceInputFromGray(gray: ArrayLike<number>, width: number, height: number, crop: Rect): Float32Array {
  const out = new Float32Array(FACE_SIZE * FACE_SIZE);
  const sx = crop.width / FACE_SIZE;
  const sy = crop.height / FACE_SIZE;
  const at = (x: number, y: number) => gray[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))];
  for (let j = 0; j < FACE_SIZE; j++) {
    for (let i = 0; i < FACE_SIZE; i++) {
      const x = crop.x + (i + 0.5) * sx - 0.5;
      const y = crop.y + (j + 0.5) * sy - 0.5;
      const fx = Math.floor(x);
      const fy = Math.floor(y);
      const ax = x - fx;
      const ay = y - fy;
      const v = at(fx, fy) * (1 - ax) * (1 - ay) + at(fx + 1, fy) * ax * (1 - ay) + at(fx, fy + 1) * (1 - ax) * ay + at(fx + 1, fy + 1) * ax * ay;
      out[j * FACE_SIZE + i] = (v / 255) * 2 - 1;
    }
  }
  return out;
}

/** 0–255 luminance from RGBA pixels (OpenCV's weights, as the original's BGR→gray). */
export function rgbaToGray(rgba: ArrayLike<number>, width: number, height: number): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) gray[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
  return gray;
}
