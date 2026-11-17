"""
Exports the original app's facial-expression model to a compact file the app runs in plain TypeScript.

The original UnifiedLearningApp sent camera photos to its Python server, which classified them with the
`fer` package (mini-XCEPTION trained on FER-2013, 7 expressions, MIT licence; model by Octavio Arriaga,
oarriaga/face_classification). LexiLeap runs the same model on the device instead.

  pip download fer==22.5.1 --no-deps -d /tmp/fer && unzip -o /tmp/fer/fer-22.5.1-py3-none-any.whl -d /tmp/fer
  python scripts/export-emotion-model.py /tmp/fer/fer/data/emotion_model.hdf5

Needs tensorflow (to read the model and compute the reference outputs) and numpy.

Writes
  assets/models/emotion.bin    batch norm folded into the convolutions, float32 weights
  jest/emotionVectors.json     a few inputs with Keras's outputs, so the TypeScript port is checked

File layout (little endian): b"LXEM", uint32 version, then float32 tensors in the order of `tensors()`:
  conv1 [3,3,1,8] + bias, conv2 [3,3,8,8] + bias,
  4 residual blocks (channels 16, 32, 64, 128), each: shortcut [1,1,in,c] + bias,
    separable 1: depthwise [3,3,in] + pointwise [in,c] + bias, separable 2: depthwise [3,3,c] + pointwise [c,c] + bias,
  final conv [3,3,128,7] + bias.
Kernels are stored in Keras order (height, width, in, out).
"""
import json
import os
import struct
import sys

os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '3')
import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERSION = 1
LABELS = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']

# (shortcut conv, its batch norm, separable 1, its bn, separable 2, its bn) per residual block.
BLOCKS = [
    ('conv2d_3', 'batch_normalization_3', 'separable_conv2d_1', 'batch_normalization_4', 'separable_conv2d_2', 'batch_normalization_5'),
    ('conv2d_4', 'batch_normalization_6', 'separable_conv2d_3', 'batch_normalization_7', 'separable_conv2d_4', 'batch_normalization_8'),
    ('conv2d_5', 'batch_normalization_9', 'separable_conv2d_5', 'batch_normalization_10', 'separable_conv2d_6', 'batch_normalization_11'),
    ('conv2d_6', 'batch_normalization_12', 'separable_conv2d_7', 'batch_normalization_13', 'separable_conv2d_8', 'batch_normalization_14'),
]


def bn_factors(model, name):
    layer = model.get_layer(name)
    gamma, beta, mean, var = [w.astype(np.float64) for w in layer.get_weights()]
    k = gamma / np.sqrt(var + layer.epsilon)
    return k, beta - mean * k


def folded_conv(model, conv, bn):
    """Conv kernel [h,w,in,out] and bias with the following batch norm folded in."""
    w = model.get_layer(conv).get_weights()[0].astype(np.float64)
    k, b = bn_factors(model, bn)
    return w * k, b


def folded_separable(model, conv, bn):
    depthwise, pointwise = [w.astype(np.float64) for w in model.get_layer(conv).get_weights()]
    k, b = bn_factors(model, bn)
    # depthwise [3,3,in,1] -> [3,3,in]; pointwise [1,1,in,out] -> [in,out]
    return depthwise[:, :, :, 0], pointwise[0, 0] * k, b


def tensors(model):
    out = []
    for conv, bn in (('conv2d_1', 'batch_normalization_1'), ('conv2d_2', 'batch_normalization_2')):
        out += list(folded_conv(model, conv, bn))
    for shortcut, shortcut_bn, sep1, bn1, sep2, bn2 in BLOCKS:
        out += list(folded_conv(model, shortcut, shortcut_bn))
        out += list(folded_separable(model, sep1, bn1))
        out += list(folded_separable(model, sep2, bn2))
    final_w, final_b = model.get_layer('conv2d_7').get_weights()
    out += [final_w, final_b]
    return out


def reference_inputs():
    """Deterministic 64×64 inputs in the model's range (-1..1): smooth shapes and noise."""
    rng = np.random.default_rng(7)
    y, x = np.mgrid[0:64, 0:64] / 63.0
    face_like = np.exp(-(((x - 0.5) ** 2) / 0.08 + ((y - 0.5) ** 2) / 0.12))
    face_like -= 0.6 * (np.exp(-(((x - 0.35) ** 2 + (y - 0.4) ** 2) / 0.003)) + np.exp(-(((x - 0.65) ** 2 + (y - 0.4) ** 2) / 0.003)))
    face_like -= 0.5 * np.exp(-(((x - 0.5) ** 2) / 0.02 + ((y - 0.72) ** 2) / 0.002))
    inputs = [face_like * 2 - 1, (x + y) - 1, rng.uniform(-1, 1, (64, 64)), np.zeros((64, 64))]
    return [np.clip(i, -1, 1).astype(np.float32) for i in inputs]


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    model = tf.keras.models.load_model(sys.argv[1], compile=False)
    assert model.input_shape == (None, 64, 64, 1) and model.output_shape == (None, 7), 'unexpected model'

    parts = tensors(model)
    out_path = os.path.join(ROOT, 'assets', 'models', 'emotion.bin')
    with open(out_path, 'wb') as f:
        f.write(b'LXEM' + struct.pack('<I', VERSION))
        for t in parts:
            f.write(np.ascontiguousarray(t, dtype='<f4').tobytes())
    print(f'wrote {out_path} ({os.path.getsize(out_path)} bytes, {sum(t.size for t in parts)} weights)')

    inputs = reference_inputs()
    outputs = model.predict(np.stack(inputs)[..., None], verbose=0)
    vectors = [{'input': [round(float(v), 5) for v in i.flatten()], 'output': [round(float(v), 6) for v in o]} for i, o in zip(inputs, outputs)]
    vec_path = os.path.join(ROOT, 'jest', 'emotionVectors.json')
    with open(vec_path, 'w') as f:
        json.dump({'labels': LABELS, 'vectors': vectors}, f)
    print(f'wrote {vec_path}')
    for i, o in enumerate(outputs):
        print(i, LABELS[int(np.argmax(o))], np.round(o, 3))


if __name__ == '__main__':
    main()
