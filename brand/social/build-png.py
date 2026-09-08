#!/usr/bin/env python3
"""RAREHAUS — rasterise every social SVG to an upload-ready PNG at native size.

Headless Chromium screenshots carry window insets that vary by platform, so the
asset is rendered inside a magenta field and cropped back to its exact bounds.
Magenta appears nowhere in the RAREHAUS palette, which makes the marker safe.

Requires Chromium/Chrome, Pillow, and the three brand faces installed locally
(Bodoni Moda, Archivo, IBM Plex Mono) — without them, typeset assets fall back.

    python3 brand/social/build-png.py [--chrome /path/to/chrome]
"""
import argparse, pathlib, re, shutil, subprocess, sys, tempfile
from PIL import Image

MARKER = (255, 0, 255)
PAD = 100
ROOT = pathlib.Path(__file__).parent

def find_chrome(explicit=None):
    for c in filter(None, [explicit, shutil.which("chromium"), shutil.which("google-chrome"),
                           shutil.which("chrome"), "/opt/pw-browsers/chromium"]):
        if pathlib.Path(c).exists():
            return c
    sys.exit("No Chromium/Chrome binary found — pass --chrome /path/to/chrome")

def shoot(chrome, src, w, h, out, tmp):
    wrap = tmp / "wrap.html"
    wrap.write_text(
        f'<style>html,body{{margin:0;background:rgb(255,0,255);overflow:hidden}}'
        f'img{{position:absolute;left:{PAD}px;top:{PAD}px;width:{w}px;height:{h}px;display:block}}</style>'
        f'<img src="{src.as_uri()}">')
    raw = tmp / "raw.png"
    subprocess.run([chrome, "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
                    "--force-device-scale-factor=1", "--virtual-time-budget=4000",
                    f"--window-size={w + PAD * 2},{h + PAD * 2}",
                    f"--screenshot={raw}", wrap.as_uri()],
                   check=True, capture_output=True)
    im = Image.open(raw).convert("RGB")
    mask = Image.new("L", im.size, 0)
    mask.putdata([0 if px == MARKER else 255 for px in im.get_flattened_data()]
                 if hasattr(im, "get_flattened_data") else
                 [0 if px == MARKER else 255 for px in list(im.getdata())])
    bbox = mask.getbbox()
    if bbox is None:
        sys.exit(f"{src.name}: nothing rendered inside the marker field")
    im.crop(bbox).save(out)
    return Image.open(out).size

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chrome")
    chrome = find_chrome(ap.parse_args().chrome)

    svgs = sorted(p for d in ("pfp", "covers", "posts", "stories") for p in (ROOT / d).glob("*.svg"))
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        for svg in svgs:
            head = svg.read_text()[:400]
            w = int(re.search(r'width="(\d+)"', head).group(1))
            h = int(re.search(r'height="(\d+)"', head).group(1))
            size = shoot(chrome, svg, w, h, svg.with_suffix(".png"), tmp)
            flag = "" if size == (w, h) else f"  <- expected {w}x{h}"
            print(f"  {svg.parent.name}/{svg.stem}.png  {size[0]}x{size[1]}{flag}")

        # Instagram serves the avatar at 320 in profile and as small as 32 in feed.
        # The monogram is the small-size variant — the arch fills in below ~64 px.
        for s in (320, 32):
            out = ROOT / "pfp" / f"pfp-monogram-{s}.png"
            size = shoot(chrome, ROOT / "pfp" / "pfp-monogram.svg", s, s, out, tmp)
            print(f"  pfp/{out.stem}.png  {size[0]}x{size[1]}")
    print("done.")

if __name__ == "__main__":
    main()
