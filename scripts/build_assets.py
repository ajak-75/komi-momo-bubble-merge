#!/usr/bin/env python3
"""KOMI & MOMO BUBBLE MERGE — asset pipeline.

Turns the official art into the transparent, circular bubble sprites the game draws.

Inputs (source photos, not committed):
  * bubble sheet        : 3x3 grid, 9 ready-made glass bubbles
  * title visual        : golden royal bubble on navy velvet
  * legendary visual    : two crowned characters + LEGENDARY! banner

Generated images (via the `images` tool) are processed with the same circular mask so
MOMO ROYAL and the LEGENDARY bubble sit in the same glass-orb language as the sheet:

  python3 scripts/build_assets.py --sheet <sheet.jpg> --title <title.jpg> --legend <legend.jpg>

Outputs: public/assets/** and art/bubbles-master/**. Run `npx vite build` afterwards.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "public"
MASTER = ROOT / "art" / "bubbles-master"

NAMES = [
    ["momo_paw", "komi_flower", "momo_basic"],
    ["momo_costume", "komi_basic", "komi_costume"],
    ["komi_hanbok", "komi_royal", "komi_gold"],
]


def circle_mask(size: int, blur: float = 0.6) -> Image.Image:
    ss = 4
    mask = Image.new("L", (size * ss, size * ss), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse([1.5 * ss, 1.5 * ss, (size - 1.5) * ss, (size - 1.5) * ss], fill=255)
    return mask.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(blur))


def extract_sheet(sheet_path: Path, size: int = 384) -> None:
    im = Image.open(sheet_path).convert("RGB")
    w, h = im.size
    arr = np.asarray(im).astype(np.int16)
    mx, mn = arr.max(axis=2), arr.min(axis=2)
    mask = ((mx - mn) > 30) & (mx > 50)
    mask = ndi.binary_closing(mask, np.ones((7, 7)))
    filled = ndi.binary_fill_holes(mask)
    dist = ndi.distance_transform_edt(filled)

    for row in range(3):
        for col in range(3):
            y0, y1 = max(0, row * h // 3 - 20), (row + 1) * h // 3 + 20
            x0, x1 = max(0, col * w // 3 - 20), (col + 1) * w // 3 + 20
            sub = dist[y0:y1, x0:x1]
            idx = np.unravel_index(np.argmax(sub), sub.shape)
            cy, cx = y0 + idx[0], x0 + idx[1]
            radius = float(sub[idx]) * 1.045
            box = (int(cx - radius), int(cy - radius), int(cx + radius), int(cy + radius))
            crop = im.crop(box).convert("RGBA").resize((size, size), Image.LANCZOS)
            crop.putalpha(circle_mask(size))
            name = NAMES[row][col]
            crop.save(MASTER / f"{name}.png", optimize=True)
            crop.save(PUB / "assets" / "bubbles" / f"{name}.webp", "WEBP", quality=88, method=6)
            print("sheet ->", name, box)


def extract_orb(src: Path, dst: str, size: int = 384, tint: tuple[int, int, int] | None = None) -> None:
    im = Image.open(src).convert("RGB")
    arr = np.asarray(im).astype(np.int16)
    nonwhite = (255 - arr.min(axis=2)) > 14
    nonwhite = ndi.binary_opening(nonwhite, np.ones((3, 3)))
    ys, xs = np.nonzero(nonwhite)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    radius = min(xs.max() - xs.min(), ys.max() - ys.min()) / 2 * 1.02
    box = (int(cx - radius), int(cy - radius), int(cx + radius), int(cy + radius))
    crop = im.crop(box).convert("RGBA").resize((size, size), Image.LANCZOS)

    if tint:
        yy, xx = np.mgrid[0:size, 0:size]
        d = np.sqrt((xx - size / 2) ** 2 + (yy - size / 2) ** 2) / (size / 2)
        alpha = np.clip((d - 0.30) / 0.70, 0, 1) ** 1.5 * 0.55
        glow = np.zeros((size, size, 4), dtype=np.uint8)
        glow[..., 0], glow[..., 1], glow[..., 2] = tint
        glow[..., 3] = (alpha * 255).astype(np.uint8)
        layer = Image.fromarray(glow, "RGBA").filter(ImageFilter.GaussianBlur(6))
        crop = Image.alpha_composite(crop, layer)

    crop.putalpha(circle_mask(size))
    crop.save(MASTER / f"{dst}.png", optimize=True)
    crop.save(PUB / "assets" / "bubbles" / f"{dst}.webp", "WEBP", quality=88, method=6)
    print("orb  ->", dst, box)


def build_hero(title: Path) -> None:
    hero = Image.open(title).convert("RGB")
    hero.crop((140, 60, 1120, 1040)).resize((760, 760), Image.LANCZOS).save(
        PUB / "assets" / "hero-royal.jpg", quality=88, optimize=True
    )

    og = Image.new("RGB", (1200, 630), (14, 16, 32))
    og.paste(hero.crop((100, 40, 1160, 1160)).resize((630, 630), Image.LANCZOS), (0, 0))
    for name, size, x, y in (
        ("komi_basic", 210, 760, 60),
        ("momo_costume", 180, 980, 40),
        ("komi_royal", 230, 860, 330),
        ("momo_paw", 150, 1060, 380),
    ):
        bubble = Image.open(PUB / "assets" / "bubbles" / f"{name}.webp").resize((size, size), Image.LANCZOS)
        og.paste(bubble, (x, y), bubble)
    og.save(PUB / "assets" / "og-cover.jpg", quality=88, optimize=True)


def build_legend(legend: Path) -> None:
    im = Image.open(legend).convert("RGB")
    width = 1000
    im.resize((width, int(width * im.size[1] / im.size[0])), Image.LANCZOS).save(
        PUB / "assets" / "legendary-card.jpg", quality=86, optimize=True
    )
    icon = Image.new("RGBA", (512, 512), (14, 16, 32, 255))
    icon.alpha_composite(
        Image.open(PUB / "assets" / "bubbles" / "legendary.webp").resize((470, 470), Image.LANCZOS), (21, 21)
    )
    icon.convert("RGB").save(PUB / "icon-512.png", optimize=True)
    icon.convert("RGB").resize((192, 192), Image.LANCZOS).save(PUB / "icon-192.png", optimize=True)
    icon.convert("RGB").resize((32, 32), Image.LANCZOS).save(PUB / "favicon-32.png", optimize=True)
    icon.convert("RGB").resize((180, 180), Image.LANCZOS).save(PUB / "apple-touch-icon.png", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sheet", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--legend", required=True)
    parser.add_argument("--momo-royal", help="generated MOMO ROYAL raw image (white background)")
    parser.add_argument("--legendary-orb", help="generated LEGENDARY raw image (white background)")
    args = parser.parse_args()

    os.makedirs(MASTER, exist_ok=True)
    os.makedirs(PUB / "assets" / "bubbles", exist_ok=True)
    extract_sheet(Path(args.sheet))
    if args.momo_royal:
        extract_orb(Path(args.momo_royal), "momo_royal", 384, tint=(46, 86, 220))
    if args.legendary_orb:
        extract_orb(Path(args.legendary_orb), "legendary", 512)
    build_hero(Path(args.title))
    build_legend(Path(args.legend))


if __name__ == "__main__":
    main()
