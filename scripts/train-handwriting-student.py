"""
Distils the original handwriting model (UnifiedLearningApp "Micro-Dyslexia-CNN-62", the teacher)
into a smaller student with the same three heads, so it runs fast enough in plain JavaScript on
phones (no JIT on Hermes). The student learns from EMNIST ByClass labels and the teacher's outputs.

  python scripts/train-handwriting-student.py ../UnifiedLearningApp/backend/ml_training [width] [epochs]

Saves scripts/out/student-<width>.pth; export it with scripts/export-handwriting-model.py.
"""
import os
import sys
import time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

SOURCE = sys.argv[1]
WIDTH = int(sys.argv[2]) if len(sys.argv) > 2 else 32
EPOCHS = int(sys.argv[3]) if len(sys.argv) > 3 else 4
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
torch.manual_seed(0)
torch.set_num_threads(max(1, (os.cpu_count() or 2) - 1))


class MicroCNN(nn.Module):
    """The original architecture, with a configurable width (the original is 64)."""

    def __init__(self, width=64, classes=62):
        super().__init__()
        w1, w2, w3 = width, width * 2, width * 4
        self.backbone = nn.Sequential(
            nn.Conv2d(1, w1, 3, padding=1), nn.BatchNorm2d(w1), nn.ReLU(), nn.MaxPool2d(2, 2),
            nn.Conv2d(w1, w2, 3, padding=1), nn.BatchNorm2d(w2), nn.ReLU(), nn.MaxPool2d(2, 2),
            nn.Conv2d(w2, w3, 3, padding=1), nn.BatchNorm2d(w3), nn.ReLU(), nn.AdaptiveAvgPool2d((1, 1)), nn.Flatten())
        self.identity_head = nn.Sequential(nn.Dropout(0.4), nn.Linear(w3, 128), nn.ReLU(), nn.Linear(128, classes))
        self.orientation_head = nn.Sequential(nn.Dropout(0.3), nn.Linear(w3, 3))
        self.risk_head = nn.Sequential(nn.Dropout(0.3), nn.Linear(w3, 1), nn.Sigmoid())

    def forward(self, x):
        f = self.backbone(x)
        return self.identity_head(f), self.orientation_head(f), self.risk_head(f)


def idx(path):
    data = open(path, 'rb').read()
    dims = data[3]
    shape = [int.from_bytes(data[4 + 4 * i:8 + 4 * i], 'big') for i in range(dims)]
    return np.frombuffer(data, np.uint8, offset=4 + 4 * dims).reshape(shape)


def augment(x):
    """Small shifts, rotations, size changes and pen-width changes, like drawing on a screen."""
    n = x.shape[0]
    angle = (torch.rand(n) - 0.5) * 0.35
    scale = 0.9 + torch.rand(n) * 0.2
    shift = (torch.rand(n, 2) - 0.5) * 0.15
    cos, sin = torch.cos(angle) / scale, torch.sin(angle) / scale
    theta = torch.stack([torch.stack([cos, -sin, shift[:, 0]], 1), torch.stack([sin, cos, shift[:, 1]], 1)], 1)
    grid = F.affine_grid(theta, x.shape, align_corners=False)
    x = F.grid_sample(x, grid, align_corners=False, padding_mode='zeros')
    thicker = torch.rand(n) < 0.3
    if thicker.any():
        x[thicker] = F.max_pool2d(x[thicker], 3, 1, 1) * 0.5 + x[thicker] * 0.5
    return x


def main():
    raw = os.path.join(SOURCE, 'data', 'EMNIST', 'raw')
    train_x = torch.from_numpy(idx(os.path.join(raw, 'emnist-byclass-train-images-idx3-ubyte')).copy())
    train_y = torch.from_numpy(idx(os.path.join(raw, 'emnist-byclass-train-labels-idx1-ubyte')).astype(np.int64))
    test_x = torch.from_numpy(idx(os.path.join(raw, 'emnist-byclass-test-images-idx3-ubyte'))[:20000].copy())
    test_y = torch.from_numpy(idx(os.path.join(raw, 'emnist-byclass-test-labels-idx1-ubyte'))[:20000].astype(np.int64))

    teacher = MicroCNN(64)
    teacher.load_state_dict(torch.load(os.path.join(SOURCE, 'unbreakable_dyslexia_62class.pth'), map_location='cpu', weights_only=False)['model_state_dict'])
    teacher.eval()
    student = MicroCNN(WIDTH)
    print(f'student width {WIDTH}: {sum(p.numel() for p in student.parameters()):,} params')

    batch = 512
    steps = EPOCHS * (len(train_x) // batch)
    opt = torch.optim.AdamW(student.parameters(), lr=3e-3, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=3e-3, total_steps=steps)
    T = 3.0

    def prep(images):
        return (images.float().unsqueeze(1) / 255.0 - 0.5) / 0.5

    def evaluate(model):
        model.eval()
        right = 0
        with torch.no_grad():
            for i in range(0, len(test_x), 2000):
                right += (model(prep(test_x[i:i + 2000]))[0].argmax(1) == test_y[i:i + 2000]).sum().item()
        model.train()
        return right / len(test_x)

    print(f'teacher accuracy {evaluate(teacher):.4f}')
    step = 0
    for epoch in range(EPOCHS):
        perm = torch.randperm(len(train_x))
        start = time.time()
        for i in range(0, len(perm) - batch + 1, batch):
            ids = perm[i:i + batch]
            x = prep(train_x[ids])
            # The teacher's reversal training: some letters flipped (in the stored EMNIST layout).
            p = torch.rand(batch)
            h, v = p < 0.2, (p >= 0.2) & (p < 0.26)
            x[h] = torch.flip(x[h], [3])
            x[v] = torch.flip(x[v], [2])
            x = augment(x * 0.5 + 0.5) * 2 - 1
            with torch.no_grad():
                t_logits, t_ori, t_risk = teacher(x)
            s_logits, s_ori, s_risk = student(x)
            y = train_y[ids]
            plain = ~(h | v)
            loss = (
                F.cross_entropy(s_logits[plain], y[plain])
                + 2.0 * F.kl_div(F.log_softmax(s_logits / T, 1), F.softmax(t_logits / T, 1), reduction='batchmean') * T * T
                + F.kl_div(F.log_softmax(s_ori / T, 1), F.softmax(t_ori / T, 1), reduction='batchmean') * T * T
                + F.mse_loss(s_risk, t_risk)
            )
            opt.zero_grad()
            loss.backward()
            opt.step()
            sched.step()
            step += 1
            if step % 200 == 0:
                print(f'epoch {epoch + 1} step {step}/{steps} loss {loss.item():.3f} ({time.time() - start:.0f}s)', flush=True)
        print(f'epoch {epoch + 1}: student accuracy {evaluate(student):.4f}', flush=True)

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'student-{WIDTH}.pth')
    torch.save({'model_state_dict': student.state_dict(), 'width': WIDTH, 'accuracy': evaluate(student)}, path)
    print('saved', path)


if __name__ == '__main__':
    main()
