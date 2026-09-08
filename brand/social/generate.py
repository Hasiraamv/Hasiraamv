#!/usr/bin/env python3
"""RAREHAUS — social asset generator.

Emits every social SVG from one token set so copy, colour and sizing stay
editable in one place. Run from the repo root:

    python3 brand/social/generate.py

Then rasterise with brand/social/build-png.sh
"""
import os, pathlib

ROOT = pathlib.Path(__file__).parent
OBSIDIAN, IVORY, STONE = "#111111", "#F4F0E8", "#D6D0C5"
CHAMPAGNE, OXBLOOD, INK_MUTED = "#B4935A", "#481B24", "#8A857C"
DISPLAY = "Bodoni Moda, Didot, Georgia, serif"
SANS = "Archivo, Helvetica Neue, Arial, sans-serif"
MONO = "IBM Plex Mono, Menlo, monospace"

# --- the mark, as reusable geometry -----------------------------------------
MARK_PATHS = ('<path d="M37 60V140"/><path d="M37 60h31a16 16 0 0 1 0 32H37"/>'
              '<path d="M56 92l32 48"/><path d="M116 60v80"/><path d="M164 60v80"/>'
              '<path d="M116 100h48"/>')

def mark(color, sw=13):
    """RH monogram. Local box 30 53 141 94, optical centre (100.5, 100)."""
    return f'<g fill="none" stroke="{color}" stroke-width="{sw}">{MARK_PATHS}</g>'

def seal(color):
    """Open arch containing the monogram. Local box 0 0 200 200, centre (100,94)."""
    return (f'<g fill="none" stroke="{color}" stroke-width="10">'
            f'<path d="M33 155V100a67 67 0 0 1 134 0v55"/></g>'
            f'<g transform="translate(100 102) scale(.72) translate(-100.5 -100)">{mark(color)}</g>')

ICONS = {
 "sneaker": ('0 0 100 60', '<path d="M6 44V22h13l11 8 20 3 16 6 22 5v6a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z"/>'
                            '<path d="M19 22l7 12M32 30l6 10M50 33l4 9M6 44h82"/>'),
 "watch":   ('0 0 60 100', '<rect x="16" y="30" width="28" height="40" rx="4"/>'
                           '<path d="M22 30V12h16v18M22 70v18h16V70M44 46h5"/>'),
 "bag":     ('0 0 80 80',  '<path d="M14 28h52l-5 40H19z"/><path d="M28 28v-8a12 12 0 0 1 24 0v8"/>'),
 "sell":    ('0 0 80 80',  '<path d="M40 66V16M24 32L40 14l16 18M14 68h52"/>'),
}

def icon(name, color, sw=3.4):
    vb, paths = ICONS[name]
    return (vb, f'<g fill="none" stroke="{color}" stroke-width="{sw}" '
                f'stroke-linejoin="round" stroke-linecap="round">{paths}</g>')

def txt(x, y, s, *, font=SANS, size=20, fill=IVORY, weight=400,
        track=0, anchor="middle", style=""):
    ls = f' letter-spacing="{track}"' if track else ""
    st = f' font-style="{style}"' if style else ""
    return (f'<text x="{x}" y="{y}" text-anchor="{anchor}" fill="{fill}" '
            f'font-family="{font}" font-size="{size}" font-weight="{weight}"{ls}{st}>{s}</text>')

def svg(w, h, body, bg=OBSIDIAN, label=""):
    a = f' role="img" aria-label="{label}"' if label else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}"{a}>\n  <rect width="{w}" height="{h}" fill="{bg}"/>\n'
            f'{body}\n</svg>\n')

def write(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
    print(f"  {path}")

def place(inner, cx, cy, scale, ox, oy):
    return f'<g transform="translate({cx} {cy}) scale({scale}) translate({-ox} {-oy})">{inner}</g>'

# ---------------------------------------------------------------------------
# 1. Profile pictures — 1080x1080, geometry only.
#    Instagram crops to a circle and renders as small as 32 px in feed, so the
#    mark sits inside 62% of the frame and no type appears at all.
# ---------------------------------------------------------------------------
print("profile pictures")
write("pfp/pfp-obsidian.svg", svg(1080, 1080,
      place(seal(CHAMPAGNE), 540, 540, 3.7, 100, 94), OBSIDIAN,
      "RAREHAUS profile picture, champagne seal on obsidian"))
write("pfp/pfp-ivory.svg", svg(1080, 1080,
      place(seal(OBSIDIAN), 540, 540, 3.7, 100, 94), IVORY,
      "RAREHAUS profile picture, obsidian seal on ivory"))
write("pfp/pfp-monogram.svg", svg(1080, 1080,
      place(mark(CHAMPAGNE), 540, 540, 4.3, 100.5, 100), OBSIDIAN,
      "RAREHAUS profile picture, RH monogram on obsidian"))
write("pfp/pfp-oxblood.svg", svg(1080, 1080,
      place(seal(IVORY), 540, 540, 3.7, 100, 94), OXBLOOD,
      "RAREHAUS profile picture, ivory seal on oxblood — Reserve releases only"))

# ---------------------------------------------------------------------------
# 2. Story highlight covers — 1080x1920, icon centred in the circular crop.
# ---------------------------------------------------------------------------
print("highlight covers")
COVERS = [("archive", None), ("verified", None), ("sneakers", "sneaker"),
          ("watches", "watch"), ("bags", "bag"), ("sell", "sell")]
for name, ic in COVERS:
    if ic is None:
        art = place(seal(CHAMPAGNE), 540, 960, 1.9, 100, 94)
    else:
        vb, g = icon(ic, CHAMPAGNE, sw=3)
        _, _, vw, vh = [float(n) for n in vb.split()]
        s = 300 / max(vw, vh)
        art = place(g, 540, 960, s, vw / 2, vh / 2)
    write(f"covers/cover-{name}.svg",
          svg(1080, 1920, art, OBSIDIAN, f"RAREHAUS highlight cover — {name}"))

# ---------------------------------------------------------------------------
# 3. Feed posts — 1080x1350 (4:5, the largest slot Instagram gives you).
# ---------------------------------------------------------------------------
print("feed posts")
W, H = 1080, 1350

# 3a. Drop announcement
body = "".join([
    place(seal(CHAMPAGNE), 540, 400, 1.5, 100, 94),
    txt(540, 700, "The archive", font=DISPLAY, size=96, fill=IVORY),
    txt(540, 806, "opens Thursday.", font=DISPLAY, size=96, fill=IVORY, style="italic"),
    txt(540, 940, "12 LOTS &#183; 18:00 CET", font=MONO, size=26, fill=INK_MUTED, track=6),
    f'<path d="M420 1080h240" stroke="{CHAMPAGNE}" stroke-width="1.5"/>',
    txt(540, 1160, "THE HOME OF RARE", font=SANS, size=22, fill=CHAMPAGNE, track=11, weight=500),
])
write("posts/post-drop.svg", svg(W, H, body, OBSIDIAN, "Drop announcement post"))

# 3b. Product listing
vb, g = icon("sneaker", "#4A473F", sw=2.6)
body = "".join([
    f'<rect x="80" y="80" width="920" height="760" fill="#191817"/>',
    place(g, 540, 460, 4.6, 50, 30),
    f'<rect x="128" y="128" width="196" height="52" fill="none" stroke="{CHAMPAGNE}" stroke-width="1.5"/>',
    txt(226, 162, "VERIFIED", font=SANS, size=20, fill=CHAMPAGNE, track=6, weight=600),
    txt(80, 960, "Air Max 1 &#8216;Patta&#8217;", font=DISPLAY, size=76, fill=IVORY, anchor="start"),
    txt(80, 1024, "UK 9 &#183; DEADSTOCK", font=SANS, size=24, fill=INK_MUTED, track=8, anchor="start"),
    f'<path d="M80 1090h920" stroke="#2A2926" stroke-width="1.5"/>',
    txt(80, 1180, "LOWEST ASK", font=SANS, size=20, fill=INK_MUTED, track=7, anchor="start"),
    txt(80, 1250, "&#163;2,450", font=MONO, size=64, fill=IVORY, anchor="start"),
    txt(1000, 1250, "RH-SNK-04127-A", font=MONO, size=24, fill=CHAMPAGNE, anchor="end"),
])
write("posts/post-product.svg", svg(W, H, body, OBSIDIAN, "Product listing post"))

# 3c. Statement — the only ivory post in the system
body = "".join([
    place(seal(OBSIDIAN), 540, 260, 0.95, 100, 94),
    txt(540, 620, "Fewer pieces.", font=DISPLAY, size=104, fill="#1C1A17"),
    txt(540, 740, "Longer held.", font=DISPLAY, size=104, fill="#1C1A17", style="italic"),
    f'<path d="M480 850h120" stroke="{CHAMPAGNE}" stroke-width="1.5"/>',
    txt(540, 960, "We declined four pieces this week.", font=SANS, size=30, fill="#5B5751", weight=300),
    txt(540, 1250, "RAREHAUS", font=DISPLAY, size=34, fill="#1C1A17", track=14),
])
write("posts/post-statement.svg", svg(W, H, body, IVORY, "Statement post"))

# 3d. Authentication record
rows = [("SERIAL", "RH-SNK-04127-A"), ("CATEGORY", "SNEAKERS"), ("GRADE", "DS &#8212; DEADSTOCK"),
        ("EXAMINED", "08.09.2026"), ("AUTHENTICATOR", "A. M&#216;LLER &#183; #014")]
parts = [place(seal(CHAMPAGNE), 540, 300, 1.25, 100, 94),
         txt(540, 520, "Certificate of", font=DISPLAY, size=72, fill=IVORY),
         txt(540, 600, "Authentication", font=DISPLAY, size=72, fill=IVORY),
         f'<path d="M140 700h800" stroke="#2A2926" stroke-width="1.5"/>']
y = 790
for k, v in rows:
    parts += [txt(140, y, k, font=SANS, size=22, fill=INK_MUTED, track=6, anchor="start"),
              txt(940, y, v, font=MONO, size=26, fill=IVORY, anchor="end"),
              f'<path d="M140 {y + 34}h800" stroke="#2A2926" stroke-width="1"/>']
    y += 96
parts.append(txt(540, 1270, "EXAMINED IN-HOUSE BEFORE LISTING", font=SANS, size=20,
                 fill=CHAMPAGNE, track=8, weight=500))
write("posts/post-authentication.svg", svg(W, H, "".join(parts), OBSIDIAN, "Authentication record post"))

# 3e. Sold record
body = "".join([
    txt(540, 500, "SOLD", font=DISPLAY, size=190, fill=IVORY, track=30),
    f'<path d="M300 580h480" stroke="{CHAMPAGNE}" stroke-width="1.5"/>',
    txt(540, 700, "Ref. 16610LV Steel", font=DISPLAY, size=62, fill=IVORY),
    txt(540, 780, "GRADE EXC &#183; RH-WCH-00318-R", font=MONO, size=26, fill=INK_MUTED, track=4),
    txt(540, 960, "&#163;14,200", font=MONO, size=76, fill=CHAMPAGNE),
    txt(540, 1030, "FINAL", font=SANS, size=22, fill=INK_MUTED, track=10),
    place(seal(IVORY), 540, 1220, 0.8, 100, 94),
])
write("posts/post-sold.svg", svg(W, H, body, OBSIDIAN, "Sold record post"))

# ---------------------------------------------------------------------------
# 4. Stories — 1080x1920. Everything essential sits inside the 250/250 safe
#    band so the UI chrome never crops it.
# ---------------------------------------------------------------------------
print("stories")
SW, SH = 1080, 1920
body = "".join([
    place(seal(CHAMPAGNE), 540, 620, 1.7, 100, 94),
    txt(540, 900, "Archive", font=DISPLAY, size=110, fill=IVORY),
    txt(540, 1020, "Release 04", font=DISPLAY, size=110, fill=IVORY, style="italic"),
    f'<path d="M440 1120h200" stroke="{CHAMPAGNE}" stroke-width="1.5"/>',
    txt(540, 1230, "12 LOTS &#183; THURSDAY 18:00 CET", font=MONO, size=28, fill=INK_MUTED, track=4),
    f'<rect x="330" y="1360" width="420" height="96" fill="{CHAMPAGNE}"/>',
    txt(540, 1420, "SET A REMINDER", font=SANS, size=24, fill="#171310", track=8, weight=600),
    txt(540, 1620, "THE HOME OF RARE", font=SANS, size=22, fill=INK_MUTED, track=11),
])
write("stories/story-drop.svg", svg(SW, SH, body, OBSIDIAN, "Drop countdown story"))

vb, g = icon("watch", "#4A473F", sw=2.6)
body = "".join([
    txt(540, 420, "JUST AUTHENTICATED", font=SANS, size=24, fill=CHAMPAGNE, track=10, weight=600),
    f'<rect x="140" y="500" width="800" height="800" fill="#191817"/>',
    place(g, 540, 900, 8.0, 30, 50),
    txt(540, 1430, "Ref. 16610LV Steel", font=DISPLAY, size=76, fill=IVORY),
    txt(540, 1510, "GRADE EXC &#183; RH-WCH-00318-R", font=MONO, size=26, fill=INK_MUTED, track=4),
    txt(540, 1650, "&#163;14,200", font=MONO, size=54, fill=CHAMPAGNE),
])
write("stories/story-authenticated.svg", svg(SW, SH, body, OBSIDIAN, "Newly authenticated story"))

print("\ndone.")
