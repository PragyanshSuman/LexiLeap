"""
Generates the LexiLeap app icon, Android adaptive icon layers, splash icon and favicon
into assets/. Requires Pillow. Re-run with: python scripts/generate-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent.parent / "assets"

CREAM = (255, 246, 233, 255)
TEAL = (31, 122, 110, 255)
CORAL = (240, 128, 96, 255)
SUN = (255, 197, 84, 255)
WHITE = (255, 255, 255, 255)


def draw_mark(draw: ImageDraw.ImageDraw, size: int, cx: float, cy: float, scale: float, mono=None):
    """A rounded 'L' that leaps into an arc, with a sun dot: the LexiLeap mark."""
    u = size * scale / 100.0  # one unit of the 100-unit design grid
    teal = mono or TEAL
    coral = mono or CORAL
    sun = mono or SUN
    stroke = int(13 * u)
    left, top = cx - 30 * u, cy - 34 * u
    bottom = cy + 30 * u
    # Stem of the L
    draw.line([(left, top), (left, bottom)], fill=teal, width=stroke)
    draw.ellipse([left - stroke / 2, top - stroke / 2, left + stroke / 2, top + stroke / 2], fill=teal)
    # Foot of the L
    draw.line([(left, bottom), (cx + 4 * u, bottom)], fill=teal, width=stroke)
    draw.ellipse([left - stroke / 2, bottom - stroke / 2, left + stroke / 2, bottom + stroke / 2], fill=teal)
    # Leap arc: a quarter ellipse rising from the end of the foot up to the sun.
    foot_x = cx + 4 * u
    sx, sy = cx + 32 * u, cy - 22 * u
    arc_w = int(10 * u)
    rx, ry = sx - foot_x, bottom - sy
    arc_box = [sx - rx, bottom - ry, sx + rx, bottom + ry]
    draw.arc(arc_box, start=180, end=270, fill=coral, width=arc_w)
    # Sun dot at the top of the leap
    r = 10 * u
    draw.ellipse([sx - r, sy - r, sx + r, sy + r], fill=sun)


def make(size: int, background, scale: float, mono=None) -> Image.Image:
    # Draw at 4x and downsample for smooth edges.
    big = size * 4
    img = Image.new("RGBA", (big, big), background)
    draw_mark(ImageDraw.Draw(img), big, big / 2, big / 2, scale, mono)
    return img.resize((size, size), Image.LANCZOS)


def main():
    make(1024, CREAM, 0.95).convert("RGB").save(ASSETS / "icon.png")
    make(1024, CREAM, 0.6).save(ASSETS / "splash-icon.png")
    make(48, CREAM, 0.95).save(ASSETS / "favicon.png")
    # Adaptive icon: foreground mark within the 66% safe zone over a cream background layer.
    make(1024, (0, 0, 0, 0), 0.55).save(ASSETS / "android-icon-foreground.png")
    Image.new("RGBA", (1024, 1024), CREAM).save(ASSETS / "android-icon-background.png")
    make(1024, (0, 0, 0, 0), 0.55, mono=WHITE).save(ASSETS / "android-icon-monochrome.png")
    print("icons written to", ASSETS)


if __name__ == "__main__":
    main()
