import { escapeHtml, formatINR, icon, productCard } from '../render.js';

export function homePage({ categories, newArrivals, regions, stats, env }) {
  return `
<section class="dark" style="padding:80px 0;">
  <div class="wrap hero-split" style="display:grid; grid-template-columns:1.05fr .95fr; gap:56px; align-items:center;">
    <div>
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
        <span style="width:34px; height:1px; background:var(--gold-light); display:block;"></span>
        <span class="tag" style="color:var(--gold-light)">Every seller compared. One price you can trust.</span>
      </div>
      <h1 class="serif" style="font-size:64px; line-height:1.05; margin:0 0 22px;">
        Sourced abroad.<br>Proven before <em style="color:var(--gold-light)">it ships.</em>
      </h1>
      <p style="max-width:470px; font-size:16.5px; line-height:1.72; color:#b3ab99; margin:0 0 26px;">
        We put every verified seller's price for a piece side by side, authenticate it twice
        before it moves, and tell you exactly where it is coming from and when it lands.
      </p>
      <div style="display:flex; gap:14px; flex-wrap:wrap;">
        <a class="btn btn-gold" href="/c/all">Shop ${escapeHtml(env?.SITE_NAME || 'Mintmark')}</a>
        <a class="btn btn-outline" href="/authentication" style="color:#f2ede2; border-color:#4a4336;">How authentication works</a>
      </div>
      <div style="display:flex; gap:32px; margin-top:34px; padding-top:22px; border-top:1px solid var(--line-dark); flex-wrap:wrap;">
        <div><div class="serif" style="font-size:24px; color:#f2ede2;">${stats.sellers}</div><div style="font-size:12px; color:#8b8474;">KYC-verified sellers</div></div>
        <div><div class="serif" style="font-size:24px; color:#f2ede2;">${stats.listings}</div><div style="font-size:12px; color:#8b8474;">Live listings</div></div>
        <div><div class="serif" style="font-size:24px; color:#f2ede2;">14–28 days</div><div style="font-size:12px; color:#8b8474;">Typical import window</div></div>
      </div>
    </div>
    <div>
      <div style="height:430px; background:linear-gradient(155deg,#3a332a,#1d1913); position:relative;">
        <span style="position:absolute; bottom:20px; left:20px; display:flex; align-items:center; gap:9px; background:rgba(22,19,15,.9); border:1px solid #3f382c; padding:8px 12px; font-size:11px; color:var(--gold-light); font-weight:600; letter-spacing:.08em;">
          ${icon('check', '#cba25a', 12)} DUAL AUTHENTICATED
        </span>
      </div>
    </div>
  </div>
</section>

<section style="background:var(--paper-alt); border-bottom:1px solid var(--line);">
  <div class="wrap trust-bar" style="display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:0;">
    ${[
      ['shield', 'Dual authentication', 'Seller-verified, then re-checked in-house'],
      ['doc', 'Certificate with every order', 'Numbered and verifiable online'],
      ['bars', 'Sellers compete on price', 'Every offer shown, lowest on top'],
      ['truck', 'Duties &amp; customs handled', 'Landed price, insured door to door'],
    ]
      .map(
        ([ic, title, sub], i) => `
      <div style="display:flex; gap:14px; padding:26px 30px; ${
        i < 3 ? 'border-right:1px solid var(--line);' : ''
      } align-items:flex-start;">
        ${icon(ic, '#a17c3a', 19)}
        <div>
          <div style="font-size:13.5px; font-weight:600; margin-bottom:3px;">${title}</div>
          <div style="font-size:12.5px; color:var(--muted); line-height:1.5;">${sub}</div>
        </div>
      </div>`
      )
      .join('')}
  </div>
</section>

<section class="section">
  <div class="section-head">
    <div><span class="tag gold">Browse</span><h2 class="serif">Shop by category</h2></div>
  </div>
  <div class="grid grid-3">
    ${categories
      .map(
        (c, i) => `
      <a href="/c/${escapeHtml(c.slug)}" style="aspect-ratio:4/3; background:${
          i === 2
            ? 'linear-gradient(160deg,#22201a,#3b352b)'
            : 'linear-gradient(160deg,#e7e0cf,#d5cdb8)'
        }; display:flex; flex-direction:column; justify-content:flex-end; padding:22px; color:${
          i === 2 ? '#f2ede2' : 'var(--text)'
        };">
        <span class="serif" style="font-size:25px;">${escapeHtml(c.name)}</span>
        <span style="font-size:12px; color:${
          i === 2 ? '#a49b88' : 'var(--muted)'
        }; margin-top:3px;">${c.listing_count || 0} listings${
          c.from_price ? ` · from ${formatINR(c.from_price)}` : ''
        }</span>
      </a>`
      )
      .join('')}
  </div>
</section>

<section class="section">
  <div class="section-head">
    <div><span class="tag gold">Just landed</span><h2 class="serif">New this week</h2></div>
    <div class="chips">
      <a class="chip active" href="/c/all">All</a>
      <a class="chip" href="/c/all?max=100000">Under ₹1,00,000</a>
      <a class="chip" href="/c/all?under_retail=1">Under retail</a>
      <a class="chip" href="/c/all?lead=14">Arrives in 2 weeks</a>
    </div>
  </div>
  <div class="card-grid">
    ${newArrivals.map(productCard).join('')}
  </div>
</section>

<section class="dark" style="margin-top:88px; padding:80px 0;">
  <div class="wrap">
    <div class="section-head" style="margin-bottom:44px;">
      <div><span class="tag" style="color:var(--gold-light)">How it works</span>
      <h2 class="serif" style="font-size:38px; margin:10px 0 0;">Four steps between a listing and your door.</h2></div>
    </div>
    <div class="grid grid-4">
      ${[
        ['01', "Every seller's price, side by side", 'One listing per piece, with every verified seller’s offer for your size underneath — lowest landed price on top.'],
        ['02', 'Checked before it leaves the country', 'The seller authenticates it and uploads their report; we do not accept a listing without one.'],
        ['03', 'Re-checked and sealed by us', 'An independent 30-point inspection at our facility, then a tamper-evident seal and a numbered certificate.'],
        ['04', 'Imported, duties paid, tracked', 'Insured transit with live tracking and customs handled — the price you saw is the price you pay.'],
      ]
        .map(
          ([n, t, d]) => `
        <div style="border-top:1px solid var(--line-dark); padding-top:24px;">
          <div class="serif" style="font-size:32px; color:var(--gold-light); margin-bottom:12px;">${n}</div>
          <div style="font-size:15.5px; font-weight:600; margin-bottom:8px;">${t}</div>
          <div style="font-size:13px; color:#8b8474; line-height:1.65;">${d}</div>
        </div>`
        )
        .join('')}
    </div>
    <div class="cert" style="display:flex; align-items:center; gap:32px; margin-top:52px; flex-wrap:wrap;">
      <div>
        <div class="tag" style="color:var(--gold-light)">Certificate No.</div>
        <div class="no">MM-26-TYO-SNK-00248-M</div>
      </div>
      <div style="flex-grow:1; min-width:260px; font-size:13.5px; color:#b3ab99; line-height:1.6;">
        Every order ships with a numbered certificate and both inspection reports.
        If a piece ever fails an independent check, we refund it in full.
      </div>
      <a class="btn btn-outline" href="/verify" style="color:#f2ede2; border-color:#4a4336;">Verify a certificate</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="section-head">
    <h2 class="serif" style="font-size:26px;">Where this week's pieces are coming from</h2>
  </div>
  <div class="grid grid-6">
    ${regions
      .map(
        (r) => `
      <div class="panel" style="padding:18px 20px;">
        <div class="serif" style="font-size:19px;">${escapeHtml(r.city)}</div>
        <div style="font-size:11.5px; color:var(--faint); margin-top:4px;">${r.lead_min}–${r.lead_max} days · ${r.listings} listings</div>
      </div>`
      )
      .join('')}
  </div>
</section>

<section class="section">
  <div style="background:var(--paper-alt); border:1px solid var(--line); padding:48px;">
    <div class="grid grid-2" style="gap:56px; align-items:center;">
      <div>
        <span class="tag gold">Not listed yet?</span>
        <h2 class="serif" style="font-size:36px; margin:10px 0 14px;">Tell us what to hunt for.</h2>
        <p style="font-size:15.5px; line-height:1.7; color:#5c5748; margin:0 0 18px;">
          Name the piece, the size and your ceiling. We put it to our seller network across six
          regions and come back with photos, condition notes and a landed price — no obligation
          until you say yes.
        </p>
        <div style="display:flex; align-items:center; gap:9px; font-size:13px; color:#5c5748;">
          ${icon('whatsapp', '#3f5f45', 16)} Or send us a photo on WhatsApp — ${escapeHtml(
    env?.SUPPORT_WHATSAPP || '[YOUR NUMBER]'
  )}
        </div>
      </div>
      <form method="post" action="/sourcing-requests">
        <div class="field"><input name="item" placeholder="What are you looking for?" required maxlength="200"></div>
        <div class="form-row">
          <div class="field"><input name="size" placeholder="Size" maxlength="40"></div>
          <div class="field"><input name="budget" placeholder="Budget ceiling (₹)" inputmode="numeric" maxlength="12"></div>
        </div>
        <div class="field"><input name="contact" placeholder="Email or WhatsApp number" required maxlength="120"></div>
        <button class="btn btn-block" type="submit">Submit a sourcing request</button>
      </form>
    </div>
  </div>
</section>
`;
}
