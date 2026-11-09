#!/usr/bin/env python3
"""Screenshot the Abstract Graph figures (element shots + context) for visual verification."""
import os
import shutil
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

PUB = os.path.expanduser("~/Desktop/blog/public")
SERVE = "/tmp/agserve"
OUT = os.path.expanduser("~/Desktop/blog-work/shots/ag")
URL = "http://127.0.0.1:8099/blog/"

os.makedirs(OUT, exist_ok=True)
shutil.rmtree(SERVE, ignore_errors=True)
os.makedirs(SERVE)
os.symlink(PUB, os.path.join(SERVE, "blog"))

srv = subprocess.Popen(
    [sys.executable, "-m", "http.server", "8099", "-d", SERVE],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(1.5)

PAGES = {
    "abe-en": "2024/05/24/abe-kobo-box-man/",
    "abe-zh": "zh-CN/2024/05/24/abe-kobo-box-man/",
    "teddy": "2026/06/25/teddy-paper/",
}

SHOTS = [
    ("abe-en-desktop-light", "abe-en", 1440, 900, "light", "figure"),
    ("abe-en-desktop-dark", "abe-en", 1440, 900, "dark", "figure"),
    ("abe-en-context-light", "abe-en", 1440, 900, "light", "context"),
    ("abe-en-mobile-light", "abe-en", 390, 844, "light", "figure"),
    ("abe-zh-desktop-light", "abe-zh", 1440, 900, "light", "figure"),
    ("abe-zh-desktop-dark", "abe-zh", 1440, 900, "dark", "figure"),
    ("abe-zh-tablet-light", "abe-zh", 768, 1024, "light", "figure"),
    ("abe-zh-mobile-light", "abe-zh", 390, 844, "light", "figure"),
    ("abe-zh-mobile-dark", "abe-zh", 390, 844, "dark", "figure"),
    ("teddy-desktop-light", "teddy", 1440, 900, "light", "figure"),
    ("teddy-desktop-dark", "teddy", 1440, 900, "dark", "figure"),
    ("teddy-mobile-light", "teddy", 390, 844, "light", "figure"),
]

MEASURE = """() => {
  const f = document.querySelector('figure.ag');
  if (!f) return null;
  const r = f.getBoundingClientRect();
  const node = f.querySelector('.ag-node');
  const cs = getComputedStyle(node);
  const canvas = f.querySelector('.ag-canvas').getBoundingClientRect();
  return {
    nodes: f.querySelectorAll('.ag-node').length,
    edgeLabels: f.querySelectorAll('.ag-edge-label').length,
    fig: Math.round(r.width) + 'x' + Math.round(r.height),
    canvas: Math.round(canvas.width) + 'x' + Math.round(canvas.height),
    fontSize: cs.fontSize,
    position: cs.position,
  };
}"""

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=os.path.expanduser(
                "~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome"
            ),
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        for name, page_key, w, h, theme, mode in SHOTS:
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            pg = ctx.new_page()
            pg.add_init_script(
                "try{localStorage.setItem('theme',JSON.stringify({value:'%s'}))}catch(e){}" % theme
            )
            errors = []
            pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.goto(URL + PAGES[page_key], wait_until="networkidle", timeout=45000)
            pg.wait_for_timeout(1000)
            el = pg.query_selector("figure.ag")
            if mode == "figure" and el:
                el.screenshot(path=os.path.join(OUT, name + ".png"))
            else:
                pg.screenshot(path=os.path.join(OUT, name + ".png"))
            info = pg.evaluate(MEASURE)
            print(f"{name:<26} {info} errors={errors[:2]}")
            ctx.close()
        browser.close()
finally:
    srv.terminate()

print("out:", OUT)
