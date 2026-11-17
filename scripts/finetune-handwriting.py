"""
Fine-tunes the original handwriting model on letters drawn the way LexiLeap's canvas draws them.

The original model learnt from scanned pen-on-paper letters (EMNIST). On a tablet, children draw with a
finger: even-width strokes, no pressure, no smudges. Measured with scripts/evaluate-handwriting.py, the
original read only ~59% of such letters correctly against ~91% of scanned ones. This script keeps training
it on a mix of scanned letters and the same letters re-drawn as canvas strokes (thinned to their centre
line, then drawn with a random pen width, cropped and centred like src/handwriting/raster.ts), so it learns
both. The orientation and risk heads keep following the original model (distillation).

  python scripts/finetune-handwriting.py ../UnifiedLearningApp/backend/ml_training [epochs]

Saves scripts/out/finetuned.pth; export it with scripts/export-handwriting-model.py.
"""
import importlib.util
import os
import sys
import time

import numpy as np
import torch
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = sys.argv[1]
EPOCHS = int(sys.argv[2]) if len(sys.argv) > 2 else 2
OUT = os.path.join(HERE, 'out')
torch.manual_seed(0)
torch.set_num_threads(max(1, (os.cpu_count() or 2) - 1))

spec = importlib.util.spec_from_file_location('student', os.path.join(HERE, 'train-handwriting-student.py'))
student = importlib.util.module_from_spec(spec)
_argv, sys.argv = sys.argv, [sys.argv[0], SOURCE]
spec.loader.exec_module(student)
sys.argv = _argv
MicroCNN, idx, augment = student.MicroCNN, student.idx, student.augment

SUPER = 4
BIG = 28 * SUPER


def _thinning_tables():
    """Zhang-Suen's "remove this pixel?" answer for each of the 256 neighbourhoods, per sub-step."""
    tables = []
    for step in range(2):
        table = torch.zeros(256, dtype=torch.bool)
        for code in range(256):
            n = [(code >> i) & 1 for i in range(8)]  # P2..P9, clockwise from north
            b = sum(n)
            a = sum(1 for i in range(8) if n[i] == 0 and n[(i + 1) % 8] == 1)
            if step == 0:
                c = n[0] * n[2] * n[4] == 0 and n[2] * n[4] * n[6] == 0
            else:
                c = n[0] * n[2] * n[6] == 0 and n[0] * n[4] * n[6] == 0
            table[code] = 2 <= b <= 6 and a == 1 and c
        tables.append(table)
    return tables


_TABLES = _thinning_tables()
# Weights that turn each 3x3 neighbourhood into its code: north=1, north-east=2, ... north-west=128.
_CODE = torch.tensor([[128.0, 1.0, 2.0], [64.0, 0.0, 4.0], [32.0, 16.0, 8.0]])[None, None]


def thin(ink):
    """Zhang-Suen thinning for a batch of boolean images (N, H, W), one lookup per pixel per pass."""
    img = ink.clone()
    while True:
        changed = False
        for table in _TABLES:
            code = F.conv2d(img.float()[:, None], _CODE, padding=1)[:, 0].long()
            remove = img & table[code]
            if remove.any():
                img &= ~remove
                changed = True
        if not changed:
            return img


def disc(radius):
    r = int(np.ceil(radius)) + 1
    y, x = torch.meshgrid(torch.arange(-r, r + 1.0), torch.arange(-r, r + 1.0), indexing='ij')
    return torch.clamp(radius + 0.5 - torch.sqrt(x * x + y * y), 0, 1)[None, None]


def canvas_style(raw, pen, content=24):
    """raw: (N, 28, 28) uint8 in EMNIST's stored layout. Returns the canvas-style redraw, same layout, 0..1."""
    upright = raw.transpose(1, 2)
    skel = thin(upright > 100)
    n = skel.shape[0]
    fine = torch.zeros(n, BIG, BIG)
    rows, ys, xs = torch.nonzero(skel, as_tuple=True)
    if len(rows):
        big = torch.full((n,), 1e9)
        minx = torch.full((n,), 1e9).scatter_reduce(0, rows, xs.float(), 'amin')
        maxx = torch.full((n,), -1e9).scatter_reduce(0, rows, xs.float(), 'amax')
        miny = big.clone().scatter_reduce(0, rows, ys.float(), 'amin')
        maxy = torch.full((n,), -1e9).scatter_reduce(0, rows, ys.float(), 'amax')
        w, h = maxx - minx, maxy - miny
        extent = torch.clamp(torch.maximum(w, h), min=1.0)
        s = content * SUPER / extent
        offx, offy = (BIG - w * s) / 2, (BIG - h * s) / 2
        fx = ((xs - minx[rows]) * s[rows] + offx[rows]).round().long().clamp(0, BIG - 1)
        fy = ((ys - miny[rows]) * s[rows] + offy[rows]).round().long().clamp(0, BIG - 1)
        fine[rows, fy, fx] = 1.0
    k = disc(pen * SUPER / 2)
    fine = torch.clamp(F.conv2d(fine[:, None], k, padding=k.shape[-1] // 2), 0, 1)
    img = F.avg_pool2d(fine, SUPER)[:, 0]
    img = img / img.amax(dim=(1, 2), keepdim=True).clamp(min=1e-6)
    return img.transpose(1, 2)


def main():
    raw = os.path.join(SOURCE, 'data', 'EMNIST', 'raw')
    train_x = torch.from_numpy(idx(os.path.join(raw, 'emnist-byclass-train-images-idx3-ubyte')).copy())
    train_y = torch.from_numpy(idx(os.path.join(raw, 'emnist-byclass-train-labels-idx1-ubyte')).astype(np.int64))
    test_x = torch.from_numpy(idx(os.path.join(raw, 'emnist-byclass-test-images-idx3-ubyte'))[:10000].copy())
    test_y = torch.from_numpy(idx(os.path.join(raw, 'emnist-byclass-test-labels-idx1-ubyte'))[:10000].astype(np.int64))

    ckpt = torch.load(os.path.join(SOURCE, 'unbreakable_dyslexia_62class.pth'), map_location='cpu', weights_only=False)
    teacher = MicroCNN(64)
    teacher.load_state_dict(ckpt['model_state_dict'])
    teacher.eval()
    model = MicroCNN(64)
    model.load_state_dict(ckpt['model_state_dict'])

    norm = lambda x: (x - 0.5) / 0.5  # noqa: E731
    test_scan = norm(test_x.float()[:, None] / 255)
    test_drawn = norm(canvas_style(test_x, 2.4)[:, None])
    letters = test_y >= 10

    def evaluate():
        model.eval()
        out = []
        with torch.no_grad():
            for imgs in (test_scan, test_drawn):
                pred = torch.cat([model(imgs[i:i + 2000])[0] for i in range(0, len(imgs), 2000)]).argmax(1)
                out.append(((pred == test_y) & letters).sum().item() / letters.sum().item())
        model.train()
        return f'letters scanned {out[0]:.4f}, canvas-drawn {out[1]:.4f}'

    print('before:', evaluate(), flush=True)
    batch = 512
    steps = EPOCHS * (len(train_x) // batch)
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=1e-3, total_steps=steps, pct_start=0.1)
    T = 3.0
    step = 0
    for epoch in range(EPOCHS):
        perm = torch.randperm(len(train_x))
        start = time.time()
        for i in range(0, len(perm) - batch + 1, batch):
            ids = perm[i:i + batch]
            images = train_x[ids]
            y = train_y[ids]
            # 60% re-drawn as canvas strokes with a random pen width; the rest as scanned.
            drawn = torch.rand(batch) < 0.6
            x = images.float() / 255
            if drawn.any():
                x[drawn] = canvas_style(images[drawn], float(np.random.uniform(1.8, 4.0)))
            x = augment(x[:, None])
            x = norm(x)
            with torch.no_grad():
                _, t_ori, t_risk = teacher(x)
            logits, ori, risk = model(x)
            loss = (
                F.cross_entropy(logits, y, label_smoothing=0.05)
                + F.kl_div(F.log_softmax(ori / T, 1), F.softmax(t_ori / T, 1), reduction='batchmean') * T * T
                + F.mse_loss(risk, t_risk)
            )
            opt.zero_grad()
            loss.backward()
            opt.step()
            sched.step()
            step += 1
            if step % 200 == 0:
                print(f'epoch {epoch + 1} step {step}/{steps} loss {loss.item():.3f} ({time.time() - start:.0f}s)', flush=True)
        print(f'epoch {epoch + 1}:', evaluate(), flush=True)

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, 'finetuned.pth')
    torch.save({'model_state_dict': model.state_dict(), 'note': 'original model fine-tuned on scanned + canvas-drawn EMNIST'}, path)
    print('saved', path)


if __name__ == '__main__':
    main()
