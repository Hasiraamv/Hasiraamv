# RAREHAUS — Social Kit

Instagram-first social assets, generated from the identity in `brand/`. Every file here is
produced by a script, so copy, colour and sizing change in one place rather than across
seventeen exported images.

```
brand/social/
├── rarehaus-social-kit.html   # the social board — open in a browser
├── generate.py                # authors every SVG from one token set
├── build-png.py               # rasterises each SVG to a native-size PNG
├── build-board.py             # rebuilds the board, inlining the SVGs
├── pfp/       pfp-monogram · pfp-obsidian · pfp-ivory · pfp-oxblood   1080×1080
├── covers/    archive · verified · sneakers · watches · bags · sell   1080×1920
├── posts/     drop · product · statement · authentication · sold      1080×1350
└── stories/   drop · authenticated                                    1080×1920
```

Each `.svg` has a matching `.png` at native size. Upload the PNGs; edit the SVGs.

## The profile picture

**Use `pfp/pfp-monogram.png`.** Instagram renders the avatar at 320 px on the profile and
as small as 32 px beside a comment, and below roughly 64 px the arch of the full seal
closes up and the RH inside it fills in. The monogram alone survives that. The complete
seal is right for platforms that give the avatar room — YouTube, LinkedIn — and for a
favicon, where it is geometry on a flat field rather than a shrunken photograph.

| File | Ground | Mark | Use |
|---|---|---|---|
| `pfp-monogram.png` | Obsidian | Champagne RH | **Instagram, X, TikTok — the default** |
| `pfp-obsidian.png` | Obsidian | Champagne seal | Larger avatars, YouTube, LinkedIn |
| `pfp-ivory.png` | Ivory | Obsidian seal | Where a platform forces a light avatar ring |
| `pfp-oxblood.png` | Oxblood | Ivory seal | Reserve release week only, then swapped back |

`pfp-monogram-320.png` and `pfp-monogram-32.png` are pre-rendered at display size to check
legibility before uploading — they are proofs, not upload files. Upload the 1080.

## Grid

The profile is read three across, so rhythm is set by columns rather than by single posts:
**object → statement → record.** One ivory statement post per row keeps the grid from going
flat black; two ivory posts in the same row breaks it. Never place two product posts side
by side — alternate the object with the record that proves it.

Posts are built 4:5 (the tallest slot Instagram gives) and center-crop to 1:1 on the grid.
The templates keep the mark and the price inside the center square.

## Cadence

A release week is the unit. Outside one, the account posts twice — one authentication
record, one statement. Quiet is on-brand; a feed that posts daily is a shop, not an archive.

| | | |
|---|---|---|
| Mon | Statement — what we turned down and why | `post-statement` |
| Tue | Story: just authenticated, off the bench | `story-authenticated` |
| Wed | Drop announcement, lot count and time | `post-drop` |
| Thu | Release — listings carousel, countdown story | `post-product` · `story-drop` |
| Fri | Record — what sold, at what, the certificate | `post-sold` · `post-authentication` |

Carousels run object first, detail macro second, authentication record last. Never lead
with the certificate.

## Captions

Two lines: what it is, then what is true about it. Three hashtags at most, and only
category tags a collector actually follows. No emoji in brand-voice copy.

> Air Max 1 'Patta', UK 9, deadstock. Ask £2,450. RH-SNK-04127-A.

> We declined four pieces this week. Here is what gave them away.

Never: *link in bio!!* · *tag someone who needs these* · hashtag walls · follow-to-win giveaways.

## Stories and highlight covers

Stories are 1080×1920 with 250 px of Instagram chrome top and bottom; both templates keep
type, mark and CTA inside the middle band. Highlight covers carry **icons only** — Instagram
cuts a circle from the center of the cover, so any word set on one disappears. The
highlight's own title carries the word.

## Regenerating

```bash
python3 brand/social/generate.py     # edit copy here first
python3 brand/social/build-png.py    # re-export every PNG at native size
python3 brand/social/build-board.py  # rebuild the board
```

`build-png.py` needs Chromium (or Chrome), Pillow, and the three brand faces installed
locally — Bodoni Moda, Archivo and IBM Plex Mono. Without them the typeset assets fall
back to system fonts and the exports are wrong. It renders each asset inside a magenta
field and crops back to exact bounds, because headless window insets vary by platform;
magenta appears nowhere in the palette, so the marker is safe.
