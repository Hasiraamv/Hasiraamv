# RAREHAUS — Identity System

**The Home of Rare.** A resale archive for rare sneakers, streetwear, watches, bags and
collectible fashion. Everything here is buildable source, not a picture of a brand:
the logos are vectors, the palette and type are tokens, and the board renders the whole
system in a browser.

```
brand/
├── rarehaus-brand-board.html      # the guideline board — open in a browser
├── tokens/
│   ├── rarehaus.css               # CSS custom properties
│   └── rarehaus.tokens.json       # same values for build pipelines
├── logo/
│   ├── rh-seal.svg                # primary mark (open arch + RH)
│   ├── rh-seal-ivory.svg          # reversed
│   ├── rh-seal-champagne.svg      # foil application
│   ├── rh-monogram.svg            # RH alone — avatars, wax, tissue
│   ├── rh-monogram-ivory.svg
│   ├── rh-monogram-champagne.svg
│   ├── rh-app-icon.svg            # 512 obsidian tile, champagne seal
│   ├── rh-wordmark.svg            # typeset — see font note below
│   ├── rh-wordmark-ivory.svg
│   ├── rh-wordmark-champagne.svg
│   └── rh-lockup-stacked.svg      # seal + wordmark + tagline
├── patterns/
│   └── monogram-tile.svg          # half-drop tissue pattern, 200pt repeat
└── social/                        # Instagram kit — see social/README.md
```

## The mark

A freestanding arch — a vault door and a gallery doorway read at the same time —
containing a geometric RH drawn with one 13-unit stroke on a 200-unit grid. No crown, no
cart, no diamond. It is built to survive the three places most resale marks fail: a 16 px
favicon, a blind deboss at 8 mm, and a circular avatar crop (use `rh-monogram.svg` there —
the arch's feet crop away inside a circle).

| Rule | Value |
|---|---|
| Clear space | X on all sides, where X = arch width ÷ 4 |
| Minimum size — seal | 16 px digital / 8 mm print |
| Minimum size — wordmark | 90 px digital / 24 mm print |
| Emboss depth | 0.35 mm blind deboss, 600 gsm and above |
| Foil | Champagne 871 hot-stamp, seal only |

Never distort, rotate, recolour, or place the mark on a pattern or photograph without a
solid obsidian or ivory field beneath it.

## Colour

| Token | Hex | Use |
|---|---|---|
| Obsidian | `#111111` | Primary ground, packaging, display type |
| Warm Ivory | `#F4F0E8` | Paper stock, reversed type, presentation ground |
| Stone | `#D6D0C5` | Rules, dividers, secondary surface |
| Champagne | `#B4935A` | Verification, foil, accents — max 3% of any surface |
| Deep Oxblood | `#481B24` | Reserve tier and wax seals only, never UI |
| Warm Ink | `#5B5751` | Captions, metadata, SKU labels |

Working ratio: **60 obsidian / 30 ivory / 7 stone / 3 champagne.** Oxblood sits outside
the ratio and appears at most once per touchpoint.

## Typography

- **Bodoni Moda** — display. Product names, headlines, the wordmark (tracking `0.36em`).
- **Archivo** — interface. Navigation, body, uppercase labels (tracking `0.24em`).
- **IBM Plex Mono** — record. Serials, SKUs, grades, prices, dimensions. Anything a buyer
  has to read back exactly.

Scale is a 1.333 perfect fourth: `0.6875 · 0.8125 · 1 · 1.333 · 1.777 · 2.369 · 3.157 · 4.209 rem`.

### Font note on the SVG wordmark

`rh-wordmark*.svg` and `rh-lockup-stacked.svg` are typeset with live `<text>`, so they
need Bodoni Moda and Archivo installed to render as designed. Before shipping them to
print or to third parties, convert the text to outlines. The seal, monogram, app icon and
pattern are pure geometry and have no font dependency.

## Product record format

`RH-<CAT>-<5-digit>-<TIER>` — e.g. `RH-SNK-04127-A`.

Categories `SNK` sneakers · `WCH` watches · `BAG` bags · `RTW` ready-to-wear · `ACC` accessories.
Tier `A` archive · `R` reserve.
Grades `DS` deadstock · `VNDS` very near deadstock · `EXC` excellent · `GOOD`.

The serial belongs to the **piece**, not the order. It stays with the object through every
future resale, which is what the authentication card and the tag both reference.

## Using the tokens

```html
<link rel="stylesheet" href="brand/tokens/rarehaus.css">
```
```css
.button { background: var(--rh-obsidian); color: var(--rh-ivory); border-radius: var(--rh-radius); }
.verified { color: var(--rh-champagne); letter-spacing: var(--rh-track-label); }
```

`--rh-radius` is `0`. The identity is square; only physical goods (boxes, tags, cards) take
the 2 px `--rh-radius-vessel` that stands in for a die-cut corner.

## Generating photography

The board's appendix carries the image prompt for the **photographic layer only** —
interiors, materials, unboxing scenes. Generate those, then set the wordmark, seal and all
card copy from the vectors in `logo/`. Image models reliably distort letterforms; compositing
real type over generated photography is what keeps the kit accurate and trademark-safe.
