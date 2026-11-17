"""
Exports the handwriting model to a compact file the app runs in plain TypeScript: either the original
UnifiedLearningApp model ("Micro-Dyslexia-CNN-62", trained on EMNIST ByClass + a synthetic dyslexia
set) or a smaller student distilled from it by scripts/train-handwriting-student.py.

  python scripts/export-handwriting-model.py ../UnifiedLearningApp/backend/ml_training [checkpoint.pth]

Writes
  assets/models/handwriting.bin   batch norm folded into the convolutions, int8 weights with one
                                  float32 scale per output channel, float32 biases
  jest/handwritingVectors.json    a few EMNIST test images with the expected outputs, so the
                                  TypeScript port is checked against this reference

File layout (little endian): b"LXHW", uint32 version, uint32 width, then for each layer in LAYERS order:
float32 scales[out], float32 bias[out], int8 weights[out * in * k * k].
"""
import json
import os
import struct
import sys

import numpy as np
import torch

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'UnifiedLearningApp', 'backend', 'ml_training')
CHECKPOINT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(SOURCE, 'unbreakable_dyslexia_62class.pth')
VERSION = 2
EPS = 1e-5

# (state dict prefix, batch norm prefix or None)
LAYERS = [
    ('backbone.0', 'backbone.1'),
    ('backbone.4', 'backbone.5'),
    ('backbone.8', 'backbone.9'),
    ('identity_head.1', None),
    ('identity_head.3', None),
    ('orientation_head.1', None),
    ('risk_head.1', None),
]


def idx(path):
    data = open(path, 'rb').read()
    dims = data[3]
    shape = [int.from_bytes(data[4 + 4 * i:8 + 4 * i], 'big') for i in range(dims)]
    return np.frombuffer(data, np.uint8, offset=4 + 4 * dims).reshape(shape)


def fold(sd, name, bn):
    w = sd[f'{name}.weight'].numpy().astype(np.float64)
    b = sd[f'{name}.bias'].numpy().astype(np.float64)
    if bn:
        k = sd[f'{bn}.weight'].numpy() / np.sqrt(sd[f'{bn}.running_var'].numpy() + EPS)
        w = w * k.reshape(-1, *([1] * (w.ndim - 1)))
        b = (b - sd[f'{bn}.running_mean'].numpy()) * k + sd[f'{bn}.bias'].numpy()
    return w, b


def quantize(w):
    flat = w.reshape(w.shape[0], -1)
    scale = np.abs(flat).max(axis=1) / 127.0
    scale[scale == 0] = 1.0
    q = np.clip(np.round(flat / scale[:, None]), -127, 127).astype(np.int8)
    return q, scale.astype(np.float32)


def conv(x, w, b):
    """3x3, padding 1. x: (in, h, w)."""
    cin, h, wd = x.shape
    p = np.pad(x, ((0, 0), (1, 1), (1, 1)))
    cols = np.stack([p[:, i:i + h, j:j + wd] for i in range(3) for j in range(3)], axis=1)  # (in, 9, h, w)
    out = np.tensordot(w.reshape(w.shape[0], cin, 9), cols, axes=([1, 2], [0, 1]))
    return out + b[:, None, None]


def pool(x):
    c, h, w = x.shape
    return x.reshape(c, h // 2, 2, w // 2, 2).max(axis=(2, 4))


def forward(layers, image):
    """image: (28, 28) uint8 in the raw EMNIST layout."""
    x = (image.astype(np.float32) / 255.0 - 0.5) / 0.5
    x = x[None]
    for i in range(3):
        w, b = layers[i]
        x = np.maximum(conv(x, w, b), 0)
        x = pool(x) if i < 2 else x.mean(axis=(1, 2))
    (w1, b1), (w2, b2), (wo, bo), (wr, br) = layers[3:]
    logits = w2 @ np.maximum(w1 @ x + b1, 0) + b2
    return logits, wo @ x + bo, 1 / (1 + np.exp(-(wr @ x + br)))


def main():
    ckpt = torch.load(CHECKPOINT, map_location='cpu', weights_only=False)
    sd = ckpt['model_state_dict']
    width = sd['backbone.0.weight'].shape[0]

    blob = bytearray(b'LXHW' + struct.pack('<II', VERSION, width))
    layers = []
    for name, bn in LAYERS:
        w, b = fold(sd, name, bn)
        q, scale = quantize(w)
        blob += scale.astype('<f4').tobytes() + b.astype('<f4').tobytes() + q.tobytes()
        layers.append(((q.astype(np.float32) * scale[:, None]).reshape(w.shape), b.astype(np.float32)))

    out = os.path.join(ROOT, 'assets', 'models', 'handwriting.bin')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'wb') as f:
        f.write(blob)
    print(f'wrote {out} (width {width}, {len(blob) / 1024:.0f} KB)')

    images = idx(os.path.join(SOURCE, 'data', 'EMNIST', 'raw', 'emnist-byclass-test-images-idx3-ubyte'))
    labels = idx(os.path.join(SOURCE, 'data', 'EMNIST', 'raw', 'emnist-byclass-test-labels-idx1-ubyte'))
    n = 3000
    preds = np.array([forward(layers, images[i])[0].argmax() for i in range(n)])
    letters = labels[:n] >= 10
    print(f'int8 accuracy on {n} EMNIST test images: {(preds == labels[:n]).mean():.3f} (letters {(preds[letters] == labels[:n][letters]).mean():.3f})')

    vectors = []
    for i in range(4):
        logits, orientation, risk = forward(layers, images[i])
        vectors.append({
            'label': int(labels[i]),
            'pixels': images[i].flatten().tolist(),
            'logits': [round(float(v), 4) for v in logits],
            'orientation': [round(float(v), 4) for v in orientation],
            'risk': round(float(risk[0]), 4),
        })
    with open(os.path.join(ROOT, 'jest', 'handwritingVectors.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(vectors, f)
    print('wrote jest/handwritingVectors.json')


if __name__ == '__main__':
    main()
