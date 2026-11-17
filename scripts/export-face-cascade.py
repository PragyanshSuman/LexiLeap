"""
Exports OpenCV's frontal-face Haar cascade (the face detector the original app's `fer` package uses by default)
to a compact file the app runs in plain TypeScript, so the Focus helper can find faces even where the native
ML Kit detector isn't available (Expo Go) or fails.

  python scripts/export-face-cascade.py [path/to/test/photos]

Needs opencv-python (for the cascade and the reference detections) and numpy.

Writes
  assets/models/face.bin            the cascade (25 stages, 2913 stumps), little endian:
                                    b"LXHC", uint32 version, uint16 window w, h, uint16 stage count, uint16 feature count;
                                    features: uint8 rect count, then per rect uint8 x, y, w, h + float32 weight;
                                    stages: uint16 stump count, float32 threshold, then per stump uint16 feature,
                                    float32 threshold, float32 left, float32 right.
  assets/models/OPENCV-LICENSE.txt  the cascade's licence (Intel License Agreement), which must ship with it
  jest/faceVectors.json             small grayscale test photos with OpenCV's own detections

The test photos are scikit-image's public-domain "astronaut" (NASA) and "coffee" images; pass the folder
holding astronaut.png and coffee.png.
"""
import base64
import json
import os
import re
import struct
import sys
import xml.etree.ElementTree as ET

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CASCADE = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
VERSION = 1
# Detection settings shared by the app and the reference.
SCALE_FACTOR = 1.2
MIN_NEIGHBORS = 3
MIN_SIZE = 30
TEST_WIDTH = 200


def parse(path):
    root = ET.parse(path).getroot().find('cascade')
    width, height = int(root.find('width').text), int(root.find('height').text)
    stages = []
    for stage in root.find('stages'):
        threshold = float(stage.find('stageThreshold').text)
        stumps = []
        for weak in stage.find('weakClassifiers'):
            nodes = weak.find('internalNodes').text.split()
            leaves = [float(v) for v in weak.find('leafValues').text.split()]
            assert len(nodes) == 4 and len(leaves) == 2, 'only stumps are supported'
            stumps.append((int(nodes[2]), float(nodes[3]), leaves[0], leaves[1]))
        stages.append((threshold, stumps))
    features = []
    for feature in root.find('features'):
        assert feature.find('tilted') is None or feature.find('tilted').text.strip() == '0', 'tilted features unsupported'
        rects = []
        for r in feature.find('rects'):
            x, y, w, h, weight = r.text.split()
            rects.append((int(x), int(y), int(w), int(h), float(weight)))
        features.append(rects)
    return width, height, stages, features


def license_text(path):
    text = open(path).read()
    comment = re.search(r'<!--(.*?)-->', text, re.S)
    return comment.group(1).strip() + '\n'


def write_binary(width, height, stages, features, path):
    with open(path, 'wb') as f:
        f.write(b'LXHC' + struct.pack('<IHHHH', VERSION, width, height, len(stages), len(features)))
        for rects in features:
            f.write(struct.pack('<B', len(rects)))
            for x, y, w, h, weight in rects:
                f.write(struct.pack('<BBBBf', x, y, w, h, weight))
        for threshold, stumps in stages:
            f.write(struct.pack('<Hf', len(stumps), threshold))
            for feature, t, left, right in stumps:
                f.write(struct.pack('<Hfff', feature, t, left, right))


# ── Reference implementation of exactly what the app does (checked against OpenCV below) ─────────────────

def integral(img):
    ii = np.zeros((img.shape[0] + 1, img.shape[1] + 1), np.float64)
    ii[1:, 1:] = img.astype(np.float64).cumsum(0).cumsum(1)
    return ii


def rect_sum(ii, x, y, w, h):
    return ii[y + h, x + w] - ii[y, x + w] - ii[y + h, x] + ii[y, x]


def detect(gray, cascade):
    width, height, stages, features = cascade
    rects = []
    factor = 1.0
    while gray.shape[1] / factor >= width and gray.shape[0] / factor >= height:
        if width * factor >= MIN_SIZE:
            sw, sh = int(round(gray.shape[1] / factor)), int(round(gray.shape[0] / factor))
            img = cv2.resize(gray, (sw, sh), interpolation=cv2.INTER_LINEAR)
            ii, sq = integral(img), integral(img.astype(np.float64) ** 2)
            step = 1 if factor > 2 else 2
            area = (width - 2) * (height - 2)
            for y in range(0, sh - height + 1, step):
                for x in range(0, sw - width + 1, step):
                    s = rect_sum(ii, x + 1, y + 1, width - 2, height - 2)
                    q = rect_sum(sq, x + 1, y + 1, width - 2, height - 2)
                    nf = area * q - s * s
                    nf = np.sqrt(nf) if nf > 0 else 1.0
                    ok = True
                    for threshold, stumps in stages:
                        total = 0.0
                        for fi, t, left, right in stumps:
                            v = sum(wt * rect_sum(ii, x + rx, y + ry, rw, rh) for rx, ry, rw, rh, wt in features[fi]) / nf
                            total += left if v < t else right
                        if total < threshold:
                            ok = False
                            break
                    if ok:
                        rects.append([int(round(x * factor)), int(round(y * factor)), int(round(width * factor)), int(round(height * factor))])
        factor *= SCALE_FACTOR
    grouped, _ = cv2.groupRectangles(rects, MIN_NEIGHBORS, 0.2) if rects else ([], None)
    return [list(map(int, r)) for r in grouped]


def main():
    photos = sys.argv[1] if len(sys.argv) > 1 else None
    cascade = parse(CASCADE)
    out = os.path.join(ROOT, 'assets', 'models', 'face.bin')
    write_binary(*cascade, out)
    open(os.path.join(ROOT, 'assets', 'models', 'OPENCV-LICENSE.txt'), 'w').write(
        'The face detector in face.bin is converted from OpenCV\'s haarcascade_frontalface_default.xml.\n\n' + license_text(CASCADE)
    )
    print(f'wrote {out} ({os.path.getsize(out)} bytes, {len(cascade[2])} stages, {len(cascade[3])} features)')
    if not photos:
        return

    opencv = cv2.CascadeClassifier(CASCADE)
    vectors = []
    for name in ('astronaut', 'coffee'):
        img = cv2.imread(os.path.join(photos, f'{name}.png'), cv2.IMREAD_GRAYSCALE)
        h = int(round(img.shape[0] * TEST_WIDTH / img.shape[1]))
        small = cv2.resize(img, (TEST_WIDTH, h), interpolation=cv2.INTER_AREA)
        ref = [list(map(int, r)) for r in opencv.detectMultiScale(small, scaleFactor=SCALE_FACTOR, minNeighbors=MIN_NEIGHBORS, minSize=(MIN_SIZE, MIN_SIZE))]
        mine = detect(small, cascade)
        print(f'{name}: opencv {ref}  reference {mine}')
        vectors.append({'name': name, 'width': TEST_WIDTH, 'height': h, 'gray': base64.b64encode(small.tobytes()).decode(), 'opencv': ref})
    with open(os.path.join(ROOT, 'jest', 'faceVectors.json'), 'w') as f:
        json.dump({'scaleFactor': SCALE_FACTOR, 'minNeighbors': MIN_NEIGHBORS, 'minSize': MIN_SIZE, 'vectors': vectors}, f)
    print('wrote jest/faceVectors.json')


if __name__ == '__main__':
    main()
