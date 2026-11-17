"""
Measures how well LexiLeap reads handwriting, the way the app does it.

EMNIST letters are thinned to their centre line and re-drawn as uniform pen strokes (like a finger on a
tablet), then go through a Python copy of the app's pipeline (src/handwriting/raster.ts and
recognize.ts) and the exported model. Reports overall and per-letter accuracy, the commonest confusions,
and how often mirrored / upside-down letters are flagged (and how often normal ones are flagged by mistake).

  python scripts/evaluate-handwriting.py ../UnifiedLearningApp/backend/ml_training [samples] [--tune] [--model file.bin]
"""
import os
import struct
import sys
from collections import Counter

import numpy as np
import torch
import torch.nn.functional as F

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = sys.argv[1]
SAMPLES = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 6000
TUNE = '--tune' in sys.argv
MODEL = sys.argv[sys.argv.index('--model') + 1] if '--model' in sys.argv else os.path.join(ROOT, 'assets', 'models', 'handwriting.bin')
CLASSES = [str(i) for i in range(10)] + [chr(c) for c in range(65, 91)] + [chr(c) for c in range(97, 123)]
SAME_SHAPE = set('cklmopsuvwxyz')
LOOK_ALIKE = {'I': 'l', 'l': 'I', 'f': 'F'}  # same as src/handwriting/recognize.ts
# Letters that look the same mirrored left-right (a mirrored one can't be told apart).
MIRROR_SYMMETRIC = set('AHIMOTUVWXYilmnouvwx')
FLIP_SYMMETRIC = set('BCDEHIKOXclox')


def idx(path):
    data = open(path, 'rb').read()
    dims = data[3]
    shape = [int.from_bytes(data[4 + 4 * i:8 + 4 * i], 'big') for i in range(dims)]
    return np.frombuffer(data, np.uint8, offset=4 + 4 * dims).reshape(shape)


def load_model(path):
    """Reads the app's own model file (same as src/handwriting/model.ts)."""
    buf = open(path, 'rb').read()
    assert buf[:4] == b'LXHW'
    version, width = struct.unpack('<II', buf[4:12])
    shapes = [(width, 9), (width * 2, width * 9), (width * 4, width * 18), (128, width * 4), (62, 128), (3, width * 4), (1, width * 4)]
    off = 12
    layers = []
    for out, size in shapes:
        scales = np.frombuffer(buf, '<f4', out, off); off += out * 4
        bias = np.frombuffer(buf, '<f4', out, off); off += out * 4
        q = np.frombuffer(buf, np.int8, out * size, off).astype(np.float32); off += out * size
        layers.append((torch.tensor(q.reshape(out, size) * scales[:, None]), torch.tensor(bias.copy())))
    assert off == len(buf)
    return width, layers


def run(model, images):
    """images: (n, 28, 28) upright, 0..1. Returns letter logits (n, 52) and orientation logits."""
    width, L = model
    x = torch.tensor(images.transpose(0, 2, 1).copy(), dtype=torch.float32).unsqueeze(1)  # model layout
    x = (x - 0.5) / 0.5
    chans = [1, width, width * 2]
    for i in range(3):
        w, b = L[i]
        x = F.relu(F.conv2d(x, w.reshape(-1, chans[i], 3, 3), b, padding=1))
        x = F.max_pool2d(x, 2) if i < 2 else x.mean(dim=(2, 3))
    logits = F.linear(F.relu(F.linear(x, *L[3])), *L[4])
    return logits[:, 10:], F.linear(x, *L[5])


def thin(img):
    """Zhang-Suen thinning of a boolean image."""
    img = img.copy().astype(np.uint8)
    changed = True
    while changed:
        changed = False
        for step in range(2):
            p = np.pad(img, 1)
            n = [p[:-2, 1:-1], p[:-2, 2:], p[1:-1, 2:], p[2:, 2:], p[2:, 1:-1], p[2:, :-2], p[1:-1, :-2], p[:-2, :-2]]
            b = sum(n)
            a = sum(((n[i] == 0) & (n[(i + 1) % 8] == 1)).astype(int) for i in range(8))
            if step == 0:
                c = (n[0] * n[2] * n[4] == 0) & (n[2] * n[4] * n[6] == 0)
            else:
                c = (n[0] * n[2] * n[6] == 0) & (n[0] * n[4] * n[6] == 0)
            remove = (img == 1) & (b >= 2) & (b <= 6) & (a == 1) & c
            if remove.any():
                img[remove] = 0
                changed = True
    return img.astype(bool)


def to_points(upright):
    """The centre line of an EMNIST letter as canvas points (scaled up as a finger would draw it)."""
    ys, xs = np.nonzero(thin(upright > 100))
    return np.stack([xs, ys], 1).astype(np.float32) * 10.0


def rasterize(points, pen=2.4, content=24, supersample=4, blur=0.0):
    """Python copy of src/handwriting/raster.ts for a set of dots."""
    big = 28 * supersample
    mn = points.min(0)
    w, h = points.max(0) - mn
    extent = max(w, h, 1e-6)
    s = 1.0 if extent < 1 else content * supersample / extent
    off = np.array([(big - w * s) / 2, (big - h * s) / 2])
    pts = (points - mn) * s + off
    radius = pen * supersample / 2
    yy, xx = np.mgrid[0:big, 0:big] + 0.5
    d = np.sqrt((xx[..., None] - pts[:, 0]) ** 2 + (yy[..., None] - pts[:, 1]) ** 2).min(-1)
    fine = np.clip(radius + 0.5 - d, 0, 1)
    img = fine.reshape(28, supersample, 28, supersample).mean((1, 3))
    if blur > 0:
        k = np.exp(-np.arange(-2, 3) ** 2 / (2 * blur ** 2)); k /= k.sum()
        img = np.apply_along_axis(lambda r: np.convolve(r, k, 'same'), 0, img)
        img = np.apply_along_axis(lambda r: np.convolve(r, k, 'same'), 1, img)
    return img / img.max()


def softmax(z):
    z = z - z.max(-1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(-1, keepdims=True)


def matches(read, target):
    return read == target or LOOK_ALIKE.get(target) == read or (target.lower() in SAME_SHAPE and read.lower() == target.lower())


def target_prob(probs, target):
    return sum(probs[i] for i, c in enumerate(CLASSES[10:]) if matches(c, target))


def main():
    raw = os.path.join(SOURCE, 'data', 'EMNIST', 'raw')
    images = idx(os.path.join(raw, 'emnist-byclass-test-images-idx3-ubyte'))
    labels = idx(os.path.join(raw, 'emnist-byclass-test-labels-idx1-ubyte'))
    rng = np.random.default_rng(0)
    letters = np.nonzero(labels >= 10)[0]
    pick = rng.choice(letters, SAMPLES, replace=False)
    upright = images[pick].transpose(0, 2, 1)
    targets = [CLASSES[l] for l in labels[pick]]
    model = load_model(MODEL)
    print('model', os.path.relpath(MODEL, ROOT))
    points = [to_points(u) for u in upright]
    keep = [i for i, p in enumerate(points) if len(p) >= 3]
    upright, targets, points = upright[keep], [targets[i] for i in keep], [points[i] for i in keep]
    print(f'{len(targets)} letters')

    def accuracy(imgs):
        probs = softmax(run(model, imgs)[0].numpy())
        reads = [CLASSES[10 + i] for i in probs.argmax(1)]
        ok = np.array([matches(r, t) for r, t in zip(reads, targets)])
        caseless = np.array([r.lower() == t.lower() for r, t in zip(reads, targets)])
        return ok, caseless, reads, probs

    base = accuracy(upright / 255.0)
    print(f'EMNIST as scanned: check {base[0].mean():.3f}, caseless {base[1].mean():.3f}')

    settings = [dict(pen=2.4, content=20)]
    if TUNE:
        settings = [dict(pen=p, content=c, blur=b) for p in (1.8, 2.4, 3.0, 3.6) for c in (20, 22, 24) for b in (0.0, 0.7)]
    best = None
    for cfg in settings:
        drawn = np.stack([rasterize(p, **cfg) for p in points])
        ok, caseless, reads, probs = accuracy(drawn)
        print(f'redrawn {cfg}: check {ok.mean():.3f}, caseless {caseless.mean():.3f}')
        if best is None or ok.mean() > best[0]:
            best = (ok.mean(), cfg, drawn, ok, caseless, reads, probs)
    _, cfg, drawn, ok, caseless, reads, probs = best
    print(f'\nbest settings {cfg}')

    per = {}
    for t, good in zip(targets, ok):
        per.setdefault(t, []).append(good)
    worst = sorted(per.items(), key=lambda kv: np.mean(kv[1]))[:12]
    print('weakest letters:', ', '.join(f'{k} {np.mean(v):.0%} (n={len(v)})' for k, v in worst))
    confusions = Counter((t, r) for t, r, good in zip(targets, reads, ok) if not good)
    print('commonest confusions:', ', '.join(f'{t}->{r} x{n}' for (t, r), n in confusions.most_common(15)))

    # Reversals: mirror / turn the strokes and see whether each rule flags them.
    def variant(kind):
        out = []
        for p in points:
            q = p.copy()
            if kind in ('mirrored', 'rotated'):
                q[:, 0] = -q[:, 0]
            if kind in ('upside-down', 'rotated'):
                q[:, 1] = -q[:, 1]
            out.append(rasterize(q, **cfg))
        return np.stack(out)

    def flips(imgs):
        return {
            'mirrored': softmax(run(model, imgs[:, :, ::-1].copy())[0].numpy()),
            'upside-down': softmax(run(model, imgs[:, ::-1, :].copy())[0].numpy()),
            'rotated': softmax(run(model, imgs[:, ::-1, ::-1].copy())[0].numpy()),
        }

    def app_rule(p0, alt, i, t, floor=0.25, margin=0.25):
        """Same as checkLetter in src/handwriting/recognize.ts."""
        here = target_prob(p0[i], t)
        if here >= 1 - margin:
            return None
        strongest, kind = max(floor, here + margin), None
        for k in ('mirrored', 'upside-down', 'rotated'):
            p = target_prob(alt[k][i], t)
            if p > strongest:
                strongest, kind = p, k
        return kind

    normal_alt = flips(drawn)
    turned = {}
    for kind, symmetric in (('mirrored', MIRROR_SYMMETRIC), ('upside-down', FLIP_SYMMETRIC), ('rotated', set())):
        imgs = variant(kind)
        turned[kind] = (softmax(run(model, imgs)[0].numpy()), flips(imgs), [i for i, t in enumerate(targets) if t not in symmetric])

    # A different letter must not pass as the one asked for.
    other = [next(c for c in rng.permutation(CLASSES[10:]) if not matches(c, t) and not matches(t, c)) for t in targets]

    grid = [(f, m) for f in (0.25, 0.35, 0.45) for m in (0.15, 0.25, 0.35)] if TUNE else [(0.25, 0.25)]
    for floor, margin in grid:
        rule = lambda p0, alt, i, t: app_rule(p0, alt, i, t, floor, margin)  # noqa: E731
        flagged = [rule(probs, normal_alt, i, t) for i, t in enumerate(targets)]
        accepted = np.mean([matches(r, t) and f is None for r, t, f in zip(reads, targets, flagged)])
        false_alarm = np.mean([f is not None for f in flagged])
        wrong_pass = np.mean([matches(r, o) and rule(probs, normal_alt, i, o) is None for i, (r, o) in enumerate(zip(reads, other))])
        line = f'floor {floor} margin {margin}: right letters accepted {accepted:.1%}, false reversal alarms {false_alarm:.1%}, wrong letters accepted {wrong_pass:.1%}'
        for kind, (p, alt, rows) in turned.items():
            line += f'; {kind} caught {np.mean([rule(p, alt, i, targets[i]) is not None for i in rows]):.1%}'
        print(line)


if __name__ == '__main__':
    main()
