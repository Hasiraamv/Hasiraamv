import { escapeHtml, formatINR, icon, etaDates } from '../render.js';

export function cartPage({ items, total }) {
  if (!items.length) {
    return `
<section class="section">
  <h2 class="serif" style="font-size:34px; margin:0 0 12px;">Your bag is empty</h2>
  <p class="muted" style="margin:0 0 24px;">Nothing reserved yet.</p>
  <a class="btn" href="/c/all">Browse listings</a>
</section>`;
  }

  return `
<section class="section">
  <div class="section-head"><div><span class="tag gold">Reserved for you</span><h2 class="serif">Your bag</h2></div></div>

  <div class="grid split" style="grid-template-columns:1.4fr .6fr; gap:40px; align-items:start;">
    <div>
      ${items
        .map((it) => {
          const e = etaDates(it.lead_days_min, it.lead_days_max);
          return `
        <div class="panel" style="display:flex; gap:20px; padding:20px; margin-bottom:14px;">
          <div style="width:110px; height:110px; background:var(--tile); flex-shrink:0;"></div>
          <div style="flex-grow:1;">
            <a href="/p/${escapeHtml(it.product_slug)}" style="font-size:15px; font-weight:600; color:var(--text);">${escapeHtml(
            it.product_title
          )}</a>
            <div style="font-size:12.5px; color:var(--muted); margin-top:6px;">
              ${it.size_label !== 'One size' ? `Size ${escapeHtml(it.size_label)} · ` : ''}${escapeHtml(it.condition)}
            </div>
            <div style="font-size:12.5px; color:var(--muted); margin-top:4px; display:flex; align-items:center; gap:6px;">
              ${icon('pin', '#8a8271', 11)} ${escapeHtml(it.seller_name)}, ${escapeHtml(it.ships_from)} · arrives ${e.from}–${e.to}
            </div>
          </div>
          <div style="text-align:right;">
            <div class="serif" style="font-size:22px;">${formatINR(it.landed_price)}</div>
            <form method="post" action="/cart/remove" style="margin-top:8px;">
              <input type="hidden" name="offer_id" value="${it.id}">
              <button class="chip" type="submit" style="cursor:pointer;">Remove</button>
            </form>
          </div>
        </div>`;
        })
        .join('')}
    </div>

    <div class="panel" style="padding:24px;">
      <h3 class="serif" style="font-size:22px; margin:0 0 16px;">Summary</h3>
      <div style="display:flex; flex-direction:column; gap:9px; font-size:13px; color:#5c5748;">
        <div style="display:flex; justify-content:space-between;"><span>Seller prices</span><span>${formatINR(
          items.reduce((s, i) => s + i.seller_price, 0)
        )}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Duty &amp; customs</span><span>${formatINR(
          items.reduce((s, i) => s + i.duty, 0)
        )}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Authentication</span><span>${formatINR(
          items.reduce((s, i) => s + i.auth_fee, 0)
        )}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Insured shipping</span><span>${formatINR(
          items.reduce((s, i) => s + i.shipping, 0)
        )}</span></div>
        <div style="display:flex; justify-content:space-between; padding-top:12px; margin-top:4px; border-top:1px solid var(--line); font-weight:600; color:var(--text); font-size:16px;">
          <span>Total</span><span class="serif" style="font-size:22px;">${formatINR(total)}</span>
        </div>
      </div>
      <a class="btn btn-block" href="/checkout" style="margin-top:18px;">Checkout</a>
      <p style="font-size:11.5px; color:var(--faint); margin:12px 0 0; line-height:1.5;">
        Duties are included. Nothing further is payable on delivery.
      </p>
    </div>
  </div>
</section>`;
}

export function checkoutPage({ items, total, error }) {
  return `
<section class="section">
  <div class="section-head"><div><span class="tag gold">Checkout</span><h2 class="serif">Where should it land?</h2></div></div>

  ${error ? `<div class="notice notice-bad" style="margin-bottom:20px;">${escapeHtml(error)}</div>` : ''}

  <form method="post" action="/checkout" class="grid split" style="grid-template-columns:1.4fr .6fr; gap:40px; align-items:start;">
    <div>
      <div class="panel" style="padding:26px;">
        <h3 class="serif" style="font-size:20px; margin:0 0 18px;">Contact</h3>
        <div class="form-row">
          <div class="field"><label for="name">Full name</label><input id="name" name="name" required maxlength="120"></div>
          <div class="field"><label for="phone">Phone</label><input id="phone" name="phone" required maxlength="20" inputmode="tel"></div>
        </div>
        <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required maxlength="160">
          <span class="hint">Your certificate and tracking updates go here.</span>
        </div>

        <h3 class="serif" style="font-size:20px; margin:28px 0 18px;">Delivery address</h3>
        <div class="field"><label for="address1">Address</label><input id="address1" name="address1" required maxlength="200"></div>
        <div class="field"><label for="address2">Apartment, landmark (optional)</label><input id="address2" name="address2" maxlength="200"></div>
        <div class="form-row">
          <div class="field"><label for="city">City</label><input id="city" name="city" required maxlength="80"></div>
          <div class="field"><label for="state">State</label><input id="state" name="state" required maxlength="80"></div>
        </div>
        <div class="field" style="max-width:220px;"><label for="pincode">PIN code</label><input id="pincode" name="pincode" required maxlength="10" inputmode="numeric" pattern="[0-9]{6}">
          <span class="hint">Six digits.</span>
        </div>
      </div>

      <div class="notice" style="margin-top:16px;">
        <strong>Payment is not yet connected.</strong> Placing this order records it and reserves the
        piece; you will be contacted to pay. Wire a gateway before taking real money — see README.
      </div>
    </div>

    <div class="panel" style="padding:24px;">
      <h3 class="serif" style="font-size:22px; margin:0 0 16px;">Your order</h3>
      ${items
        .map((it) => {
          const e = etaDates(it.lead_days_min, it.lead_days_max);
          return `
        <div style="padding-bottom:14px; margin-bottom:14px; border-bottom:1px solid var(--line);">
          <div style="font-size:13.5px; font-weight:600;">${escapeHtml(it.product_title)}</div>
          <div style="font-size:12px; color:var(--muted); margin-top:4px;">${
            it.size_label !== 'One size' ? `Size ${escapeHtml(it.size_label)} · ` : ''
          }${escapeHtml(it.ships_from)} · arrives ${e.from}–${e.to}</div>
          <div class="serif" style="font-size:18px; margin-top:6px;">${formatINR(it.landed_price)}</div>
        </div>`;
        })
        .join('')}
      <div style="display:flex; justify-content:space-between; font-weight:600; font-size:16px;">
        <span>Total</span><span class="serif" style="font-size:22px;">${formatINR(total)}</span>
      </div>
      <button class="btn btn-block" type="submit" style="margin-top:18px;">Place order</button>
      <p style="font-size:11.5px; color:var(--faint); margin:12px 0 0; line-height:1.5;">
        Duties included. Every piece is authenticated before dispatch; if it fails, you are refunded in full.
      </p>
    </div>
  </form>
</section>`;
}

const STAGES = [
  ['placed', 'Order placed', 'Seller notified and the piece reserved'],
  ['seller_shipped', 'Seller shipped', 'On its way to our authentication facility'],
  ['authenticating', 'Authentication', '30-point inspection in progress'],
  ['authenticated', 'Certificate issued', 'Sealed with a numbered certificate'],
  ['in_transit', 'Import & customs', 'Duties paid, clearing customs'],
  ['out_for_delivery', 'Out for delivery', 'With the local courier'],
  ['delivered', 'Delivered', 'Signed for'],
];

export function orderPage({ order, events, certificate }) {
  const reached = new Set(events.map((e) => e.status));
  const currentIndex = STAGES.reduce((acc, [k], i) => (reached.has(k) ? i : acc), 0);

  return `
<section class="section">
  <div class="section-head">
    <div>
      <span class="tag gold">Order ${escapeHtml(order.public_ref)}</span>
      <h2 class="serif">${escapeHtml(order.product_title)}</h2>
      <p class="muted" style="margin:8px 0 0; font-size:14px;">
        ${order.size_label !== 'One size' ? `Size ${escapeHtml(order.size_label)} · ` : ''}Placed ${escapeHtml(
    String(order.created_at).slice(0, 10)
  )} · ${formatINR(order.amount)}
      </p>
    </div>
    ${
      order.eta_min
        ? `<div style="text-align:right;">
             <div class="tag muted">Estimated delivery</div>
             <div class="serif" style="font-size:22px; color:var(--gold);">${escapeHtml(order.eta_min)} – ${escapeHtml(
            order.eta_max
          )}</div>
           </div>`
        : ''
    }
  </div>

  <div class="panel" style="padding:28px;">
    <div class="timeline" style="flex-wrap:wrap; gap:10px;">
      ${STAGES.map(([key, label, sub], i) => {
        const cls = i < currentIndex ? 'done' : i === currentIndex ? 'done current' : '';
        return `<div class="stage ${cls}" style="min-width:120px;">
          <div class="bar"></div>
          <div class="label">${label}</div>
          <div class="sub">${sub}</div>
        </div>`;
      }).join('')}
    </div>
  </div>

  ${
    certificate
      ? `<div class="cert" style="margin-top:20px; display:flex; align-items:center; gap:28px; flex-wrap:wrap;">
           <div>
             <div class="tag" style="color:var(--gold-light)">Certificate No.</div>
             <div class="no">${escapeHtml(certificate.certificate_no)}</div>
           </div>
           <div style="flex-grow:1; min-width:220px; font-size:13px; color:#b3ab99;">
             Issued ${escapeHtml(certificate.issued_on)}${
          certificate.authenticator_initials ? ` · authenticator ${escapeHtml(certificate.authenticator_initials)}` : ''
        }
           </div>
           <a class="btn btn-outline" href="/certificate/${encodeURIComponent(
             certificate.certificate_no
           )}" style="color:#f2ede2; border-color:#4a4336;">View certificate</a>
         </div>`
      : ''
  }

  <h3 class="serif" style="font-size:22px; margin:34px 0 14px;">History</h3>
  <table class="table">
    <thead><tr><th>Date</th><th>Stage</th><th>Note</th></tr></thead>
    <tbody>
      ${events
        .slice()
        .reverse()
        .map(
          (e) => `<tr>
            <td data-label="Date">${escapeHtml(String(e.created_at).slice(0, 16))}</td>
            <td data-label="Stage">${escapeHtml(
              (STAGES.find((s) => s[0] === e.status) || [, e.status])[1]
            )}</td>
            <td data-label="Note">${escapeHtml(e.note || '')}</td>
          </tr>`
        )
        .join('')}
    </tbody>
  </table>
</section>`;
}

export function trackPage({ error }) {
  return `
<section class="section" style="max-width:640px;">
  <span class="tag gold">Tracking</span>
  <h2 class="serif" style="font-size:34px; margin:10px 0 8px;">Track your order</h2>
  <p class="muted" style="margin:0 0 22px;">Enter the reference from your confirmation email, e.g. MM-4F2A19.</p>
  ${error ? `<div class="notice notice-bad" style="margin-bottom:16px;">${escapeHtml(error)}</div>` : ''}
  <form method="get" action="/track">
    <div class="field"><input name="ref" placeholder="MM-XXXXXX" required maxlength="20" autocapitalize="characters"></div>
    <button class="btn" type="submit">Find my order</button>
  </form>
</section>`;
}

export function orderPlacedPage({ order }) {
  return `
<section class="section" style="max-width:720px;">
  <span class="tag gold">Order placed</span>
  <h2 class="serif" style="font-size:38px; margin:10px 0 14px;">Thank you — we are on it.</h2>
  <p style="font-size:15.5px; line-height:1.7; color:#4a463c;">
    Your reference is <strong>${escapeHtml(order.public_ref)}</strong>. Keep it safe: it is how you
    track the piece from the seller, through authentication, to your door.
  </p>
  <div class="notice" style="margin:20px 0;">
    Payment is not yet connected on this site, so nothing has been charged. We will contact you on
    ${escapeHtml(order.buyer_phone)} to arrange payment before the seller ships.
  </div>
  <div style="display:flex; gap:12px; flex-wrap:wrap;">
    <a class="btn" href="/track?ref=${encodeURIComponent(order.public_ref)}">Track this order</a>
    <a class="btn btn-outline" href="/c/all">Keep browsing</a>
  </div>
</section>`;
}
