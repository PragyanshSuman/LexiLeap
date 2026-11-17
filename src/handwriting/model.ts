/**
 * Pure TypeScript inference for the original handwriting model ("Micro-Dyslexia-CNN-62").
 * Three 3×3 convolutions (batch norm folded in) → a letter head (62 classes), an orientation head
 * (normal / reversed / corrected) and a dyslexia-risk head. No native code, so it runs in Expo Go.
 * The weights file is made by scripts/export-handwriting-model.py; its header gives the model's
 * width (64 for the original, smaller for a distilled student).
 */

export const IMAGE_SIZE = 28;
const MAGIC = 'LXHW';
const VERSION = 2;

interface Layer {
  weights: Float32Array;
  bias: Float32Array;
  out: number;
  in: number;
}

export interface HandwritingModel {
  conv: [Layer, Layer, Layer];
  identity: [Layer, Layer];
  orientation: Layer;
  risk: Layer;
}

export interface ModelOutput {
  /** One score per class in CLASSES order (before softmax). */
  logits: Float32Array;
  /** Normal, reversed, corrected (before softmax). */
  orientation: Float32Array;
  /** 0 (safe) to 1 (high risk). */
  risk: number;
}

/** [out, in × kernel area] for each layer, in file order, for a model of the given width. */
const shapes = (width: number): [number, number][] => [
  [width, 1 * 9],
  [width * 2, width * 9],
  [width * 4, width * 2 * 9],
  [128, width * 4],
  [62, 128],
  [3, width * 4],
  [1, width * 4],
];

/** Reads the weights file; throws if it's not the expected format. */
export function parseModel(buffer: ArrayBuffer): HandwritingModel {
  const bytes = new Uint8Array(buffer);
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  const header = new DataView(buffer, 0, 12);
  if (magic !== MAGIC || header.getUint32(4, true) !== VERSION) throw new Error('Unknown handwriting model format');
  const width = header.getUint32(8, true);

  let offset = 12;
  const floats = (count: number) => {
    const view = new DataView(buffer, offset, count * 4);
    offset += count * 4;
    return Float32Array.from({ length: count }, (_, i) => view.getFloat32(i * 4, true));
  };
  const layers = shapes(width).map(([out, inSize]) => {
    const scales = floats(out);
    const bias = floats(out);
    const quantized = new Int8Array(buffer, offset, out * inSize);
    offset += out * inSize;
    const weights = new Float32Array(out * inSize);
    for (let o = 0; o < out; o++) {
      for (let i = 0; i < inSize; i++) weights[o * inSize + i] = quantized[o * inSize + i] * scales[o];
    }
    return { weights, bias, out, in: inSize };
  });
  if (offset !== buffer.byteLength) throw new Error('Handwriting model file is the wrong size');
  const [c1, c2, c3, id1, id2, orientation, risk] = layers;
  return { conv: [c1, c2, c3], identity: [id1, id2], orientation, risk };
}

/** 3×3 convolution with padding 1, followed by ReLU. Input and output are channel-major planes. */
function conv3x3Relu(input: Float32Array, channels: number, size: number, layer: Layer): Float32Array {
  const padded = size + 2;
  const plane = size * size;
  // Zero-padded copy, so the inner loop needs no bounds checks.
  const src = new Float32Array(channels * padded * padded);
  for (let c = 0; c < channels; c++) {
    for (let y = 0; y < size; y++) {
      src.set(input.subarray(c * plane + y * size, c * plane + (y + 1) * size), c * padded * padded + (y + 1) * padded + 1);
    }
  }
  const output = new Float32Array(layer.out * plane);
  const w = layer.weights;
  for (let o = 0; o < layer.out; o++) {
    const acc = output.subarray(o * plane, (o + 1) * plane);
    acc.fill(layer.bias[o]);
    for (let c = 0; c < channels; c++) {
      const k = (o * channels + c) * 9;
      const w0 = w[k], w1 = w[k + 1], w2 = w[k + 2], w3 = w[k + 3], w4 = w[k + 4], w5 = w[k + 5], w6 = w[k + 6], w7 = w[k + 7], w8 = w[k + 8];
      const base = c * padded * padded;
      for (let y = 0; y < size; y++) {
        // Slide a 3×3 window along the row, loading one new column per step (fewer reads on Hermes).
        let i0 = base + y * padded;
        let i1 = i0 + padded;
        let i2 = i1 + padded;
        let a0 = src[i0], a1 = src[i0 + 1], b0 = src[i1], b1 = src[i1 + 1], c0 = src[i2], c1 = src[i2 + 1];
        i0 += 2;
        i1 += 2;
        i2 += 2;
        for (let x = y * size, end = x + size; x < end; x++) {
          const a2 = src[i0++], b2 = src[i1++], c2 = src[i2++];
          acc[x] += w0 * a0 + w1 * a1 + w2 * a2 + w3 * b0 + w4 * b1 + w5 * b2 + w6 * c0 + w7 * c1 + w8 * c2;
          a0 = a1; a1 = a2; b0 = b1; b1 = b2; c0 = c1; c1 = c2;
        }
      }
    }
    for (let i = 0; i < plane; i++) if (acc[i] < 0) acc[i] = 0;
  }
  return output;
}

function maxPool2(input: Float32Array, channels: number, size: number): Float32Array {
  const half = size / 2;
  const output = new Float32Array(channels * half * half);
  for (let c = 0; c < channels; c++) {
    for (let y = 0; y < half; y++) {
      for (let x = 0; x < half; x++) {
        const i = c * size * size + 2 * y * size + 2 * x;
        output[c * half * half + y * half + x] = Math.max(input[i], input[i + 1], input[i + size], input[i + size + 1]);
      }
    }
  }
  return output;
}

function globalAverage(input: Float32Array, channels: number, size: number): Float32Array {
  const plane = size * size;
  const output = new Float32Array(channels);
  for (let c = 0; c < channels; c++) {
    let sum = 0;
    for (let i = 0; i < plane; i++) sum += input[c * plane + i];
    output[c] = sum / plane;
  }
  return output;
}

function dense(input: Float32Array, layer: Layer, relu = false): Float32Array {
  const output = new Float32Array(layer.out);
  for (let o = 0; o < layer.out; o++) {
    let sum = layer.bias[o];
    for (let i = 0; i < layer.in; i++) sum += layer.weights[o * layer.in + i] * input[i];
    output[o] = relu && sum < 0 ? 0 : sum;
  }
  return output;
}

/** Runs the model on a 28×28 image (0 = background, 1 = ink) in the model's own (EMNIST) layout. */
export function runModel(model: HandwritingModel, image: Float32Array): ModelOutput {
  const [c1, c2, c3] = model.conv;
  const x0 = image.map((v) => (v - 0.5) / 0.5);
  const x1 = maxPool2(conv3x3Relu(x0, 1, 28, c1), c1.out, 28);
  const x2 = maxPool2(conv3x3Relu(x1, c1.out, 14, c2), c2.out, 14);
  const features = globalAverage(conv3x3Relu(x2, c2.out, 7, c3), c3.out, 7);
  const logits = dense(dense(features, model.identity[0], true), model.identity[1]);
  const orientation = dense(features, model.orientation);
  const risk = 1 / (1 + Math.exp(-dense(features, model.risk)[0]));
  return { logits, orientation, risk };
}

export function softmax(values: ArrayLike<number>): number[] {
  const max = Math.max(...Array.from(values));
  const exps = Array.from(values, (v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}
