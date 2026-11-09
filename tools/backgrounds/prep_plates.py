#!/usr/bin/env python3
"""Normalize source artworks into "plates": sRGB, auto-oriented, long side <= 3200px."""
import os, sys, json
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None
SRC = os.path.expanduser("~/Desktop/blog-work/art_src")
OUT = os.path.expanduser("~/Desktop/blog-work/plates")
LOCAL = [os.path.expanduser("~/Pictures/Isle of Death.jpg")]
MAXSIDE = 3200

os.makedirs(OUT, exist_ok=True)
manifest = []
files = sorted(os.listdir(SRC)) + LOCAL
for fn in files:
    path = fn if os.path.isabs(fn) else os.path.join(SRC, fn)
    stem = os.path.splitext(os.path.basename(fn))[0]
    dst = os.path.join(OUT, stem + ".jpg")
    try:
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im)
            if im.mode in ("RGBA", "LA", "P"):
                bg = Image.new("RGB", im.size, (12, 11, 10))
                im = im.convert("RGBA")
                bg.paste(im, mask=im.split()[-1])
                im = bg
            else:
                im = im.convert("RGB")
            w, h = im.size
            scale = min(1.0, MAXSIDE / max(w, h))
            if scale < 1.0:
                im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
            im.save(dst, "JPEG", quality=92, subsampling=0)
        rec = {"file": os.path.basename(dst), "src": os.path.basename(fn),
               "w": im.size[0], "h": im.size[1], "aspect": round(im.size[0] / im.size[1], 3),
               "src_bytes": os.path.getsize(path), "out_bytes": os.path.getsize(dst)}
        manifest.append(rec)
        print(f"OK   {rec['file']:<58} {rec['w']}x{rec['h']} ar={rec['aspect']}")
    except Exception as e:
        print(f"ERR  {fn}: {type(e).__name__}: {e}")

json.dump(manifest, open(os.path.expanduser("~/Desktop/blog-work/plates_manifest.json"), "w"), indent=1)
print(f"\n{len(manifest)} plates -> {OUT}")
