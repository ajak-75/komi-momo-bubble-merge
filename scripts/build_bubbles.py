#!/usr/bin/env python3
"""Build the six bubble-shooter bubbles from the official KOMI & MOMO art sheet.

Source: work/ajak-studio/komi-pop/chars/stage-*.webp (already cut from the
official 9-cut glass-bubble sheet, alpha-trimmed to a clean circular edge).

Colour plan (chosen for a bubble shooter: every colour must be told apart at a
glance, so the two pink-family bubbles and the two red-family bubbles are split):
  violet  stage-0  paw bubble
  red     stage-1  dancheong flower bubble
  mint    stage-3  momo in the red beret
  pink    stage-4  momo with the pink ribbon
  sky     stage-6  komi in hanbok
  gold    stage-8  golden crowned komi

The edges are left exactly as the art has them: no coloured ring is drawn on
top, so the glass rim stays clean on the dark board.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parent / "ajak-studio" / "komi-pop" / "chars"
OUT = ROOT / "public" / "assets" / "bubbles"

PICKS = {
    "violet": "stage-0.webp",
    "red": "stage-1.webp",
    "mint": "stage-3.webp",
    "pink": "stage-4.webp",
    "sky": "stage-6.webp",
    "gold": "stage-8.webp",
}

SIZE = 320


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, src_name in PICKS.items():
        im = Image.open(SRC / src_name).convert("RGBA")
        im = im.resize((SIZE, SIZE), Image.LANCZOS)
        # Keep the art's own edge; only drop stray semi-transparent speckle that
        # sits outside the circle (a hard 0/255 edge would look jagged).
        alpha = im.getchannel("A")
        alpha = alpha.point(lambda v: 0 if v < 12 else v)
        im.putalpha(alpha)
        dest = OUT / f"{name}.webp"
        im.save(dest, "WEBP", quality=86, method=6)
        print(f"{dest.relative_to(ROOT)}  {dest.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
