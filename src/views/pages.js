import { escapeHtml, icon, detail } from '../render.js';

// Static content pages. Everything in square brackets is a placeholder you must fill in
// before launch — search the repo for "[YOUR" to find them all.
//
// These policies are drafted to cover what Indian e-commerce rules expect, including the
// grievance officer the Consumer Protection (E-Commerce) Rules require. They are a starting
// point written in plain language, NOT legal advice. Have a lawyer review them before you
// take money.

function page({ eyebrow, title, intro, body, maxWidth = '820px' }) {
  return `
<section class="section" style="max-width:${maxWidth};">
  ${eyebrow ? `<span class="tag gold">${eyebrow}</span>` : ''}
  <h1 class="serif" style="font-size:38px; margin:10px 0 16px; font-weight:400;">${title}</h1>
  ${intro ? `<p style="font-size:16px; line-height:1.75; color:#4a463c;">${intro}</p>` : ''}
  ${body}
</section>`;
}

const P = 'font-size:15px; line-height:1.8; color:#4a463c;';
const H3 = 'font-size:22px; margin:30px 0 10px; font-weight:400;';

export function authenticationPage(env) {
  return page({
    eyebrow: 'Our guarantee',
    title: 'Two checks, one seal, full traceability.',
    intro: `Nothing is listed until it has been inspected in hand at source, and nothing ships until
      it has been checked again here. Every piece travels in a tamper-evident seal with a numbered
      certificate you can verify online at any time.`,
    body: `
<h3 class="serif" style="${H3}">How a piece is authenticated</h3>
<ol style="${P} padding-left:20px;">
  <li><strong>Seller legit check.</strong> Every KYC-verified seller authenticates the piece and uploads their report before we allow it to go live. No report, no listing.</li>
  <li><strong>In-house inspection.</strong> When it reaches our facility, one of our authenticators runs an independent 30-point check — construction, materials, hardware, markings, serials and packaging.</li>
  <li><strong>Certificate and seal.</strong> On passing, we issue a numbered certificate and seal the package. The number encodes the year, the category and a sequence, and carries a check character.</li>
  <li><strong>Refund if it fails.</strong> If a piece fails our check, nothing ships and your order is refunded in full — duty and freight included, because nothing was imported for you. If a piece we certified is later shown not to be authentic, see <a href="/returns">returns</a> for exactly what comes back.</li>
</ol>

<h3 class="serif" style="${H3}">Reading a certificate number</h3>
<div class="serif" style="font-size:24px; letter-spacing:0.06em; margin:14px 0;">RH-26-SNK-00248-M</div>
<table class="table" style="background:none;">
  <tbody>
    ${[
      ['RH', 'Issued by us'],
      ['26', 'Year of issue'],
      ['SNK', 'Category — sneakers'],
      ['00248', 'Sequence within that year'],
      ['G', 'Check character — a mistyped or invented number fails immediately'],
    ]
      .map(
        ([k, v]) =>
          `<tr><td data-label="Part" style="width:110px;"><strong>${k}</strong></td><td data-label="Means">${v}</td></tr>`
      )
      .join('')}
  </tbody>
</table>

<p style="${P}">
  The final character is a checksum. It means a number that was mistyped, guessed or invented is
  rejected before we even look it up — a counterfeiter cannot make up a plausible number.
</p>

<h3 class="serif" style="${H3}">The sealed verification code</h3>
<p style="${P}">
  Inside every sealed package is a short verification code. Entering the certificate number alone
  confirms the certificate exists and what it covers. Adding the sealed code proves you hold the
  package, and unlocks the full record — the authenticator and the inspection notes. We never
  publish buyer details, and we never publish which dealer a piece came from.
</p>
<p style="${P}">
  We log every verification. If one number starts being checked far more than it should, that tells
  us it has been copied onto fakes, and we can revoke it.
</p>

<div style="margin-top:26px;"><a class="btn" href="/verify">Verify a certificate</a></div>`,
  });
}

export function shippingPage(env) {
  return page({
    eyebrow: 'Shipping &amp; import',
    title: 'Why it takes two to four weeks.',
    intro: `Everything here is sourced abroad and authenticated before it moves. We would rather show
      you an honest date than a fast one we cannot keep.`,
    body: `
<h3 class="serif" style="${H3}">A typical order</h3>
<table class="table">
  <thead><tr><th>Stage</th><th>How long</th></tr></thead>
  <tbody>
    <tr><td data-label="Stage">Seller dispatches the piece</td><td data-label="How long">1–2 days</td></tr>
    <tr><td data-label="Stage">In-house authentication</td><td data-label="How long">2–3 days</td></tr>
    <tr><td data-label="Stage">International transit and customs clearance</td><td data-label="How long">6–8 days</td></tr>
    <tr><td data-label="Stage">Domestic courier to your address</td><td data-label="How long">2–3 days</td></tr>
  </tbody>
</table>
<p style="${P}">
  The window shown on each listing reflects where that particular piece is coming from and how it
  travels. You see the estimate before you buy, on the product page, not after payment. We do not
  publish our sourcing routes — those relationships took time to build — but the date we give you
  is the real one.
</p>

<h3 class="serif" style="${H3}">Duties are included</h3>
<p style="${P}">
  <strong>The price you see is the price you pay.</strong> Import duty, customs clearance,
  authentication and insured delivery are all included in the listed price. We pay duties before the
  parcel enters the country, so there is nothing to settle with a courier at your door and no
  customs invoice arriving later.
</p>

<h3 class="serif" style="${H3}">Insurance and tracking</h3>
<p style="${P}">
  Every shipment is insured door to door and tracked at each stage. You can follow your order at any
  time from <a href="/track">order tracking</a> using the reference from your confirmation email.
</p>

<h3 class="serif" style="${H3}">Delays</h3>
<p style="${P}">
  Customs can occasionally hold a shipment for inspection, which is outside our control. If that
  happens we will tell you rather than let the date slide silently. If a delay becomes unreasonable,
  you may cancel for a full refund — see <a href="/returns">returns</a>.
</p>`,
  });
}

export function returnsPage(env) {
  return page({
    eyebrow: 'Returns &amp; refunds',
    title: 'Returns and refunds',
    intro: `Read this before you buy, not after. Every piece is individually imported and the duty is
      paid to customs on arrival, so what comes back on a refund is not always the whole amount.`,
    body: `
<div class="notice" style="margin-bottom:22px;">
  <strong>Have a lawyer review this before you launch.</strong> This is a plain-language draft, not
  legal advice, and the bracketed values below still need to be set by you.
</div>

<h3 class="serif" style="${H3}">The standard we apply</h3>
<p style="${P}">
  <strong>If it is our fault, you get everything back — the piece, the authentication fee, import
  duty and freight, no deductions.</strong> That covers a piece that is not authentic, arrives
  damaged, or is not as described. You did nothing wrong, so nothing is withheld.
</p>
<p style="${P}">
  <strong>If you simply change your mind, duty and freight are not returned.</strong> The listed
  price is the piece, our authentication fee, import duty and freight. Duty is paid to Indian
  customs the moment the parcel lands and cannot be reclaimed by us, and the freight has already
  been flown. That split is shown on every product page before you buy, not after.
</p>

<h3 class="serif" style="${H3}">If a piece is not authentic</h3>
<p style="${P}">
  If a piece fails our own inspection before dispatch, nothing ships and you are refunded the entire
  amount including duty and shipping, because nothing was imported on your behalf.
</p>
<p style="${P}">
  If a piece we certified is later shown not to be authentic — by a credible independent
  authentication you provide — <strong>we refund the full amount, duty and freight included</strong>,
  and we collect the item at our cost. A failure on our side of the authentication promise is not a
  cost we pass to you.
</p>

<h3 class="serif" style="${H3}">If a piece arrives damaged or is not as described</h3>
<p style="${P}">
  Tell us within <strong>[YOUR WINDOW, e.g. 48 hours]</strong> of delivery, with photographs. If the
  piece does not match its listed condition we arrange collection and refund the full amount,
  including duty and freight. Do not wear or alter the item, and keep the seal and packaging — a
  broken seal makes the claim much harder to assess.
</p>

<h3 class="serif" style="${H3}">Change of mind</h3>
<p style="${P}">
  <strong>[SET YOUR WINDOW AND CONDITIONS HERE.]</strong> Within that window, the piece and
  authentication fee are refunded; duty and freight are not, for the reasons above. Most
  marketplaces of this kind either do not accept change-of-mind returns at all, or accept them
  within a short window with this same duty-and-freight deduction. Pick one and apply it
  consistently.
</p>

<h3 class="serif" style="${H3}">Cancellations</h3>
<p style="${P}">
  You may cancel free of charge, with a full refund of everything paid, any time before the piece is
  dispatched to you — nothing has been imported yet at that point. After dispatch, cancellation is
  treated as a return under the terms above.
</p>

<h3 class="serif" style="${H3}">How refunds are paid</h3>
<p style="${P}">
  Refunds go to the original payment method within <strong>[YOUR TIMEFRAME, e.g. 7 working
  days]</strong> of approval. We confirm by email when it is issued.
</p>

<h3 class="serif" style="${H3}">How to start a return</h3>
<p style="${P}">
  Contact us on WhatsApp at ${detail(env, 'SUPPORT_WHATSAPP')} or email
  ${detail(env, 'SUPPORT_EMAIL')} with your order reference and photographs. If you are not satisfied
  with the outcome, escalate to our grievance officer — details on the <a href="/terms">terms</a> page.
</p>`,
  });
}

export function termsPage(env) {
  const site = env?.SITE_NAME || 'Rarehaus';
  return page({
    eyebrow: 'Terms',
    title: 'Terms of service',
    body: `
<div class="notice" style="margin-bottom:22px;">
  <strong>Draft — needs legal review.</strong> Written in plain language to cover what Indian
  e-commerce rules expect. It is not legal advice, and the bracketed values are yours to fill in.
  Do not take payments against an unreviewed version of this page.
</div>

<h3 class="serif" style="${H3}">Who we are</h3>
<p style="${P}">
  ${escapeHtml(site)} is operated by <strong>${detail(env, 'LEGAL_NAME')}</strong>, registered at
  <strong>${detail(env, 'REGISTERED_ADDRESS')}</strong>, CIN ${detail(env, 'CIN')}, GSTIN
  ${detail(env, 'GSTIN')}. Contact ${detail(env, 'SUPPORT_EMAIL')}.
</p>

<h3 class="serif" style="${H3}">What this marketplace does</h3>
<p style="${P}">
  We list goods offered by verified third-party sellers abroad, authenticate them, import them and
  deliver them to you. When you buy, you buy the piece through us: we take payment, we handle
  import, and we are responsible to you for the order.
</p>

<h3 class="serif" style="${H3}">Prices</h3>
<p style="${P}">
  Prices are in Indian rupees and inclusive of import duty, customs clearance, authentication and
  insured delivery. Applicable taxes are included as shown at checkout. Prices change with the market
  and currency; the price that applies is the one displayed when you place your order.
</p>

<h3 class="serif" style="${H3}">Delivery estimates</h3>
<p style="${P}">
  Delivery windows shown on listings are good-faith estimates based on where the piece is
  travelling from, not
  guarantees. Customs can delay a shipment. See <a href="/shipping">shipping and import</a>.
</p>

<h3 class="serif" style="${H3}">Authenticity</h3>
<p style="${P}">
  Every piece is authenticated twice and ships with a numbered certificate. Our authenticity
  commitment and what happens if a piece fails a check are set out on
  <a href="/authentication">authentication</a> and <a href="/returns">returns</a>.
</p>

<h3 class="serif" style="${H3}">Condition</h3>
<p style="${P}">
  Most pieces are pre-owned, vintage or deadstock. Condition is described on each listing and
  assessed in hand. Minor wear consistent with the stated condition is not a defect.
</p>

<h3 class="serif" style="${H3}">Your account and conduct</h3>
<p style="${P}">
  Give accurate delivery and contact details — we cannot be responsible for a parcel sent to an
  address you entered incorrectly. Do not use the site to place fraudulent orders or to resell
  counterfeit goods to us.
</p>

<h3 class="serif" style="${H3}">Limits</h3>
<p style="${P}">
  Where the law allows, our liability for an order is limited to the amount you paid for it. Nothing
  here limits rights you have under Indian consumer law, which apply regardless of what this page says.
</p>

<h3 class="serif" style="${H3}">Grievance officer</h3>
<p style="${P}">
  As required under the Consumer Protection (E-Commerce) Rules, 2020 and the Information Technology
  Rules, our grievance officer is:
</p>
<div class="panel" style="padding:20px 22px; margin-top:12px;">
  <div style="${P} margin:0;">
    <strong>${detail(env, 'GRIEVANCE_OFFICER')}</strong><br>
    ${escapeHtml(site)} — ${detail(env, 'REGISTERED_ADDRESS')}<br>
    Email: ${detail(env, 'GRIEVANCE_EMAIL')} · Phone: ${detail(env, 'GRIEVANCE_PHONE')}
  </div>
</div>
<p style="${P}">
  We acknowledge complaints within 48 hours and aim to resolve them within one month of receipt.
</p>

<h3 class="serif" style="${H3}">Governing law</h3>
<p style="${P}">
  These terms are governed by the laws of India, with courts at
  ${detail(env, 'JURISDICTION_CITY')} having jurisdiction.
</p>`,
  });
}

export function privacyPage(env) {
  return page({
    eyebrow: 'Privacy',
    title: 'Privacy policy',
    body: `
<div class="notice" style="margin-bottom:22px;">
  <strong>Draft — needs legal review.</strong> You are collecting names, addresses and phone numbers,
  so this page carries real obligations. Have it reviewed before launch.
</div>

<h3 class="serif" style="${H3}">What we collect</h3>
<ul style="${P} padding-left:20px;">
  <li><strong>Order details</strong> — your name, email, phone number and delivery address. We need these to import and deliver your order and to send your certificate.</li>
  <li><strong>Sourcing requests</strong> — what you asked us to find and how to reach you.</li>
  <li><strong>Certificate lookups</strong> — which certificate number was checked and when. We do not attach your identity to this; we use it to spot numbers being copied onto counterfeits.</li>
  <li><strong>Basic technical data</strong> — the standard request information any website receives.</li>
</ul>

<h3 class="serif" style="${H3}">What we do with it</h3>
<p style="${P}">
  We use it to fulfil your order, to keep you updated on it, and to answer you when you get in touch.
  We share the minimum necessary with the parties who make delivery possible — the seller, our
  customs broker and the courier — and with our payment provider to take payment. We do not sell your
  data, and we do not share it for anyone else's advertising.
</p>

<h3 class="serif" style="${H3}">Where it lives</h3>
<p style="${P}">
  Order data is stored in our database hosted on Cloudflare's infrastructure. Because your order is
  imported, some details necessarily cross borders — a seller abroad has to know where to send the
  piece, and customs authorities require declarations.
</p>

<h3 class="serif" style="${H3}">How long we keep it</h3>
<p style="${P}">
  Order and certificate records are kept for <strong>[YOUR PERIOD, e.g. 8 years]</strong> because tax
  and customs rules require it, and because a certificate has to remain verifiable long after the sale.
</p>

<h3 class="serif" style="${H3}">Your choices</h3>
<p style="${P}">
  You can ask for a copy of your data, ask us to correct it, or ask us to delete it where we are not
  required to keep it. Write to ${detail(env, 'SUPPORT_EMAIL')} and we will respond within
  <strong>[YOUR TIMEFRAME]</strong>.
</p>

<h3 class="serif" style="${H3}">Contact</h3>
<p style="${P}">
  Questions or complaints about privacy go to ${detail(env, 'SUPPORT_EMAIL')}, or to our grievance
  officer named on the <a href="/terms">terms</a> page.
</p>`,
  });
}

export function aboutPage(env) {
  const site = env?.SITE_NAME || 'Rarehaus';
  return page({
    eyebrow: 'About',
    title: escapeHtml(site),
    intro: `A mint mark is the small stamp struck into a coin identifying which mint produced it — the
      mark that proves where something genuinely came from. That is the whole business: rare pieces,
      sourced abroad, proven before they ship.`,
    body: `
<h3 class="serif" style="${H3}">The problem we exist for</h3>
<p style="${P}">
  Buying rare and imported goods in India means choosing between paying a premium at a boutique,
  gambling on a reseller you cannot verify, or importing yourself and discovering the duty bill at the
  door. Fakes are good enough now that photographs prove nothing.
</p>

<h3 class="serif" style="${H3}">What we do differently</h3>
<ul style="${P} padding-left:20px;">
  <li><strong>Every seller competes.</strong> One listing per piece, with every verified seller's offer for your size underneath it, cheapest first. You see the market rather than one dealer's price.</li>
  <li><strong>Two authentications, not one.</strong> The seller's report is required before a listing goes live; ours happens on arrival, independently.</li>
  <li><strong>A certificate that can be checked.</strong> Numbered, verifiable online by anyone, revocable by us if it is ever compromised.</li>
  <li><strong>Honest dates and honest prices.</strong> Import takes weeks and we say so upfront. Duty is in the price, not a surprise at your door.</li>
  <li><strong>Sourcing stays ours.</strong> We name what a piece is and prove it is real. We do not publish which dealer or country it came from — that network is the business.</li>
</ul>

<div class="notice" style="margin-top:24px;">
  Replace this with your real story, team and registered business details before launch.
</div>`,
  });
}

export function contactPage(env) {
  return page({
    eyebrow: 'Contact',
    title: 'Talk to us',
    body: `
<div class="grid grid-2" style="gap:20px; margin-top:8px;">
  <div class="panel" style="padding:22px;">
    <div style="display:flex; align-items:center; gap:9px; margin-bottom:8px;">
      ${icon('whatsapp', '#3f5f45', 18)}<strong>WhatsApp</strong>
    </div>
    <div style="${P} margin:0;">${detail(env, 'SUPPORT_WHATSAPP')}<br>
    Monday to Saturday, 10:30am–7:00pm</div>
  </div>
  <div class="panel" style="padding:22px;">
    <div style="margin-bottom:8px;"><strong>Email</strong></div>
    <div style="${P} margin:0;">${detail(env, 'SUPPORT_EMAIL')}<br>We reply within one working day.</div>
  </div>
</div>

<h3 class="serif" style="${H3}">Order questions</h3>
<p style="${P}">
  Have your order reference ready — it looks like RH-4F2A19 and is in your confirmation email. You can
  check the current stage yourself at <a href="/track">order tracking</a>.
</p>

<h3 class="serif" style="${H3}">Selling with us</h3>
<p style="${P}">See <a href="/sell">sell with us</a>.</p>

<h3 class="serif" style="${H3}">Complaints</h3>
<p style="${P}">
  If we have not resolved something, our grievance officer is named on the <a href="/terms">terms</a>
  page and must respond within the timeframes set out there.
</p>

<h3 class="serif" style="${H3}">Registered office</h3>
<p style="${P}">${detail(env, 'LEGAL_NAME')}<br>${detail(env, 'REGISTERED_ADDRESS')}<br>GSTIN ${detail(env, 'GSTIN')}</p>`,
  });
}

export function sellPage({ submitted, error, env }) {
  const site = env?.SITE_NAME || 'Rarehaus';
  return `
<section class="dark" style="padding:64px 0;">
  <div class="wrap">
    <span class="tag" style="color:var(--gold-light)">Sell with us</span>
    <h1 class="serif" style="font-size:52px; line-height:1.1; margin:12px 0 18px; font-weight:400;">
      Your stock, in front of buyers<br>who already trust the check.
    </h1>
    <p style="max-width:560px; font-size:16.5px; line-height:1.72; color:#b3ab99; margin:0;">
      ${escapeHtml(site)} sells to Indian buyers who want imported pieces and will not gamble on
      authenticity. You list, we authenticate, import and handle the customer. You get paid.
    </p>
  </div>
</section>

<section class="section">
  <div class="grid grid-4">
    ${[
      ['bars', 'You set your price', 'Your offer sits alongside other sellers for the same piece. Buyers see every price, so competitive stock sells fast.'],
      ['shield', 'We authenticate', 'Your report plus our independent 30-point check. Two checks protect your reputation as much as the buyer.'],
      ['truck', 'We handle import', 'Customs, duty and delivery are ours. You ship to our facility and you are done.'],
      ['doc', 'You get paid', 'Payout once the piece clears our inspection. No chasing customers, no chargebacks.'],
    ]
      .map(
        ([ic, t, d]) => `
      <div class="panel" style="padding:22px;">
        <div style="margin-bottom:12px;">${icon(ic, '#6a5735', 20)}</div>
        <div style="font-size:15px; font-weight:600; margin-bottom:7px;">${t}</div>
        <div style="font-size:13px; color:var(--muted); line-height:1.65;">${d}</div>
      </div>`
      )
      .join('')}
  </div>
</section>

<section class="section">
  <div class="grid grid-2" style="gap:48px; align-items:start;">
    <div>
      <h2 class="serif" id="requirements" style="font-size:30px; margin:0 0 14px; font-weight:400;">What we need from you</h2>
      <ul style="${P} padding-left:20px;">
        <li><strong>KYC documentation.</strong> Business or trader registration, and identification for the person we deal with. We do not list stock from unverified sellers.</li>
        <li><strong>An authentication report per listing.</strong> Whatever service you already use is fine, as long as the report travels with the piece.</li>
        <li><strong>Accurate condition grading.</strong> Photograph flaws rather than hiding them. Our inspection will find them, and a mismatch costs us both.</li>
        <li><strong>Dispatch within two working days</strong> of a sale, to our facility.</li>
      </ul>

      <h2 class="serif" id="payouts" style="font-size:30px; margin:34px 0 14px; font-weight:400;">Commission and payouts</h2>
      <p style="${P}">
        Our commission is <strong>[YOUR COMMISSION, e.g. 12%]</strong> of the seller price. Import duty,
        authentication and shipping are added on top and paid by the buyer, so they do not come out of
        your margin.
      </p>
      <p style="${P}">
        You are paid <strong>[YOUR PAYOUT TERMS, e.g. within 5 working days of the piece passing our
        inspection]</strong>, by <strong>[YOUR PAYOUT METHOD]</strong>. If a piece fails our inspection
        we return it to you at <strong>[WHOSE COST]</strong> and the sale is cancelled.
      </p>

      <h2 class="serif" style="font-size:30px; margin:34px 0 14px; font-weight:400;">What we are looking for</h2>
      <p style="${P}">
        Sneakers, streetwear, watches, bags and leather, jewellery and collectibles — deadstock,
        archive and well-kept pre-owned. We work with sellers across Asia, Europe and the UK, and
        will consider anywhere we can import from reliably.
      </p>
    </div>

    <div class="panel" style="padding:26px;" id="apply">
      <h2 class="serif" style="font-size:26px; margin:0 0 6px; font-weight:400;">Apply to sell</h2>
      <p class="muted" style="font-size:13px; margin:0 0 18px;">We reply to every application, usually within two working days.</p>

      ${
        submitted
          ? `<div class="notice notice-good">
               <strong>Application received.</strong> We will be in touch at the address you gave us.
             </div>`
          : `
      ${error ? `<div class="notice notice-bad" style="margin-bottom:14px;">${escapeHtml(error)}</div>` : ''}
      <form method="post" action="/sell">
        <div class="field"><label for="business">Business name</label><input id="business" name="business" required maxlength="140"></div>
        <div class="form-row">
          <div class="field"><label for="contact">Your name</label><input id="contact" name="contact" required maxlength="120"></div>
          <div class="field"><label for="phone">Phone or WhatsApp</label><input id="phone" name="phone" maxlength="30"></div>
        </div>
        <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required maxlength="160"></div>
        <div class="form-row">
          <div class="field"><label for="city">City</label><input id="city" name="city" required maxlength="80"></div>
          <div class="field"><label for="country">Country</label><input id="country" name="country" required maxlength="80"></div>
        </div>
        <div class="field">
          <label for="categories">What do you sell?</label>
          <input id="categories" name="categories" maxlength="200" placeholder="Sneakers, watches, bags…">
        </div>
        <div class="field">
          <label for="volume">Roughly how many pieces a month?</label>
          <select id="volume" name="volume">
            <option value="">Select</option>
            <option>1–10</option><option>10–50</option><option>50–200</option><option>200+</option>
          </select>
        </div>
        <div class="field">
          <label for="authentication">How do you authenticate today?</label>
          <input id="authentication" name="authentication" maxlength="200" placeholder="Service you use, or in-house">
        </div>
        <div class="field"><label for="website">Website or Instagram</label><input id="website" name="website" maxlength="200"></div>
        <div class="field"><label for="notes">Anything else</label><textarea id="notes" name="notes" rows="3" maxlength="1000"></textarea></div>
        <button class="btn btn-block" type="submit">Submit application</button>
        <p style="font-size:11.5px; color:var(--muted); margin:12px 0 0; line-height:1.55;">
          We use these details to assess your application and contact you about selling with us. We do
          not share them or use them for marketing. See our <a href="/privacy">privacy policy</a>.
        </p>
      </form>`
      }
    </div>
  </div>
</section>`;
}

export function cookiesPage(env) {
  return page({
    eyebrow: 'Cookies',
    title: 'Cookies and tracking',
    intro: `Short version: we use two cookies, both strictly necessary to run the shop, and we do not
      track you. There is no analytics, no advertising pixel and no third-party tracker on this site.`,
    body: `
<h3 class="serif" style="${H3}">What we set</h3>
<table class="table">
  <thead><tr><th>Cookie</th><th>Purpose</th><th>Lifetime</th></tr></thead>
  <tbody>
    <tr>
      <td data-label="Cookie"><code>cart</code></td>
      <td data-label="Purpose">Remembers which listings you put in your bag. Without it the bag empties on every page.</td>
      <td data-label="Lifetime">30 days</td>
    </tr>
    <tr>
      <td data-label="Cookie"><code>mm_admin</code></td>
      <td data-label="Purpose">Signs in a staff member to the admin area. Only ever set for staff, never for shoppers.</td>
      <td data-label="Lifetime">8 hours</td>
    </tr>
  </tbody>
</table>
<p style="${P}">
  Both are strictly necessary: the site cannot do what you asked of it without them. That is why you
  are not being shown a cookie consent pop-up — consent is required for tracking and advertising
  cookies, and we do not set any. If we ever add analytics, we will ask first.
</p>

<h3 class="serif" style="${H3}">What we do not do</h3>
<ul style="${P} padding-left:20px;">
  <li>No analytics — we do not measure your visit.</li>
  <li>No advertising or remarketing pixels. Nothing here follows you to another site.</li>
  <li>No social media embeds, chat widgets or session recording.</li>
  <li>We do not sell or share browsing data with anyone.</li>
</ul>

<h3 class="serif" style="${H3}">The one third party</h3>
<p style="${P}">
  Our typefaces load from Google Fonts. That means your browser requests the font files from Google,
  and Google therefore sees your IP address and which page requested them. Google states it does not
  use these requests to profile you, but we would rather tell you than not. No cookie is set by it.
  If you would prefer to remove even that, we can host the fonts ourselves.
</p>

<h3 class="serif" style="${H3}">Certificate lookups</h3>
<p style="${P}">
  When someone verifies a certificate we record the number checked, the outcome and the time. This is
  how we notice a certificate number being copied onto counterfeits. It is not linked to your
  identity and does not involve a cookie.
</p>

<h3 class="serif" style="${H3}">Managing cookies</h3>
<p style="${P}">
  You can clear or block cookies in your browser settings. Blocking ours will stop the bag and
  checkout from working, since there is nowhere left to remember what you chose.
</p>`,
  });
}
