#!/usr/bin/env python3
"""
艺术混搭博客背景生成器 — 4 种样式 × 16 套 × 2 版式（桌面 16:9 / 移动竖屏）。

样式：
  A 单幅满铺      one painting, treated (vignette + grain + grade)
  B 主画+细节拼贴  darkened base + framed detail plates near the outer thirds
  C 三联祭坛画     three vertical panels, gold frames on dark ground
  D 层叠蒙太奇     base + ghosted overlays blended with feathered masks

用法: python3 gen_backgrounds.py [--only A1,B2] [--preview]
"""
import argparse, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageEnhance

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.expanduser("~/Desktop/blog-work")
PLATES = os.path.join(ROOT, "plates")
OUT = os.path.join(ROOT, "out")
os.makedirs(OUT, exist_ok=True)

DESKTOP = (2560, 1440)
MOBILE = (1200, 1800)

GOLD = (176, 141, 87)
GOLD_HI = (214, 183, 128)
INK = (13, 12, 11)

_cache = {}


def plate(name):
    """Load a plate by (unique) filename prefix; cached."""
    if name in _cache:
        return _cache[name]
    cands = [f for f in os.listdir(PLATES) if f.startswith(name)]
    if not cands:
        raise FileNotFoundError(name)
    im = Image.open(os.path.join(PLATES, sorted(cands, key=len)[0])).convert("RGB")
    _cache[name] = im
    return im


# ---------------------------------------------------------------- primitives

def crop_aspect(im, aspect, focus=(0.5, 0.5)):
    """Center/focus crop to the given w/h aspect."""
    w, h = im.size
    cur = w / h
    if cur > aspect:                      # too wide -> cut sides
        nw = int(round(h * aspect))
        cx = int(round(focus[0] * w - nw / 2))
        cx = max(0, min(w - nw, cx))
        return im.crop((cx, 0, cx + nw, h))
    nh = int(round(w / aspect))           # too tall -> cut top/bottom
    cy = int(round(focus[1] * h - nh / 2))
    cy = max(0, min(h - nh, cy))
    return im.crop((0, cy, w, cy + nh))


def fit_cover(im, size, focus=(0.5, 0.5)):
    return crop_aspect(im, size[0] / size[1], focus).resize(size, Image.LANCZOS)


def fit_contain(im, size, bg=INK):
    out = Image.new("RGB", size, bg)
    im2 = im.copy()
    im2.thumbnail(size, Image.LANCZOS)
    out.paste(im2, ((size[0] - im2.size[0]) // 2, (size[1] - im2.size[1]) // 2))
    return out


def grade(im, brightness=1.0, saturation=1.0, contrast=1.0, warmth=0.0, blur=0.0):
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    if brightness != 1.0:
        im = ImageEnhance.Brightness(im).enhance(brightness)
    if contrast != 1.0:
        im = ImageEnhance.Contrast(im).enhance(contrast)
    if saturation != 1.0:
        im = ImageEnhance.Color(im).enhance(saturation)
    if warmth:
        a = np.asarray(im, dtype=np.float32)
        a[..., 0] *= 1.0 + warmth * 0.12
        a[..., 2] *= 1.0 - warmth * 0.12
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    return im


def vignette(im, strength=0.45, power=2.2):
    w, h = im.size
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = w / 2.0, h / 2.0
    d = np.sqrt(((xx - cx) / cx) ** 2 + ((yy - cy) / cy) ** 2) / math.sqrt(2)
    mask = np.clip(1.0 - strength * (d ** power) * 2.0, 0.0, 1.0)
    a = np.asarray(im, dtype=np.float32) * mask[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def linear_shade(im, top=0.55, top_h=0.34, bottom=0.45, bottom_h=0.30):
    """Darken the top band (nav legibility) and the bottom band."""
    w, h = im.size
    a = np.asarray(im, dtype=np.float32)
    yy = np.arange(h, dtype=np.float32)[:, None]
    if top:
        t = np.clip(1.0 - yy / (h * top_h), 0.0, 1.0) ** 1.4
        a *= (1.0 - top * t)[..., None]
    if bottom:
        b = np.clip((yy - h * (1 - bottom_h)) / (h * bottom_h), 0.0, 1.0) ** 1.4
        a *= (1.0 - bottom * b)[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def grain(im, amount=4.0, seed=0):
    rng = np.random.default_rng(seed)
    a = np.asarray(im, dtype=np.float32)
    a += rng.normal(0.0, amount, a.shape[:2])[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def canvas_grain(im, amount=7.0, seed=1):
    """Coarser directional noise, like canvas/paper tooth."""
    rng = np.random.default_rng(seed)
    h, w = im.size[1], im.size[0]
    n = rng.normal(0.0, amount, (h, w, 1)).astype(np.float32)
    n = np.repeat(n, 3, axis=2)
    soft = np.asarray(Image.fromarray(np.clip(n + 128, 0, 255).astype(np.uint8)[..., 0])
                      .filter(ImageFilter.GaussianBlur(0.6)), dtype=np.float32) - 128.0
    a = np.asarray(im, dtype=np.float32) + soft[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def feathered_mask(size, center, radius, feather=0.55):
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(((xx - center[0]) / radius[0]) ** 2 + ((yy - center[1]) / radius[1]) ** 2)
    m = np.clip((1.0 - r) / feather, 0.0, 1.0)
    return Image.fromarray((m * 255).astype(np.uint8), "L")


def blend(base, over, mask, mode="screen", opacity=1.0):
    if mode == "screen":
        fused = ImageChops.screen(base, over)
    elif mode == "multiply":
        fused = ImageChops.multiply(base, over)
    elif mode == "softlight":
        fused = ImageChops.soft_light(base, over)
    elif mode == "overlay":
        fused = ImageChops.overlay(base, over)
    else:
        fused = over
    if opacity < 1.0:
        mask = mask.point(lambda v: int(v * opacity))
    return Image.composite(fused, base, mask)


def frame_panel(im, size, border=4, hi=True, shadow=True, rotation=0.0):
    """A painting detail in a thin gilded frame with a soft drop shadow."""
    canvas = Image.new("RGBA", (size[0] + 2 * border, size[1] + 2 * border), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, 0, canvas.size[0] - 1, canvas.size[1] - 1],
                outline=(GOLD_HI if hi else GOLD) + (255,), width=border)
    d.rectangle([0, 0, canvas.size[0] - 1, canvas.size[1] - 1], outline=(40, 32, 20, 255), width=1)
    canvas.paste(im.resize(size, Image.LANCZOS), (border, border))
    d.rectangle([border - 1, border - 1, border + size[0], border + size[1]],
                outline=(90, 74, 48, 190), width=1)
    if rotation:
        canvas = canvas.rotate(rotation, resample=Image.BICUBIC, expand=True)
    if shadow:
        sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        alpha = canvas.split()[-1].filter(ImageFilter.GaussianBlur(14))
        sh.putalpha(alpha.point(lambda v: int(v * 0.75)))
        sh = ImageChops.offset(sh, 6, 10)
        return sh, canvas
    return None, canvas


def paste_rgba(base, layer, pos):
    base.alpha_composite(layer, pos) if base.mode == "RGBA" else base.paste(layer, pos, layer)


# ---------------------------------------------------------------- styles

def style_A(size, art, focus=(0.5, 0.5), **kw):
    im = fit_cover(plate(art), size, focus)
    im = grade(im, brightness=0.88, saturation=0.92, contrast=1.04, warmth=0.15)
    im = vignette(im, strength=0.42)
    im = linear_shade(im, top=0.5, bottom=0.42)
    im = canvas_grain(im, 6.0, seed=hash(art) % 999)
    return grain(im, 3.0, seed=7)


def _panel_fit(art, size, focus, contain=None):
    """Fill a panel. Landscape sources are matted (contain) so their composition survives;
    portrait/square sources fill the panel edge to edge (crop)."""
    im = plate(art)
    if contain is None:
        contain = (im.size[0] / im.size[1]) >= 1.15
    if contain:
        canvas = Image.new("RGB", size, (20, 18, 16))
        t = im.copy()
        t.thumbnail((int(size[0] * 0.96), int(size[1] * 0.96)), Image.LANCZOS)
        canvas.paste(t, ((size[0] - t.size[0]) // 2, (size[1] - t.size[1]) // 2))
        return canvas
    return fit_cover(im, size, focus)


def _panel_crop(art, size, focus):
    return fit_cover(plate(art), size, focus)


def style_B(size, base_art, panels, **kw):
    """base_art darkened; panels = [(art, focus, rel_w, rel_pos)] with rel_pos in 0..1."""
    W, H = size
    im = fit_cover(plate(base_art), size, kw.get("base_focus", (0.5, 0.5)))
    im = grade(im, brightness=kw.get("base_bright", 0.56), saturation=0.78, contrast=1.02,
               blur=1.1, warmth=0.1)
    im = vignette(im, strength=0.5)
    canvas = im.convert("RGBA")
    for art, focus, rel_w, (px, py), aspect, rot in panels:
        pw = int(W * rel_w)
        ph = int(pw / aspect)
        fig = _panel_crop(art, (pw, ph), focus)
        sh, framed = frame_panel(fig, (pw, ph), border=max(3, W // 700), rotation=rot)
        x = int(px * W - framed.size[0] / 2)
        y = int(py * H - framed.size[1] / 2)
        if sh:
            canvas.alpha_composite(sh, (x + 6, y + 10))
        canvas.alpha_composite(framed, (x, y))
    out = canvas.convert("RGB")
    out = linear_shade(out, top=0.55, bottom=0.45)
    out = canvas_grain(out, 7.0, seed=11)
    return grain(out, 3.5, seed=13)


def style_C(size, panels, gutter=0.018, top_pad=0.055, bot_pad=0.045, desat=1.0, dim=1.0, **kw):
    """Triptych: panels = [(art, focus, rel_w)] or [(art, focus, rel_w, contain)]."""
    W, H = size
    canvas = Image.new("RGBA", size, INK + (255,))
    g = int(W * gutter)
    inner_w = W - g * (len(panels) + 1)
    ph = H - int(H * (top_pad + bot_pad))
    x = g
    y0 = int(H * top_pad)
    for spec in panels:
        art, focus, rel_w = spec[0], spec[1], spec[2]
        contain = spec[3] if len(spec) > 3 else None
        pw = int(inner_w * rel_w)
        fig = _panel_fit(art, (pw, ph), focus, contain)
        if desat != 1.0 or dim != 1.0:
            fig = grade(fig, saturation=desat, brightness=dim)
        sh, framed = frame_panel(fig, (pw, ph), border=max(4, W // 620), hi=False, shadow=False)
        if sh:
            canvas.alpha_composite(sh, (x, y0))
        canvas.alpha_composite(framed, (x, y0))
        x += pw + g
    d = ImageDraw.Draw(canvas)
    d.line([g, y0 - int(H * 0.018), W - g, y0 - int(H * 0.018)], fill=GOLD + (150,),
           width=max(1, W // 1400))
    d.line([g, y0 + ph + int(H * 0.018), W - g, y0 + ph + int(H * 0.018)], fill=GOLD + (150,),
           width=max(1, W // 1400))
    out = canvas.convert("RGB")
    out = vignette(out, strength=0.55)
    out = linear_shade(out, top=0.4, bottom=0.35)
    out = canvas_grain(out, 8.0, seed=17)
    return grain(out, 3.0, seed=19)


def style_D(size, base_art, ghosts, base_bright=0.60, **kw):
    """ghosts = [(art, focus, center_rel, radius_rel, mode, opacity, extra_grade)]"""
    W, H = size
    base = fit_cover(plate(base_art), size, kw.get("base_focus", (0.5, 0.5)))
    base = grade(base, brightness=base_bright, saturation=0.68, contrast=1.05,
                 blur=1.4, warmth=0.1)
    canvas = base.convert("RGB")
    for art, focus, (cx, cy), (rx, ry), mode, op, bright in ghosts:
        gw, gh = int(W * rx * 2), int(H * ry * 2)
        gimg = fit_cover(plate(art), (gw, gh), focus)
        gimg = grade(gimg, brightness=bright * 1.45, saturation=0.85, contrast=1.05)
        mask = feathered_mask((gw, gh), (gw / 2, gh / 2), (gw / 2, gh / 2), feather=0.85)
        layer = Image.new("RGB", size, (0, 0, 0))
        layer.paste(gimg, (int(cx * W - gw / 2), int(cy * H - gh / 2)))
        full_mask = Image.new("L", size, 0)
        full_mask.paste(mask, (int(cx * W - gw / 2), int(cy * H - gh / 2)))
        canvas = blend(canvas, layer, full_mask, mode=mode, opacity=op)
    canvas = grade(canvas, saturation=0.82, contrast=1.06)
    canvas = vignette(canvas, strength=0.5)
    canvas = linear_shade(canvas, top=0.55, bottom=0.45)
    canvas = canvas_grain(canvas, 7.0, seed=23)
    return grain(canvas, 3.5, seed=29)


# ---------------------------------------------------------------- set table

def sets():
    """Return {id: (style_fn, kwargs, target_aspects)}"""
    S = {}

    # ---- A 单幅满铺 ----
    S["A1"] = (style_A, dict(art="Isle of Death", focus=(0.5, 0.52)), None)
    S["A2"] = (style_A, dict(art="Arnold_Böcklin_-_Die_Toteninsel_I", focus=(0.5, 0.5)), None)
    S["A3"] = (style_A, dict(art="Francisco_de_Goya,_Saturno", focus=(0.5, 0.22)), None)
    S["A4"] = (style_A, dict(art="Delacroix_-_La_Mort_de_Sardanapale", focus=(0.5, 0.45)), None)

    # ---- B 主画 + 细节拼贴 ----
    # panel = (art, focus, rel_w, (px, py), aspect, rotation)
    S["B1"] = (style_B, dict(
        base_art="Isle of Death", base_focus=(0.5, 0.5),
        panels=[
            ("Luzifer_(Lucifer)", (0.5, 0.30), 0.155, (0.135, 0.40), 0.80, -1.6),
            ("Simberg,_fresco_The_Wounded_Angel", (0.5, 0.5), 0.130, (0.855, 0.36), 1.18, 1.8),
            ("Francisco_de_Goya,_Saturno", (0.5, 0.24), 0.115, (0.845, 0.80), 0.72, -2.2),
            ("Hyacinthus_and_Zephyrus", (0.5, 0.5), 0.105, (0.148, 0.83), 1.00, 2.0),
        ]), None)

    S["B2"] = (style_B, dict(
        base_art="Francisco_de_Goya_y_Lucientes_-_Witches", base_focus=(0.5, 0.5),
        panels=[
            ("032-博斯", (0.5, 0.5), 0.165, (0.130, 0.33), 1.00, -1.2),
            ("1891_James_Ensor_Squelette", (0.5, 0.5), 0.175, (0.860, 0.62), 1.05, 1.5),
            ("The_Apparition,_Gustave_Moreau", (0.5, 0.28), 0.115, (0.155, 0.80), 0.68, -2.0),
        ]), None)

    S["B3"] = (style_B, dict(
        base_art="Kuoleman_Puutarha_by_Hugo_Simberg", base_focus=(0.5, 0.5),
        panels=[
            ("005-博斯", (0.5, 0.5), 0.150, (0.850, 0.35), 0.76, 1.4),
            ("Stuck,_Franz_von_-_Salome", (0.5, 0.35), 0.120, (0.140, 0.40), 0.78, -1.8),
            ("Van_Gogh_-_Trauernder", (0.5, 0.45), 0.140, (0.152, 0.82), 0.82, 2.1),
        ]), None)

    S["B4"] = (style_B, dict(
        base_art="The_Apparition,_Gustave_Moreau", base_focus=(0.5, 0.45),
        panels=[
            ("Kreuzigung", (0.5, 0.5), 0.170, (0.145, 0.35), 1.26, -1.5),
            ("Echo_and_Narcissus", (0.5, 0.5), 0.215, (0.855, 0.45), 1.55, 1.2),
            ("Cloches_du_soir", (0.5, 0.30), 0.125, (0.150, 0.82), 0.72, 2.3),
        ]), None)

    # ---- C 三联祭坛画 ----
    S["C1"] = (style_C, dict(panels=[
        ("Cloches_du_soir", (0.5, 0.40), 0.29),
        ("Luzifer_(Lucifer)", (0.5, 0.40), 0.42),
        ("Francisco_de_Goya,_Saturno", (0.5, 0.30), 0.29)]), None)

    S["C2"] = (style_C, dict(panels=[
        ("The_Apparition,_Gustave_Moreau", (0.5, 0.35), 0.28),
        ("Stuck,_Franz_von_-_Salome", (0.5, 0.30), 0.44),
        ("Alexandre_Cabanel_-_Fallen_Angel", (0.55, 0.45), 0.28)]), None)

    S["C3"] = (style_C, dict(panels=[
        ("Courtyard_with_Lunatics", (0.5, 0.5), 0.30),
        ("Van_Gogh_-_Trauernder", (0.5, 0.45), 0.40),
        ("VaterHirsch", (0.5, 0.42), 0.30)], desat=0.86, dim=0.88), None)

    S["C4"] = (style_C, dict(panels=[
        ("032-博斯", (0.5, 0.5), 0.27),
        ("018-博斯", (0.5, 0.5), 0.46),
        ("005-博斯", (0.5, 0.5), 0.27)], desat=0.92, dim=0.9), None)

    # ---- D 层叠蒙太奇 ----
    # ghost = (art, focus, (cx, cy), (rx, ry), mode, opacity, brightness)
    S["D1"] = (style_D, dict(
        base_art="Isle of Death", base_focus=(0.5, 0.5), base_bright=0.62,
        ghosts=[
            ("Francisco_de_Goya,_Saturno", (0.5, 0.22), (0.20, 0.46), (0.20, 0.40), "screen", 0.46, 0.70),
            ("Simberg,_fresco_The_Wounded_Angel", (0.5, 0.5), (0.83, 0.42), (0.20, 0.30), "screen", 0.42, 0.68),
            ("魔山艺术(2)", (0.5, 0.5), (0.50, 0.85), (0.32, 0.22), "screen", 0.28, 0.62),
        ]), None)

    S["D2"] = (style_D, dict(
        base_art="Arnold_Böcklin_-_Die_Toteninsel_I", base_focus=(0.5, 0.5), base_bright=0.66,
        ghosts=[
            ("Cloches_du_soir", (0.5, 0.40), (0.78, 0.40), (0.22, 0.34), "screen", 0.44, 0.70),
            ("Narcissus_on_a_Pompeian", (0.5, 0.4), (0.20, 0.55), (0.18, 0.28), "screen", 0.36, 0.62),
            ("Kongokai", (0.5, 0.5), (0.50, 0.80), (0.30, 0.25), "softlight", 0.40, 0.60),
        ]), None)

    S["D3"] = (style_D, dict(
        base_art="魔山艺术(1)", base_focus=(0.5, 0.5), base_bright=0.52,
        ghosts=[
            ("Francisco_de_Goya,_Saturno", (0.5, 0.24), (0.30, 0.48), (0.17, 0.36), "screen", 0.34, 0.58),
            ("1891_James_Ensor_Squelette", (0.5, 0.5), (0.74, 0.38), (0.22, 0.28), "screen", 0.36, 0.60),
            ("032-博斯", (0.5, 0.5), (0.55, 0.78), (0.26, 0.24), "screen", 0.28, 0.58),
        ]), None)

    S["D4"] = (style_D, dict(
        base_art="Courtyard_with_Lunatics", base_focus=(0.5, 0.5), base_bright=0.66,
        ghosts=[
            ("L'Intrigue_(James_Ensor", (0.5, 0.5), (0.72, 0.40), (0.24, 0.32), "screen", 0.40, 0.66),
            ("Francisco_de_Goya_y_Lucientes_-_Witches", (0.5, 0.5), (0.35, 0.74), (0.30, 0.20), "screen", 0.34, 0.64),
        ]), None)

    return S


# ---------------------------------------------------------------- preview / export

def contact_sheet(images, path, cols=4, cell=620, label_h=26):
    rows = (len(images) + cols - 1) // cols
    W, H = cols * cell, rows * (cell + label_h)
    sheet = Image.new("RGB", (W, H), (16, 15, 14))
    d = ImageDraw.Draw(sheet)
    for i, (name, im) in enumerate(images):
        r, c = divmod(i, cols)
        t = im.copy()
        t.thumbnail((cell - 6, cell - 6), Image.LANCZOS)
        sheet.paste(t, (c * cell + (cell - t.size[0]) // 2, r * (cell + label_h) + label_h +
                        (cell - t.size[1]) // 2))
        d.text((c * cell + 6, r * (cell + label_h) + 7), name, fill=(232, 222, 200))
    sheet.save(path, "JPEG", quality=88)
    print("sheet:", path, sheet.size)


def render(setid, fn, kwargs, size):
    im = fn(size, **kwargs)
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--preview", action="store_true", help="desktop-only contact sheet, no web export")
    args = ap.parse_args()

    S = sets()
    ids = [i for i in sorted(S) if not args.only or i in args.only.split(",")]
    made = []
    for sid in ids:
        fn, kwargs, _ = S[sid]
        suffix = "-m" if False else ""
        desk = fn(DESKTOP, **kwargs)
        mob = fn(MOBILE, **kwargs)
        p1 = os.path.join(OUT, f"{sid}{suffix}.jpg")
        p2 = os.path.join(OUT, f"{sid}-m{suffix}.jpg")
        desk.save(p1, "JPEG", quality=92, subsampling=0)
        mob.save(p2, "JPEG", quality=92, subsampling=0)
        made.append((sid, p1, p2))
        print(f"{sid}: {desk.size} {os.path.getsize(p1)//1024}KB | {mob.size} {os.path.getsize(p2)//1024}KB")

    contact_sheet([(sid, Image.open(p1)) for sid, p1, _ in made],
                  os.path.join(ROOT, "out_contact_desktop.jpg"))
    contact_sheet([(sid, Image.open(p2)) for sid, _, p2 in made],
                  os.path.join(ROOT, "out_contact_mobile.jpg"))


if __name__ == "__main__":
    main()
