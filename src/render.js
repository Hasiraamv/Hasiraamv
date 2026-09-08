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

// True until the catalogue is real stock. Controlled by the DEMO_MODE var in wrangler.toml.
export function isDemo(env) {
  return String(env?.DEMO_MODE ?? 'true').toLowerCase() !== 'false';
}

// Business details come from configuration so they are filled in once. An unset value
// renders as a visible placeholder rather than disappearing, because a policy page that
// silently omits a legally required detail looks finished when it is not.
const DETAIL_LABELS = {
  LEGAL_NAME: 'REGISTERED COMPANY NAME',
  REGISTERED_ADDRESS: 'REGISTERED ADDRESS',
  SUPPORT_EMAIL: 'SUPPORT EMAIL',
  SUPPORT_WHATSAPP: 'WHATSAPP NUMBER',
  GSTIN: 'GSTIN',
  CIN: 'CIN',
  GRIEVANCE_OFFICER: 'GRIEVANCE OFFICER NAME',
  GRIEVANCE_EMAIL: 'GRIEVANCE EMAIL',
  GRIEVANCE_PHONE: 'GRIEVANCE PHONE',
  JURISDICTION_CITY: 'CITY',
};

export function detail(env, key) {
  const value = env?.[key];
  if (value && String(value).trim()) return escapeHtml(String(value).trim());
  return `<mark style="background:#f6e7c8; color:#5a4410; padding:1px 5px; font-size:0.95em;">[SET ${
    DETAIL_LABELS[key] || key
  }]</mark>`;
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
  /* RAREHAUS identity system: Obsidian, Warm Ivory, Stone, Champagne, Deep Oxblood. */
  --paper: #f4f0e8;      /* Warm Ivory */
  --paper-alt: #e7e2d8;  /* Ivory-dim, per identity board */
  --card: #fffcf6;
  --ink: #111111;        /* Obsidian */
  --ink-soft: #1a1a1a;   /* Obsidian 2 */
  --ink-softer: #2a2926; /* Obsidian 3 */
  --text: #1c1a17;
  --muted: #5b5751;      /* Warm Ink -- captions, metadata, SKU labels */
  /* Champagne (#B4935A) measures 2.5:1 on Ivory -- nowhere near the 4.5:1 WCAG AA floor for
     text -- so it is used at full strength only on dark surfaces (--gold-light) and
     darkened here for anything read as text or a link on a light background. */
  --faint: #5b5751;
  --line: #d6d0c5;       /* Stone */
  --line-dark: #2a2926;
  --gold: #6a5735;       /* Champagne, darkened for AA on Ivory (6.1:1) */
  --gold-light: #b4935a; /* Champagne, full strength -- dark surfaces only */
  --oxblood: #481b24;    /* Deep Oxblood -- reserve tier, wax seal, never a UI colour */
  --green: #3f5f45;
  --tile: #e5ddcc;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }

/* Accessibility ------------------------------------------------------ */
/* Every interactive element must show where keyboard focus is. :focus-visible keeps it
   off mouse clicks but always on for keyboard and switch users. */
a:focus-visible, button:focus-visible, input:focus-visible,
select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible {
  outline: 3px solid #16130f;
  outline-offset: 2px;
}
.dark a:focus-visible, .dark button:focus-visible { outline-color: #b4935a; }

.skip-link {
  position: absolute; left: -9999px; top: 0; z-index: 100;
  background: var(--ink); color: #f2ede2; padding: 12px 20px; font-weight: 600;
}
.skip-link:focus { left: 0; color: #f2ede2; }

.visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

.demo-banner {
  background: #4a3c14; color: #f7e9c4; text-align: center;
  padding: 10px 16px; font-size: 13px; line-height: 1.5;
}
.demo-banner strong { color: #fff6df; }

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
body {
  margin: 0;
  background: var(--paper);
  color: var(--text);
  font-family: 'Archivo', system-ui, -apple-system, sans-serif;
  font-size: 15px;
  line-height: 1.5;
}
/* Didone for the object, grotesque for the transaction: .serif names the piece,
   the base font-family runs the marketplace, .mono carries anything read back
   exactly -- serials, SKUs, grades, certificate numbers. */
.serif { font-family: 'Bodoni Moda', Didot, 'Bodoni MT', Georgia, serif; font-weight: 400; }
.mono { font-family: 'IBM Plex Mono', Menlo, monospace; }
a { color: var(--gold); text-decoration: none; }
a:hover { color: #6b5225; }
/* WCAG 1.4.1: a link sitting inside a run of text must not be identified by colour alone,
   so prose links are underlined. Navigation, cards and buttons are structurally obvious
   and stay clean. */
p a, li a, td a, .hint a, .notice a, .cert-row a, dd a {
  text-decoration: underline;
  text-underline-offset: 2px;
}
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
  display: inline-flex; align-items: center; gap: 11px;
  font-family: 'Bodoni Moda', Didot, 'Bodoni MT', Georgia, serif;
  font-size: 24px; font-weight: 400; letter-spacing: 0.28em; text-indent: 0.28em;
  color: var(--text); white-space: nowrap;
}
.logo svg { flex: none; }
.nav-links {
  display: flex; gap: 28px;
  font-size: 11.5px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase;
}
.nav-links a { color: var(--muted); }
.nav-links a:hover { color: var(--text); }
.nav-right {
  display: flex; align-items: center; gap: 22px;
  font-size: 11.5px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase;
}
.nav-right > a { color: var(--muted); }
.nav-right > a:hover { color: var(--text); }

/* Search and More both use <details> so they work with zero client JS; a small script in
   the footer closes them on an outside click for polish. */
.nav-pop { position: relative; }
.nav-pop summary {
  display: flex; align-items: center; gap: 7px; cursor: pointer; list-style: none;
  color: var(--muted); user-select: none;
}
.nav-pop summary:hover { color: var(--text); }
.nav-pop summary::-webkit-details-marker { display: none; }
.nav-pop[open] summary { color: var(--text); }
.nav-pop-panel {
  position: absolute; top: calc(100% + 18px); right: 0; z-index: 30;
  background: var(--card); border: 1px solid var(--line);
  box-shadow: 0 22px 44px -18px rgba(17, 17, 17, 0.28);
}
.search-panel { padding: 10px 12px; display: flex; align-items: center; gap: 9px; min-width: 240px; }
.search-panel input { border: 0; background: none; outline: none; width: 100%; font-size: 13px; text-transform: none; letter-spacing: normal; }
.more-panel { min-width: 200px; padding: 8px 0; }
.more-panel a {
  display: block; padding: 10px 20px; color: var(--text);
  font-size: 12px; letter-spacing: 0.06em; text-transform: none; font-weight: 400;
}
.more-panel a:hover { background: var(--paper-alt); }

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
.pcard .price { font-family: 'Bodoni Moda', Didot, 'Bodoni MT', Georgia, serif; font-size: 19px; margin-top: 8px; }
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
.notice-bad { border-color: #c9a5aa; background: #f5eceb; color: #481b24; }
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
.cert .no { font-family: 'IBM Plex Mono', Menlo, monospace; font-size: 22px; letter-spacing: 0.06em; }
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
  .wrap, .nav, .section, .footer { padding-left: 20px; padding-right: 20px; }
  .nav { flex-wrap: wrap; gap: 12px; }
  .nav-links { order: 3; width: 100%; overflow-x: auto; gap: 20px; padding-bottom: 4px; }
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

/* Chat widget -------------------------------------------------------- */
.chat-fab {
  position: fixed; bottom: 22px; right: 22px; z-index: 60;
  width: 52px; height: 52px; border-radius: 50%; border: 0;
  background: var(--ink); color: var(--gold-light); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 12px 28px -10px rgba(17, 17, 17, 0.45);
}
.chat-panel {
  position: fixed; bottom: 86px; right: 22px; z-index: 60;
  width: min(360px, calc(100vw - 44px)); height: min(480px, calc(100vh - 140px));
  background: var(--card); border: 1px solid var(--line);
  box-shadow: 0 26px 60px -20px rgba(17, 17, 17, 0.35);
  display: flex; flex-direction: column; overflow: hidden;
}
.chat-panel[hidden] { display: none; }
.chat-head {
  background: var(--ink); color: var(--paper); padding: 14px 16px;
  font-family: 'Bodoni Moda', Didot, 'Bodoni MT', Georgia, serif; font-size: 15px; letter-spacing: 0.04em;
  display: flex; justify-content: space-between; align-items: center;
}
.chat-head button { background: none; border: 0; color: #8b8474; cursor: pointer; font-size: 18px; line-height: 1; padding: 2px 4px; }
.chat-log { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.chat-msg { font-size: 13.5px; line-height: 1.55; max-width: 88%; padding: 8px 12px; }
.chat-msg.user { align-self: flex-end; background: var(--ink); color: var(--paper); }
.chat-msg.bot { align-self: flex-start; background: var(--paper-alt); color: var(--text); border: 1px solid var(--line); }
.chat-form { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--line); }
.chat-form input { flex: 1; border: 1px solid #ddd5c2; padding: 10px 12px; font-size: 13px; outline: none; }
.chat-form input:focus { border-color: var(--gold); }
.chat-form button { background: var(--ink); color: var(--paper); border: 0; padding: 0 16px; cursor: pointer; font-size: 13px; }
`;

const FONTS =
  'https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500;6..96,700&family=Archivo:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap';

// The RAREHAUS vault seal: an arch open at the foot, holding a geometric RH monogram built
// from a single stroke. From the identity board's SVG sprite (symbol#seal, viewBox 0 0 200 200).
export function sealMark(color = 'currentColor', size = 28) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 200 200" fill="none" aria-hidden="true">
    <path d="M33 178V100a67 67 0 0 1 134 0v78" stroke="${color}" stroke-width="10"/>
    <g stroke="${color}" stroke-width="13" transform="translate(100 112) scale(.6) translate(-100.5 -100)">
      <path d="M37 60V140"/><path d="M37 60h31a16 16 0 0 1 0 32H37"/><path d="M56 92l32 48"/>
      <path d="M116 60v80"/><path d="M164 60v80"/><path d="M116 100h48"/>
    </g>
  </svg>`;
}

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
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    paths[name] || ''
  }</svg>`;
}

export function verifiedBadge() {
  return `<span class="badge">${icon('check', '#80632e', 11)} VERIFIED</span>`;
}

export const STOCK_LABELS = {
  limited: 'LIMITED STOCK',
  last_one: 'ONLY ONE LEFT',
  made_to_order: 'MADE TO ORDER',
};

export function productCard(p) {
  const under = p.retail_price && p.lowest_price && p.lowest_price < p.retail_price;
  const stockTag = STOCK_LABELS[p.stock_label];
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
    ${
      under
        ? '<span class="badge badge-right badge-under">UNDER RETAIL</span>'
        : stockTag
        ? `<span class="badge badge-right badge-under">${stockTag}</span>`
        : ''
    }
  </span>
  <span>
    <span class="title">${escapeHtml(p.title)}</span>
    <span class="meta">${
      p.lead_days_min
        ? `${icon('clock', '#6e675a', 11)} Arrives in ${p.lead_days_min}–${p.lead_days_max} days`
        : ''
    }</span>
    <span style="display:block">
      <span class="price">${p.lowest_price ? formatINR(p.lowest_price) : '—'}</span>${sellers}
    </span>
  </span>
</a>`;
}

function chatWidget(site) {
  return `
<button class="chat-fab no-print" id="chat-fab" aria-label="Open help chat" aria-expanded="false">${icon(
    'whatsapp',
    'currentColor',
    22
  )}</button>
<div class="chat-panel no-print" id="chat-panel" hidden>
  <div class="chat-head">
    <span>${escapeHtml(site)} help</span>
    <button type="button" id="chat-close" aria-label="Close chat">&times;</button>
  </div>
  <div class="chat-log" id="chat-log">
    <div class="chat-msg bot">Hi — ask about authentication, shipping, returns, or an order reference (RH-XXXXXX).</div>
  </div>
  <form class="chat-form" id="chat-form">
    <label for="chat-input" class="visually-hidden">Message</label>
    <input id="chat-input" type="text" placeholder="Type a message…" maxlength="800" autocomplete="off" required>
    <button type="submit">Send</button>
  </form>
</div>
<script>
(function () {
  var fab = document.getElementById('chat-fab');
  var panel = document.getElementById('chat-panel');
  var log = document.getElementById('chat-log');
  var form = document.getElementById('chat-form');
  var input = document.getElementById('chat-input');
  var history = [];
  var busy = false;

  fab.addEventListener('click', function () {
    var open = panel.hasAttribute('hidden');
    if (open) { panel.removeAttribute('hidden'); input.focus(); } else { panel.setAttribute('hidden', ''); }
    fab.setAttribute('aria-expanded', String(open));
  });
  document.getElementById('chat-close').addEventListener('click', function () {
    panel.setAttribute('hidden', '');
    fab.setAttribute('aria-expanded', 'false');
  });

  function addMsg(role, text) {
    var div = document.createElement('div');
    div.className = 'chat-msg ' + (role === 'user' ? 'user' : 'bot');
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || busy) return;
    addMsg('user', text);
    history.push({ role: 'user', content: text });
    input.value = '';
    busy = true;
    fetch('/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: text, history: history.slice(0, -1) }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var reply = data.reply || "Sorry, I couldn't reply just now.";
        addMsg('bot', reply);
        history.push({ role: 'assistant', content: reply });
      })
      .catch(function () { addMsg('bot', "Sorry, something went wrong. Try /contact instead."); })
      .finally(function () { busy = false; });
  });
})();
</script>`;
}

export function layout({ title, description, body, env, cartCount = 0, activeNav = '', canonicalPath = '', user = null }) {
  const site = env?.SITE_NAME || 'Rarehaus';
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
<a class="skip-link" href="#main">Skip to main content</a>
${
  isDemo(env)
    ? `<div class="demo-banner no-print" role="status">
         <strong>Demo site.</strong> The catalogue, sellers and prices here are sample data for
         testing. Nothing is for sale and no order will be fulfilled.
       </div>`
    : ''
}
<div class="announce no-print">
  <span class="tag">Dual authentication on every order</span>
  <span class="sep">—</span>
  <span class="tag">Duties included · Numbered certificate with every piece</span>
</div>

<header class="no-print">
  <div class="nav">
    <a class="logo" href="/" aria-label="${escapeHtml(site)} home">${sealMark(
    'var(--gold)',
    26
  )}${escapeHtml(site.toUpperCase())}</a>
    <nav class="nav-links" aria-label="Categories">
      <a href="/c/sneakers">Sneakers</a>
      <a href="/c/streetwear">Streetwear</a>
      <a href="/c/watches">Watches</a>
      <a href="/c/bags">Bags &amp; Leather</a>
      <a href="/c/jewelry">Jewelry</a>
      <a href="/c/collectibles">Collectibles</a>
    </nav>
    <div class="nav-right">
      <details class="nav-pop">
        <summary aria-label="Search listings">${icon('search', 'currentColor', 15)}</summary>
        <form class="nav-pop-panel search-panel" action="/search" method="get" role="search">
          <label for="site-search" class="visually-hidden">Search listings</label>
          <input id="site-search" type="search" name="q" placeholder="Search listings">
        </form>
      </details>
      <details class="nav-pop">
        <summary>More</summary>
        <div class="nav-pop-panel more-panel">
          <a href="/track">Track order</a>
          <a href="/verify">Verify a certificate</a>
          <a href="/sell">Sell with us</a>
          <a href="/authentication">Authentication</a>
          <a href="/about">About</a>
        </div>
      </details>
      ${
        user
          ? `<a href="/account">${escapeHtml(user.name.split(' ')[0])}</a>`
          : `<a href="/account/sign-in">Sign in</a>`
      }
      <a href="/cart" aria-label="Your bag, ${cartCount} item${cartCount === 1 ? '' : 's'}">${icon(
    'bag',
    'currentColor',
    15
  )} Bag (${cartCount})</a>
    </div>
  </div>
</header>

<main id="main">
${body}
</main>

<footer class="footer no-print">
  <div class="footer-inner">
    <div class="cols">
      <div style="max-width:280px">
        <div class="logo" style="color:#f2ede2; font-size:20px; margin-bottom:14px;">${sealMark(
          'var(--gold-light)',
          24
        )}${escapeHtml(site.toUpperCase())}</div>
        <div style="font-size:12.5px; line-height:1.7;">
          An authenticated marketplace for imported rare goods.<br>
          ${detail(env, 'LEGAL_NAME')}<br>${detail(env, 'REGISTERED_ADDRESS')}
        </div>
        <div style="font-size:12.5px; line-height:1.7; margin-top:10px;">
          WhatsApp ${detail(env, 'SUPPORT_WHATSAPP')}<br>
          ${detail(env, 'SUPPORT_EMAIL')}<br>Mon–Sat, 10:30am–7:00pm
        </div>
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
      <span style="display:flex; align-items:center; gap:14px;">
        © ${new Date().getFullYear()} ${escapeHtml(site)}. All rights reserved.
        <a href="https://instagram.com/rarehaus.in" target="_blank" rel="noopener" aria-label="${escapeHtml(site)} on Instagram" style="display:inline-flex;">${icon(
    'instagram',
    'currentColor',
    15
  )}</a>
      </span>
      <span style="display:flex; gap:18px; flex-wrap:wrap;">
        <a href="/privacy">Privacy</a><a href="/cookies">Cookies</a><a href="/terms">Terms</a>
        <a href="/returns">Returns</a><a href="/shipping">Import &amp; customs</a>
      </span>
    </div>
  </div>
</footer>
${env?.GROQ_API_KEY ? chatWidget(site) : ''}
<script>
  document.addEventListener('click', function (e) {
    document.querySelectorAll('.nav-pop[open]').forEach(function (d) {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });
  });
</script>
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
