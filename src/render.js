// Layout, styles and shared components. The design is served as one stylesheet at
// /styles.css rather than inline attributes, so pages stay small and cacheable.

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Indian digit grouping: 4,05,000 rather than 405,000.
export function formatINR(amount) {
  if (amount === null || amount === undefined) return '—';
  const n = Math.round(Number(amount));
  const s = String(Math.abs(n));
  let out;
  if (s.length <= 3) {
    out = s;
  } else {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    out = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }
  return (n < 0 ? '-₹' : '₹') + out;
}

export function leadWindow(offer) {
  if (!offer) return '';
  return `${offer.lead_days_min}–${offer.lead_days_max} days`;
}

export function etaDates(minDays, maxDays, from = new Date()) {
  const fmt = (d) =>
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const a = new Date(from.getTime() + minDays * 86400000);
  const b = new Date(from.getTime() + maxDays * 86400000);
  return { from: fmt(a), to: fmt(b), iso: [a.toISOString().slice(0, 10), b.toISOString().slice(0, 10)] };
}

export const STYLES = `
:root {
  --paper: #f7f4ee;
  --paper-alt: #efe9dc;
  --card: #fffdf8;
  --ink: #16130f;
  --ink-soft: #22201a;
  --text: #22201a;
  --muted: #6f6959;
  --faint: #8a8271;
  --line: #e0d9c8;
  --line-dark: #2e281f;
  --gold: #a17c3a;
  --gold-light: #cba25a;
  --green: #3f5f45;
  --tile: #ece6d9;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--text);
  font-family: 'Work Sans', system-ui, -apple-system, sans-serif;
  font-size: 15px;
  line-height: 1.5;
}
.serif { font-family: 'Newsreader', Georgia, serif; font-weight: 400; }
a { color: var(--gold); text-decoration: none; }
a:hover { color: #7d5f28; }
img { max-width: 100%; display: block; }
button, input, select, textarea { font: inherit; color: inherit; }

.wrap { max-width: 1440px; margin: 0 auto; padding: 0 72px; }
.tag {
  letter-spacing: 0.14em; text-transform: uppercase;
  font-size: 11px; font-weight: 600;
}
.gold { color: var(--gold); }
.muted { color: var(--muted); }
.faint { color: var(--faint); }

/* Header ------------------------------------------------------------ */
.announce {
  background: var(--ink); color: #a49b88; text-align: center;
  padding: 11px 16px;
}
.announce .sep { color: #4a4436; margin: 0 10px; }
.nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 22px 72px; max-width: 1440px; margin: 0 auto; gap: 24px;
}
.logo {
  font-family: 'Newsreader', Georgia, serif;
  font-size: 27px; font-weight: 500; letter-spacing: 0.07em;
  color: var(--text); white-space: nowrap;
}
.nav-links { display: flex; gap: 30px; font-size: 13.5px; font-weight: 500; }
.nav-links a { color: #3a362c; }
.nav-right { display: flex; align-items: center; gap: 16px; font-size: 13px; }
.nav-right a { color: #3a362c; }
.search {
  display: flex; align-items: center; gap: 9px;
  border: 1px solid #ddd5c2; background: var(--card);
  padding: 8px 13px; min-width: 190px;
}
.search input { border: 0; background: none; outline: none; width: 100%; font-size: 12.5px; }
.subnav {
  display: flex; gap: 26px; padding: 0 72px 14px;
  max-width: 1440px; margin: 0 auto;
  font-size: 12.5px; color: var(--muted);
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
}
.subnav a { color: var(--muted); white-space: nowrap; }
.subnav a.active { color: var(--gold); font-weight: 600; }

/* Buttons ----------------------------------------------------------- */
.btn {
  display: inline-block; padding: 15px 32px; font-size: 14px; font-weight: 600;
  border: 1px solid transparent; cursor: pointer; text-align: center;
  background: var(--ink-soft); color: var(--paper);
}
.btn:hover { color: var(--paper); background: #000; }
.btn-gold { background: var(--gold-light); color: var(--ink); }
.btn-gold:hover { background: #dbb877; color: var(--ink); }
.btn-outline { background: none; color: var(--text); border-color: #ddd5c2; }
.btn-outline:hover { background: var(--paper-alt); color: var(--text); }
.btn-block { display: block; width: 100%; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* Generic blocks ---------------------------------------------------- */
.section { padding: 84px 72px 0; max-width: 1440px; margin: 0 auto; }
.section-head {
  display: flex; justify-content: space-between; align-items: flex-end;
  margin-bottom: 32px; gap: 24px; flex-wrap: wrap;
}
.section-head h2 { font-size: 38px; margin: 10px 0 0; font-weight: 400; }
.grid { display: grid; gap: 22px; }
.grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.grid-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.panel { background: var(--card); border: 1px solid var(--line); }
.dark { background: var(--ink); color: #f2ede2; }
.dark a { color: var(--gold-light); }
.dark .muted { color: #8b8474; }

/* Product cards ----------------------------------------------------- */
.card-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px; }
.pcard { display: flex; flex-direction: column; gap: 12px; }
.pcard .shot {
  aspect-ratio: 1/1; background: var(--tile); position: relative; overflow: hidden;
}
.pcard .shot img { width: 100%; height: 100%; object-fit: cover; }
.pcard .title { font-size: 14px; font-weight: 600; color: var(--text); }
.pcard .meta { font-size: 12px; color: var(--muted); margin-top: 5px; display: flex; align-items: center; gap: 6px; }
.pcard .price { font-family: 'Newsreader', Georgia, serif; font-size: 19px; margin-top: 8px; }
.pcard .sellers { font-size: 11.5px; color: var(--faint); margin-left: 8px; }
.badge {
  position: absolute; top: 12px; left: 12px;
  display: flex; align-items: center; gap: 6px;
  background: var(--card); border: 1px solid #ddd5c2; padding: 5px 9px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.07em; color: var(--gold);
}
.badge-right {
  position: absolute; top: 12px; right: 12px; left: auto;
  background: var(--ink-soft); color: var(--paper); border: 0;
}
.badge-under { background: var(--green); color: #f2ede2; border: 0; }

/* Filters ----------------------------------------------------------- */
.chips { display: flex; gap: 10px; flex-wrap: wrap; }
.chip {
  padding: 9px 16px; border: 1px solid #ddd5c2; font-size: 12.5px;
  color: var(--text); background: none;
}
.chip.active { background: var(--ink-soft); color: var(--paper); border-color: var(--ink-soft); }

/* Tables ------------------------------------------------------------ */
.table { width: 100%; border-collapse: collapse; background: var(--card); }
.table th {
  text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--muted); font-weight: 600; padding: 14px 20px;
  background: var(--paper-alt); border-bottom: 1px solid var(--line);
}
.table td { padding: 16px 20px; border-bottom: 1px solid #eee8db; font-size: 13.5px; vertical-align: middle; }
.table tr.best td { background: #fdfbf4; }
.table td.num, .table th.num { text-align: right; }

/* Forms ------------------------------------------------------------- */
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.field label { font-size: 12.5px; font-weight: 600; }
.field input, .field select, .field textarea {
  border: 1px solid #ddd5c2; background: var(--card); padding: 13px 15px;
  font-size: 14px; outline: none; width: 100%;
}
.field input:focus, .field textarea:focus, .field select:focus { border-color: var(--gold); }
.field .hint { font-size: 11.5px; color: var(--faint); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.notice { padding: 14px 18px; border: 1px solid var(--line); background: var(--paper-alt); font-size: 13.5px; }
.notice-bad { border-color: #c9a3a3; background: #f6ecec; color: #7a3030; }
.notice-good { border-color: #a8bda9; background: #eef3ee; color: #2f4a34; }

/* Sizes ------------------------------------------------------------- */
.sizes { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.size {
  border: 1px solid #ddd5c2; background: var(--card); padding: 11px 6px;
  text-align: center; cursor: pointer; color: var(--text);
}
.size.active { background: var(--ink-soft); color: var(--paper); border-color: var(--ink-soft); }
.size.out { background: #f1ede2; color: #b0a893; cursor: default; }
.size .n { font-size: 13.5px; font-weight: 600; }
.size .p { font-size: 10.5px; margin-top: 3px; opacity: 0.85; }

/* Timeline ---------------------------------------------------------- */
.timeline { display: flex; gap: 8px; }
.stage { flex: 1; }
.stage .bar { height: 3px; margin-bottom: 10px; background: #e8e0cd; }
.stage.done .bar { background: var(--gold); }
.stage.current .bar { background: var(--gold-light); }
.stage .label { font-size: 11.5px; font-weight: 600; }
.stage .sub { font-size: 11px; color: var(--faint); margin-top: 2px; }

/* Certificate ------------------------------------------------------- */
.cert {
  border: 1px solid var(--line-dark); background: #1c1813; color: #f2ede2;
  padding: 28px 32px;
}
.cert .no { font-family: 'Newsreader', Georgia, serif; font-size: 26px; letter-spacing: 0.08em; }
.cert-card {
  background: #16130f; color: #f2ede2; padding: 44px; border: 1px solid var(--line-dark);
  max-width: 720px; margin: 0 auto;
}
.cert-row { display: flex; justify-content: space-between; gap: 20px; padding: 11px 0; border-bottom: 1px solid var(--line-dark); font-size: 13.5px; }
.cert-row .k { color: #8b8474; }

/* Footer ------------------------------------------------------------ */
.footer { background: var(--ink); color: #8b8474; margin-top: 88px; padding: 56px 72px; }
.footer-inner { max-width: 1440px; margin: 0 auto; }
.footer a { color: #8b8474; }
.footer a:hover { color: #f2ede2; }
.footer h4 { color: #f2ede2; font-size: 12.5px; margin: 0 0 12px; font-weight: 600; }
.footer .cols { display: flex; justify-content: space-between; gap: 48px; padding-bottom: 40px; flex-wrap: wrap; }
.footer .col { display: flex; flex-direction: column; gap: 10px; font-size: 12.5px; }
.footer .bottom {
  display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap;
  padding-top: 24px; border-top: 1px solid var(--line-dark); font-size: 12px;
}

/* Mobile ------------------------------------------------------------ */
@media (max-width: 900px) {
  .wrap, .nav, .subnav, .section, .footer { padding-left: 20px; padding-right: 20px; }
  .nav { flex-wrap: wrap; gap: 12px; }
  .nav-links { order: 3; width: 100%; overflow-x: auto; gap: 20px; padding-bottom: 4px; }
  .search { display: none; }
  .section { padding-top: 44px; }
  .section-head h2 { font-size: 27px; }
  .grid-2 { grid-template-columns: 1fr; }
  .grid-3, .grid-4, .grid-6 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .trust-bar { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .trust-bar > div { border-right: 0 !important; border-bottom: 1px solid var(--line); }
  .card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .form-row { grid-template-columns: 1fr; }
  .hero-split, .pdp, .split { grid-template-columns: 1fr !important; }
  .sizes { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .table thead { display: none; }
  .table tr { display: block; border-bottom: 1px solid var(--line); padding: 12px 0; }
  .table td { display: flex; justify-content: space-between; border: 0; padding: 6px 16px; }
  .table td::before { content: attr(data-label); color: var(--muted); font-size: 12px; }
  .table td.num { text-align: right; }
  .footer .cols { flex-direction: column; gap: 28px; }
  .btn { padding: 15px 22px; }
}

@media print {
  .no-print { display: none !important; }
  body { background: #fff; }
  .cert-card { border: 1px solid #000; }
}
`;

const FONTS =
  'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Work+Sans:wght@400;500;600&display=swap';

export function icon(name, color = 'currentColor', size = 16) {
  const paths = {
    check: '<path d="M20 6L9 17l-5-5"/>',
    shield: '<path d="M12 3l7 3v6c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    pin: '<path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>',
    truck: '<rect x="2" y="7" width="14" height="10" rx="1"/><path d="M16 10h3.5L22 13v4h-6"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    doc: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"/><path d="M8 13h8M8 17h5"/>',
    bars: '<path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/>',
    bag: '<path d="M6 8V6a6 6 0 0112 0v2M4 8h16l-1.2 12.2A2 2 0 0116.8 22H7.2a2 2 0 01-2-1.8L4 8z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4.3-4.3"/>',
    whatsapp: '<path d="M21 11.5a8.4 8.4 0 01-12.4 7.4L3 21l2.2-5.4A8.4 8.4 0 1121 11.5z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    paths[name] || ''
  }</svg>`;
}

export function verifiedBadge() {
  return `<span class="badge">${icon('check', '#a17c3a', 11)} VERIFIED</span>`;
}

export function productCard(p) {
  const under = p.retail_price && p.lowest_price && p.lowest_price < p.retail_price;
  const shot = p.image_url
    ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.title)}">`
    : '';
  const sellers =
    p.offer_count > 1
      ? `<span class="sellers">lowest of ${p.offer_count} sellers</span>`
      : p.offer_count === 1
      ? `<span class="sellers">single seller</span>`
      : `<span class="sellers">no offers yet</span>`;

  return `
<a class="pcard" href="/p/${escapeHtml(p.slug)}">
  <span class="shot">
    ${shot}
    ${verifiedBadge()}
    ${under ? '<span class="badge badge-right badge-under">UNDER RETAIL</span>' : ''}
  </span>
  <span>
    <span class="title">${escapeHtml(p.title)}</span>
    <span class="meta">${icon('pin', '#8a8271', 11)} ${escapeHtml(p.ships_from || '—')}${
    p.lead_days_min ? ` · arrives in ${p.lead_days_min}–${p.lead_days_max} days` : ''
  }</span>
    <span style="display:block">
      <span class="price">${p.lowest_price ? formatINR(p.lowest_price) : '—'}</span>${sellers}
    </span>
  </span>
</a>`;
}

export function layout({ title, description, body, env, cartCount = 0, activeNav = '', canonicalPath = '' }) {
  const site = env?.SITE_NAME || 'Mintmark';
  const pageTitle = title ? `${title} · ${site}` : site;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(pageTitle)}</title>
<meta name="description" content="${escapeHtml(
    description || 'Authenticated imports. Every seller compared, every piece checked twice.'
  )}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/styles.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
</head>
<body>
<div class="announce no-print">
  <span class="tag">Dual authentication on every order</span>
  <span class="sep">—</span>
  <span class="tag">Sourcing from Tokyo, Seoul, Milan, Geneva, Paris &amp; London</span>
</div>

<header class="no-print">
  <div class="nav">
    <a class="logo" href="/">${escapeHtml(site.toUpperCase())}</a>
    <nav class="nav-links">
      <a href="/c/sneakers">Sneakers</a>
      <a href="/c/streetwear">Streetwear</a>
      <a href="/c/watches">Watches</a>
      <a href="/c/bags">Bags &amp; Leather</a>
      <a href="/c/jewelry">Jewelry</a>
      <a href="/c/collectibles">Collectibles</a>
    </nav>
    <div class="nav-right">
      <form class="search" action="/search" method="get">
        ${icon('search', '#8a8271', 14)}
        <input type="search" name="q" placeholder="Search listings" aria-label="Search listings">
      </form>
      <a href="/track">Track order</a>
      <a href="/cart">${icon('bag', '#3a362c', 15)} Bag (${cartCount})</a>
    </div>
  </div>
  <div class="subnav">
    <a href="/c/all?max=25000"${activeNav === 'u25' ? ' class="active"' : ''}>Under ₹25,000</a>
    <a href="/c/all?max=50000">Under ₹50,000</a>
    <a href="/c/all?under_retail=1">Under retail</a>
    <a href="/c/all?sort=new">New this week</a>
    <a href="/c/all?lead=14">Arriving in 2 weeks</a>
    <a href="/verify">Verify a certificate</a>
    <a href="/sell">Sell with us</a>
  </div>
</header>

<main>
${body}
</main>

<footer class="footer no-print">
  <div class="footer-inner">
    <div class="cols">
      <div style="max-width:280px">
        <div class="logo" style="color:#f2ede2; font-size:23px; margin-bottom:14px;">${escapeHtml(
          site.toUpperCase()
        )}</div>
        <div style="font-size:12.5px; line-height:1.7;">An authenticated marketplace for imported rare goods. [YOUR REGISTERED ADDRESS]</div>
        <div style="font-size:12.5px; line-height:1.7; margin-top:10px;">WhatsApp support · ${escapeHtml(
          env?.SUPPORT_WHATSAPP || '[YOUR NUMBER]'
        )}<br>Mon–Sat, 10:30am–7:00pm</div>
      </div>
      <div class="col"><h4>Shop</h4>
        <a href="/c/sneakers">Sneakers</a><a href="/c/streetwear">Streetwear</a><a href="/c/watches">Watches</a><a href="/c/all?under_retail=1">Under retail</a>
      </div>
      <div class="col"><h4>Trust</h4>
        <a href="/authentication">Authentication</a><a href="/verify">Verify a certificate</a><a href="/shipping">Shipping &amp; import</a><a href="/returns">Returns</a>
      </div>
      <div class="col"><h4>Sellers</h4>
        <a href="/sell">Sell with us</a><a href="/sell#requirements">Seller requirements</a><a href="/sell#payouts">Payouts</a>
      </div>
      <div class="col"><h4>Company</h4>
        <a href="/about">About</a><a href="/track">Track an order</a><a href="/contact">Contact</a>
      </div>
    </div>
    <div class="bottom">
      <span>© ${new Date().getFullYear()} ${escapeHtml(site)}. All rights reserved.</span>
      <span style="display:flex; gap:18px;">
        <a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/shipping">Import &amp; customs policy</a>
      </span>
    </div>
  </div>
</footer>
</body>
</html>`;
}

export function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      ...extraHeaders,
    },
  });
}

export function redirect(location, extraHeaders = {}) {
  return new Response(null, { status: 302, headers: { location, ...extraHeaders } });
}
