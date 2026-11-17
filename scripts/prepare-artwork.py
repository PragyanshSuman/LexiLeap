"""
Imports the original UnifiedLearningApp tracing artwork into assets/images:
  - bee.png and honey.png (used by the tracing demo and goal markers)
  - meadow.jpg: the tracing background, with the decorative "X" that was painted into
    the top-right corner removed (it looked like a real close button) and JPEG-compressed.
Re-run with: python scripts/prepare-artwork.py
"""
from pathlib import Path
import shutil

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT.parent / "UnifiedLearningApp" / "src" / "features" / "letter-tracing" / "assets" / "images"
OUT = ROOT / "assets" / "images"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name in ("bee.png", "honey.png"):
        shutil.copyfile(SOURCE / name, OUT / name)

    meadow = Image.open(SOURCE / "background.png").convert("RGB")
    # Paint over the baked-in close button by copying the sky just to its left, row by row.
    x0, x1, y0, y1 = 950, 1024, 0, 70
    for y in range(y0, y1):
        sky = meadow.getpixel((x0 - 4, y))
        for x in range(x0, x1):
            meadow.putpixel((x, y), sky)
    meadow.save(OUT / "meadow.jpg", quality=82, optimize=True, progressive=True)
    print("artwork written to", OUT)


if __name__ == "__main__":
    main()
