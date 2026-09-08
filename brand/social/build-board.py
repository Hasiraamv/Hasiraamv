"""RAREHAUS — build the social kit board, inlining the generated SVGs.

Run from the repo root, after brand/social/generate.py:

    python3 brand/social/build-board.py
"""
import pathlib, re
S = pathlib.Path(__file__).parent
def art(p):
    s = (S / p).read_text()
    s = re.sub(r'\swidth="\d+"\s+height="\d+"', '', s, count=1)
    return s.replace("<svg ", '<svg class="asset" preserveAspectRatio="xMidYMid meet" ', 1).strip()

HEAD = '''<title>RAREHAUS Social Kit</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500&family=Archivo:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{--obsidian:#111111;--ivory:#F4F0E8;--stone:#D6D0C5;--champagne:#B4935A;--oxblood:#481B24;
--ink:#1C1A17;--ink-muted:#5B5751;--ivory-dim:#E7E2D8;--obsidian-3:#2A2926;
--display:"Bodoni Moda",Didot,Georgia,serif;--sans:"Archivo","Helvetica Neue",Arial,sans-serif;
--mono:"IBM Plex Mono",Menlo,monospace;--pad:clamp(24px,5vw,88px);
--shadow:0 20px 44px -26px rgba(17,17,17,.45)}
*{box-sizing:border-box}
body{background:var(--ivory);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding-inline:var(--pad)}
p{margin:0}
.eyebrow{font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:var(--ink-muted);font-weight:500;margin:0}
h2.sec{font-family:var(--display);font-size:clamp(27px,4vw,42px);font-weight:400;line-height:1.05;margin:0;text-wrap:balance}
h3{font-size:12px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;margin:0}
.note{font-size:13px;line-height:1.65;color:var(--ink-muted);max-width:64ch}
.caption{font-family:var(--mono);font-size:11px;letter-spacing:.06em;color:var(--ink-muted);text-transform:uppercase}
.rule{height:1px;background:var(--stone);border:0;margin:0}
section{padding-block:clamp(44px,6.5vw,92px)}
.sec-head{display:grid;grid-template-columns:auto 1fr;gap:clamp(20px,4vw,60px);align-items:start;padding-bottom:34px}
.sec-num{font-family:var(--mono);font-size:12px;color:var(--champagne);letter-spacing:.1em;padding-top:.7em}
.sec-intro{display:grid;gap:12px;max-width:70ch}
.grid{display:grid;gap:clamp(14px,2vw,26px)}
.g2{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.g3{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}
.g6{grid-template-columns:repeat(auto-fit,minmax(112px,1fr))}
.band{background:var(--obsidian);color:var(--ivory)}
.band .eyebrow,.band .note,.band .caption{color:#9C968C}
.band h3{color:var(--ivory)}
.band .rule{background:var(--obsidian-3)}
svg.asset{display:block;width:100%;height:auto}
.masthead{background:var(--obsidian);color:var(--ivory);padding-block:clamp(52px,8vw,104px);text-align:center}
.masthead .m{width:92px;margin-inline:auto}
.masthead h1{font-family:var(--display);font-weight:400;letter-spacing:.4em;text-indent:.4em;line-height:1;font-size:clamp(26px,6.4vw,68px);margin:34px 0 0}
.masthead .tag{font-size:clamp(10px,1.3vw,12px);letter-spacing:.44em;text-indent:.44em;text-transform:uppercase;color:var(--champagne);margin-top:20px}
.masthead .meta{display:flex;flex-wrap:wrap;gap:8px 30px;justify-content:center;margin-top:clamp(34px,5vw,60px);padding-top:22px;border-top:1px solid var(--obsidian-3);font-family:var(--mono);font-size:11px;letter-spacing:.08em;color:#8A857C;text-transform:uppercase}
/* avatar */
.av-row{display:flex;flex-wrap:wrap;gap:clamp(20px,4vw,52px);align-items:flex-end}
.av{display:grid;gap:10px;justify-items:center}
.av .crop{border-radius:50%;overflow:hidden;background:var(--obsidian);box-shadow:var(--shadow)}
.av .crop svg{display:block}
.av-320 .crop{width:160px;height:160px}
.av-88 .crop{width:88px;height:88px}
.av-32 .crop{width:32px;height:32px}
.pick{display:inline-flex;align-items:center;gap:7px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;font-weight:600;color:var(--champagne)}
.pick::before{content:"";width:6px;height:6px;background:var(--champagne);transform:rotate(45deg)}
/* asset frames */
.frame{background:var(--ivory-dim);border:1px solid var(--stone);padding:clamp(12px,2vw,22px);display:grid;place-items:center}
.band .frame{background:#0C0C0C;border-color:#1C1C1A}
.shot{box-shadow:var(--shadow);width:100%}
/* ig grid */
.igwrap{border:1px solid var(--stone);background:var(--ivory);box-shadow:var(--shadow)}
.ig-head{display:flex;gap:18px;padding:18px;align-items:center;border-bottom:1px solid var(--ivory-dim)}
.ig-av{width:68px;height:68px;border-radius:50%;overflow:hidden;flex:none}
.ig-handle{font-size:13px;font-weight:600;letter-spacing:.06em}
.ig-stats{display:flex;gap:18px;font-size:11px;color:var(--ink-muted);margin-top:7px}
.ig-stats b{display:block;color:var(--ink);font-family:var(--mono);font-size:12px}
.ig-bio{padding:0 18px 16px;font-size:11.5px;line-height:1.6;color:var(--ink-muted)}
.ig-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:var(--stone)}
.ig-grid > *{background:var(--obsidian);overflow:hidden;aspect-ratio:1}
.ig-grid svg{width:100%;height:100%}
/* story safe zone */
.safe{position:relative;width:100%;max-width:230px}
.safe .z{position:absolute;left:0;right:0;background:rgba(72,27,36,.55);color:#F4F0E8;font-family:var(--mono);font-size:9px;letter-spacing:.1em;display:grid;place-items:center;text-transform:uppercase}
.safe .z.top{top:0;height:13%}
.safe .z.bot{bottom:0;height:13%}
/* tables */
.tbl-scroll{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-muted);font-weight:600;padding:0 14px 10px 0;border-bottom:1px solid var(--stone);white-space:nowrap}
td{padding:11px 14px 11px 0;border-bottom:1px solid var(--ivory-dim);vertical-align:top}
td.m{font-family:var(--mono);font-size:12px;color:var(--ink-muted);white-space:nowrap}
.band th{border-color:var(--obsidian-3);color:#9C968C}
.band td{border-color:#1F1E1C;color:var(--ivory)}
.band td.m{color:#9C968C}
/* voice */
.vrow{display:grid;grid-template-columns:14px 1fr;gap:12px;font-size:13.5px;line-height:1.55;align-items:start}
.say .k{color:var(--champagne);font-family:var(--mono);font-size:12px}
.dont .k{color:var(--oxblood);font-family:var(--mono);font-size:12px}
.dont .t{color:var(--ink-muted)}
.cadence{display:grid;gap:10px}
.cad{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:baseline;padding-bottom:10px;border-bottom:1px solid var(--obsidian-3)}
.cad .d{font-family:var(--mono);font-size:11px;color:var(--champagne);letter-spacing:.1em}
.cad .w{font-size:13.5px;color:var(--ivory)}
.cad .f{font-family:var(--mono);font-size:11px;color:#8A857C}
code{font-family:var(--mono);font-size:12px;background:var(--ivory-dim);padding:2px 6px}
.band code{background:#1C1B19;color:#C9C3B7}
footer{background:var(--obsidian);color:#8A857C;padding-block:52px;text-align:center}
footer .wm{font-family:var(--display);letter-spacing:.36em;text-indent:.36em;color:var(--ivory);font-size:17px}
a:focus-visible{outline:2px solid var(--champagne);outline-offset:3px}
</style>
'''

def sec(num, eyebrow, title, note, body, band=False):
    return f'''<section>
  <div class="sec-head"><p class="sec-num">{num}</p><div class="sec-intro">
    <p class="eyebrow">{eyebrow}</p><h2 class="sec">{title}</h2><p class="note">{note}</p></div></div>
  {body}
</section>'''

out = [HEAD]
out.append(f'''<header class="masthead">
  <div class="m">{art("pfp/pfp-monogram.svg").replace('<rect width="1080" height="1080" fill="#111111"/>','')}</div>
  <h1>RAREHAUS</h1><p class="tag">Social Kit</p>
  <div class="meta"><span>Instagram</span><span>Avatar &middot; Grid &middot; Stories</span><span>Edition 01</span><span>RH-SOCIAL-0001</span></div>
</header>
<div class="wrap">''')

# 01 avatar
av = art("pfp/pfp-monogram.svg")
avs = art("pfp/pfp-obsidian.svg")
out.append(sec("01","Avatar","The monogram is the avatar. The seal is not.",
 "Instagram renders the avatar at 320&nbsp;px on the profile and as small as 32&nbsp;px beside a comment. Below roughly 64&nbsp;px the arch closes up and the RH inside it fills in, so the profile picture uses the monogram alone. The full seal stays for platforms that give the avatar real estate &mdash; YouTube, LinkedIn, a browser tab is fine at 32 because it is geometry only.",
 f'''<div class="av-row">
   <div class="av av-320"><div class="crop">{av}</div><span class="caption">320 &middot; profile</span><span class="pick">Use this</span></div>
   <div class="av av-88"><div class="crop">{av}</div><span class="caption">88 &middot; stories</span></div>
   <div class="av av-32"><div class="crop">{av}</div><span class="caption">32 &middot; comments</span></div>
   <div class="av av-88"><div class="crop">{avs}</div><span class="caption">Seal at 88</span><span class="caption" style="color:var(--oxblood)">Fills in</span></div>
 </div>
 <div class="grid g3" style="margin-top:40px">
  <div><h3>Primary</h3><p class="note" style="margin-top:8px">Champagne monogram on obsidian. <code>pfp-monogram.png</code></p></div>
  <div><h3>Light surfaces</h3><p class="note" style="margin-top:8px">Obsidian seal on ivory, where a platform forces a light avatar ring. <code>pfp-ivory.png</code></p></div>
  <div><h3>Reserve releases</h3><p class="note" style="margin-top:8px">Ivory seal on oxblood, swapped in for a Reserve drop week and swapped back. <code>pfp-oxblood.png</code></p></div>
 </div>'''))
out.append('<hr class="rule">')

# 02 grid
cells = "".join(f'<div>{art(p).replace(chr(34)+"xMidYMid meet"+chr(34), chr(34)+"xMidYMid slice"+chr(34))}</div>' for p in
  ["posts/post-product.svg","posts/post-statement.svg","posts/post-drop.svg",
   "posts/post-authentication.svg","posts/post-sold.svg","posts/post-product.svg",
   "posts/post-drop.svg","posts/post-statement.svg","posts/post-authentication.svg"])
out.append(sec("02","Grid","Object, statement, record — then repeat.",
 "The grid is read three across, so the rhythm is set by columns, not by single posts. One ivory statement per row keeps the profile from going flat black; two ivory posts in a row breaks it. Never place two product posts side by side &mdash; alternate the object with the record that proves it.",
 f'''<div class="grid" style="grid-template-columns:minmax(0,1.15fr) minmax(240px,.85fr);align-items:start">
   <div class="igwrap">
     <div class="ig-head"><div class="ig-av">{av}</div>
       <div><span class="ig-handle">rarehaus</span>
       <div class="ig-stats"><span><b>412</b>posts</span><span><b>84.6k</b>followers</span><span><b>7</b>following</span></div></div></div>
     <p class="ig-bio"><strong style="color:var(--ink)">RAREHAUS &mdash; The Home of Rare</strong><br>Authenticated in-house. Archive Release 04 opens Thursday 18:00 CET.</p>
     <div class="ig-grid">{cells}</div>
   </div>
   <div class="grid" style="gap:22px">
     <div><h3>Row rhythm</h3><p class="note" style="margin-top:8px">Object &rarr; statement &rarr; drop. The record post (authentication or sold) closes a release and opens the next row.</p></div>
     <div><h3>Ivory ration</h3><p class="note" style="margin-top:8px">One ivory post per row, never two adjacent. It is the only light surface the brand has on feed.</p></div>
     <div><h3>Crop</h3><p class="note" style="margin-top:8px">Posts are built 4:5 and cropped to 1:1 on the grid. Keep the mark and the price inside the centre square &mdash; the templates already do.</p></div>
     <div><h3>Carousels</h3><p class="note" style="margin-top:8px">Object first, detail macro second, authentication record last. Never lead with the certificate.</p></div>
   </div>
 </div>'''))
out.append('</div>')

# 03 posts (band)
posts = [("posts/post-drop.svg","Drop announcement","Release day and time only. No countdown stickers, no urgency copy."),
         ("posts/post-product.svg","Listing","One object, its grade, its ask, its serial. The frame is #191817, never pure black."),
         ("posts/post-statement.svg","Statement","The only ivory post. Voice, not inventory &mdash; run at most one per row."),
         ("posts/post-authentication.svg","Record","The certificate as a post. Closes a release; never opens one."),
         ("posts/post-sold.svg","Sold","Final price, stated flat. Proof the market cleared, not a victory lap.")]
cards = "".join(f'''<div class="grid" style="gap:10px"><div class="frame"><div class="shot">{art(p)}</div></div>
  <h3>{t}</h3><p class="note">{d}</p></div>''' for p,t,d in posts)
out.append(f'''<div class="band"><div class="wrap">
{sec("03","Feed templates","Five posts. Everything else is a variation.",
 "All built 1080&times;1350 &mdash; the tallest slot Instagram allows, and the one that takes the most of a scroll. Copy lives in <code>brand/social/generate.py</code>; change it there and re-run rather than editing the SVGs by hand.",
 f'<div class="grid g3">{cards}</div>')}
<hr class="rule">''')

# 04 stories
st = "".join(f'''<div class="grid" style="gap:10px"><div class="frame"><div class="shot">{art(p)}</div></div><h3>{t}</h3><p class="note">{d}</p></div>'''
 for p,t,d in [("stories/story-drop.svg","Countdown","Release story. The champagne bar is the only button the brand uses."),
               ("stories/story-authenticated.svg","Just authenticated","Runs the moment a piece clears QC, before it is listed.")])
safe = art("stories/story-drop.svg")
out.append(sec("04","Stories","Everything that matters sits in the middle 74%.",
 "1080&times;1920 with 250&nbsp;px of chrome top and bottom. Both templates keep type, mark and CTA inside that band, so a profile ring or a reply bar never crops a price or a time.",
 f'''<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
  {st}
  <div class="grid" style="gap:10px"><div class="frame"><div class="safe">{safe}
    <div class="z top">Avatar &amp; name</div><div class="z bot">Reply bar</div></div></div>
    <h3>Safe zone</h3><p class="note">Oxblood bands mark where Instagram draws its own UI. Nothing brand-critical enters them.</p></div>
 </div>''',band=True))
out.append('<hr class="rule">')

# 05 covers
cv = "".join(f'''<div class="grid" style="gap:9px"><div class="av"><div class="crop" style="width:100%;aspect-ratio:1">
  <div style="width:100%;height:100%;overflow:hidden;display:grid;place-items:center">{art(f"covers/cover-{n}.svg")}</div></div></div>
  <p class="caption" style="text-align:center">{n}</p></div>''' for n in
  ["archive","verified","sneakers","watches","bags","sell"])
out.append(sec("05","Highlight covers","Icons only — the label is cropped away.",
 "Instagram shows a highlight as a circle cut from the centre of a 1080&times;1920 image, so any word set on the cover disappears. The icon carries it; the highlight&rsquo;s own title carries the word.",
 f'<div class="grid g6">{cv}</div>',band=True))
out.append('</div></div>')

# 06 voice + specs
out.append('<div class="wrap">')
out.append(sec("06","Captions","Two lines. The record does the selling.",
 "Caption structure: what it is, then what is true about it. No hashtag walls &mdash; three at most, and only category tags a collector actually follows. Emoji never appear in brand-voice copy.",
 '''<div class="grid g2">
  <div class="grid say" style="gap:12px"><h3>We post</h3>
   <div class="vrow"><span class="k">&mdash;</span><span class="t">Air Max 1 &lsquo;Patta&rsquo;, UK 9, deadstock. Ask &pound;2,450. RH-SNK-04127-A.</span></div>
   <div class="vrow"><span class="k">&mdash;</span><span class="t">Release 04 opens Thursday, 18:00 CET. Twelve lots.</span></div>
   <div class="vrow"><span class="k">&mdash;</span><span class="t">Cleared authentication this morning. Graded EXC.</span></div>
   <div class="vrow"><span class="k">&mdash;</span><span class="t">We declined four pieces this week. Here is what gave them away.</span></div>
  </div>
  <div class="grid dont" style="gap:12px"><h3>We never post</h3>
   <div class="vrow"><span class="k">&times;</span><span class="t">Link in bio!! Don&rsquo;t sleep on this one &#128293;</span></div>
   <div class="vrow"><span class="k">&times;</span><span class="t">Tag someone who needs these</span></div>
   <div class="vrow"><span class="k">&times;</span><span class="t">#sneakerhead #hypebeast #grails #fyp #viral</span></div>
   <div class="vrow"><span class="k">&times;</span><span class="t">Giveaway &mdash; follow, like and share to win</span></div>
  </div>
 </div>'''))
out.append('</div>')

out.append(f'''<div class="band"><div class="wrap">
{sec("07","Cadence &amp; specs","One release week, posted five times.",
 "A release week is the unit. Outside a release week the account posts twice: one authentication record, one statement. Quiet is on-brand &mdash; a feed that posts daily is a shop, not an archive.",
 """<div class="cadence" style="margin-bottom:44px">
  <div class="cad"><span class="d">MON</span><span class="w">Statement post &mdash; what we turned down and why</span><span class="f">post-statement</span></div>
  <div class="cad"><span class="d">TUE</span><span class="w">Story: just authenticated, straight off the bench</span><span class="f">story-authenticated</span></div>
  <div class="cad"><span class="d">WED</span><span class="w">Drop announcement, lot count and time</span><span class="f">post-drop</span></div>
  <div class="cad"><span class="d">THU</span><span class="w">Release &mdash; listings as a carousel, story countdown</span><span class="f">post-product &middot; story-drop</span></div>
  <div class="cad"><span class="d">FRI</span><span class="w">Record &mdash; what sold, at what, and the certificate</span><span class="f">post-sold &middot; post-authentication</span></div>
 </div>
 <div class="tbl-scroll"><table>
  <thead><tr><th>Asset</th><th>Pixels</th><th>Ratio</th><th>File</th></tr></thead>
  <tbody>
   <tr><td>Profile picture</td><td class="m">1080 &times; 1080</td><td class="m">1:1</td><td class="m">pfp/pfp-monogram.png</td></tr>
   <tr><td>Feed post</td><td class="m">1080 &times; 1350</td><td class="m">4:5</td><td class="m">posts/*.png</td></tr>
   <tr><td>Story</td><td class="m">1080 &times; 1920</td><td class="m">9:16</td><td class="m">stories/*.png</td></tr>
   <tr><td>Highlight cover</td><td class="m">1080 &times; 1920</td><td class="m">9:16</td><td class="m">covers/*.png</td></tr>
   <tr><td>Grid crop</td><td class="m">1080 &times; 1080</td><td class="m">1:1</td><td class="m">centre crop of a 4:5 post</td></tr>
  </tbody></table></div>
 <p class="note" style="margin-top:28px">Edit copy in <code>brand/social/generate.py</code>, run it, then <code>brand/social/build-png.py</code> to re-export every PNG at native size. The three brand faces must be installed locally or typeset assets fall back.</p>""")}
</div></div>
<footer><p class="wm">RAREHAUS</p><p class="caption" style="margin-top:13px">Social kit &middot; Edition 01 &middot; RH-SOCIAL-0001</p></footer>''')

(S / "rarehaus-social-kit.html").write_text("\n".join(out))
print("written", len("\n".join(out)), "bytes")
