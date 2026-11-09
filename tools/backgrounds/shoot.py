#!/usr/bin/env python3
"""Screenshot the built site at several widths / themes for visual verification."""
import os, sys, shutil, subprocess, time, json
from playwright.sync_api import sync_playwright

PUB = os.path.expanduser("~/Desktop/blog/public")
SERVE = "/tmp/bgserve"
OUT = os.path.expanduser("~/Desktop/blog-work/shots")
URL = "http://127.0.0.1:8099/blog/"

os.makedirs(OUT, exist_ok=True)
shutil.rmtree(SERVE, ignore_errors=True)
os.makedirs(SERVE)
os.symlink(PUB, os.path.join(SERVE, "blog"))

srv = subprocess.Popen([sys.executable, "-m", "http.server", "8099", "-d", SERVE],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)

SHOTS = [
    ("home-light", 1440, 900, "light", URL),
    ("home-dark", 1440, 900, "dark", URL),
    ("home-mobile", 390, 844, "dark", URL),
    ("post-light", 1440, 900, "light", URL + "2026/09/13/hello-hexo-butterfly/"),
    ("about-light", 1440, 900, "light", URL + "about/"),
    ("archives-dark", 1440, 900, "dark", URL + "archives/"),
]
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=os.path.expanduser("~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome"),
            args=["--no-sandbox", "--disable-dev-shm-usage"])
        for name, w, h, theme, url in SHOTS:
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            page = ctx.new_page()
            page.add_init_script(
                "try{localStorage.setItem('theme','%s')}catch(e){}" % theme)
            errors = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(url, wait_until="networkidle", timeout=45000)
            page.wait_for_timeout(1200)
            page.screenshot(path=os.path.join(OUT, name + ".png"))
            bg = page.evaluate("() => { const b=document.getElementById('web_bg');"
                               "return b ? (b.dataset.bgArt || b.style.backgroundImage) : null; }")
            print(f"{name:<14} bg={bg}  errors={errors[:3]}")
            ctx.close()
        browser.close()
finally:
    srv.terminate()
print("shots ->", OUT)
