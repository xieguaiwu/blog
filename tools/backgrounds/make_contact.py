#!/usr/bin/env python3
"""Build a labeled contact sheet from plates/ for visual review."""
import os, sys, glob
from PIL import Image, ImageDraw

PLATES = os.path.expanduser("~/Desktop/blog-work/plates")
OUT = os.path.expanduser("~/Desktop/blog-work")
COLS, ROWS, CELL = 6, 4, 430
LABEL_H = 30

def sheet(files, name, start_idx=0):
    rows = (len(files) + COLS - 1) // COLS
    W, H = COLS * CELL, rows * (CELL + LABEL_H)
    canvas = Image.new("RGB", (W, H), (18, 17, 16))
    d = ImageDraw.Draw(canvas)
    for i, f in enumerate(files):
        r, c = divmod(i, COLS)
        try:
            im = Image.open(f).convert("RGB")
        except Exception:
            continue
        im.thumbnail((CELL - 8, CELL - 8), Image.LANCZOS)
        x = c * CELL + (CELL - im.size[0]) // 2
        y = r * (CELL + LABEL_H) + LABEL_H + (CELL - im.size[1]) // 2
        canvas.paste(im, (x, y))
        d.text((c * CELL + 6, r * (CELL + LABEL_H) + 8),
               f"[{start_idx+i}] {os.path.basename(f)[:52]}", fill=(235, 225, 205))
    p = os.path.join(OUT, name)
    canvas.save(p, "JPEG", quality=88)
    print(p, canvas.size)

allf = sorted(glob.glob(os.path.join(PLATES, "*.jpg")))
half = (len(allf) + 1) // 2
sheet(allf[:half], "contact_1.jpg", 0)
sheet(allf[half:], "contact_2.jpg", half)
