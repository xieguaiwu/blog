#!/usr/bin/env python3
"""Export masters to web formats (AVIF + JPG) and derive site assets."""
import os, glob, json, shutil
from PIL import Image

ROOT = os.path.expanduser("~/Desktop/blog-work")
OUT = os.path.join(ROOT, "out")
SITE = os.path.expanduser("~/Desktop/blog/source/img")
BG = os.path.join(SITE, "bg", "art")
COVER = os.path.join(BG, "cover")
for d in (BG, COVER):
    os.makedirs(d, exist_ok=True)

AVIF_Q, JPG_Q = 52, 80
report = []

for src in sorted(glob.glob(os.path.join(OUT, "*.jpg"))):
    base = os.path.splitext(os.path.basename(src))[0]
    im = Image.open(src).convert("RGB")
    a = os.path.join(BG, base + ".avif")
    j = os.path.join(BG, base + ".jpg")
    im.save(a, "AVIF", quality=AVIF_Q, speed=4)
    im.save(j, "JPEG", quality=JPG_Q, optimize=True, progressive=True)
    report.append((base, im.size, os.path.getsize(a) // 1024, os.path.getsize(j) // 1024))
    print(f"{base:<6} {im.size[0]}x{im.size[1]}  avif={os.path.getsize(a)//1024:>4}KB  jpg={os.path.getsize(j)//1024:>4}KB")

# ---- post-card covers (16:10 small) ----
covers = ["A1", "A2", "A3", "A4", "B1", "B2", "C1", "C2", "D1", "D2", "D3"]
for cid in covers:
    src = os.path.join(OUT, cid + ".jpg")
    if not os.path.exists(src):
        continue
    im = Image.open(src).convert("RGB")
    w, h = im.size
    th = int(w / 1.6)
    top = max(0, (h - th) // 2)
    im = im.crop((0, top, w, top + th)).resize((800, 500), Image.LANCZOS)
    im.save(os.path.join(COVER, f"{cid}.avif"), "AVIF", quality=50, speed=4)
    im.save(os.path.join(COVER, f"{cid}.jpg"), "JPEG", quality=80, optimize=True)
print("covers:", len(covers))

# ---- favicon / avatar / og ----
isle = Image.open(os.path.join(ROOT, "plates/Isle of Death.jpg")).convert("RGB")
w, h = isle.size
# favicon: the island silhouette, square
side = int(h * 1.0)
fav = isle.crop((int(w * 0.28), 0, int(w * 0.28) + side, h)) if w * 0.28 + side <= w else isle.crop((0, 0, h, h))
fav = fav.resize((512, 512), Image.LANCZOS)
fav.save(os.path.join(SITE, "..", "favicon.png"), "PNG")
fav.resize((180, 180), Image.LANCZOS).save(os.path.join(SITE, "apple-touch-icon.png"), "PNG")
fav.resize((48, 48), Image.LANCZOS).save(os.path.join(SITE, "favicon.ico"), sizes=[(48, 48)])

# avatar: the Wounded Angel detail
angel = Image.open(os.path.join(ROOT, "plates/Simberg,_fresco_The_Wounded_Angel.jpg")).convert("RGB")
aw, ah = angel.size
s = min(aw, ah)
angel.crop(((aw - s) // 2, int((ah - s) * 0.15), (aw - s) // 2 + s, int((ah - s) * 0.15) + s)) \
     .resize((360, 360), Image.LANCZOS).save(os.path.join(SITE, "avatar.png"), "PNG")

# og image 1200x630 from A1
A1 = Image.open(os.path.join(OUT, "A1.jpg")).convert("RGB")
w, h = A1.size
th = int(w / 1.905)
A1.crop((0, (h - th) // 2, w, (h - th) // 2 + th)).resize((1200, 630), Image.LANCZOS) \
  .save(os.path.join(SITE, "og-cover.jpg"), "JPEG", quality=86)

tot = sum(os.path.getsize(f) for f in glob.glob(os.path.join(BG, "**", "*"), recursive=True))
print(f"\nsite bg total: {tot/1024/1024:.1f} MB  ->  {BG}")
