import { escapeHtml, formatINR, icon, etaDates } from '../render.js';
import { refundBreakdown } from '../pricing.js';

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
              ${icon('clock', '#6b6558', 11)} Arrives ${e.from}–${e.to}
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
        <div style="display:flex; justify-content:space-between;"><span>${items.length} item${
    items.length === 1 ? '' : 's'
  }</span><span>${formatINR(total)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Import duty &amp; customs</span><span style="color:var(--green); font-weight:600;">Included</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Authentication &amp; certificate</span><span style="color:var(--green); font-weight:600;">Included</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Insured delivery</span><span style="color:var(--green); font-weight:600;">Included</span></div>
        <div style="display:flex; justify-content:space-between; padding-top:12px; margin-top:4px; border-top:1px solid var(--line); font-weight:600; color:var(--text); font-size:16px;">
          <span>Total</span><span class="serif" style="font-size:22px;">${formatINR(total)}</span>
        </div>
      </div>
      <a class="btn btn-block" href="/checkout" style="margin-top:18px;">Checkout</a>
      <p style="font-size:11.5px; color:var(--faint); margin:12px 0 0; line-height:1.5;">
        The price you see is the price you pay. Nothing further is payable on delivery.
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
        <strong>What we do with these details.</strong> We use your name, address and phone number to
        import and deliver this order, and your email to send order updates and your certificate. We
        share only what delivery requires — with the seller, our customs broker and the courier. We do
        not use them for marketing and we do not sell them. Read the
        <a href="/privacy">privacy policy</a>.
      </div>

      <div class="notice" style="margin-top:12px;">
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
          }Arrives ${e.from}–${e.to}</div>
          <div class="serif" style="font-size:18px; margin-top:6px;">${formatINR(it.landed_price)}</div>
        </div>`;
        })
        .join('')}
      <div style="font-size:12.5px; color:#5c5748; margin-bottom:12px; line-height:1.6;">
        Import duty, customs, authentication and insured delivery are all included in this total.
      </div>
      <div style="display:flex; justify-content:space-between; font-weight:600; font-size:16px; padding-top:12px; border-top:1px solid var(--line);">
        <span>Total</span><span class="serif" style="font-size:22px;">${formatINR(total)}</span>
      </div>
      <button class="btn btn-block" type="submit" style="margin-top:18px;">Place order</button>
      <p style="font-size:11.5px; color:var(--faint); margin:12px 0 0; line-height:1.5;">
        Nothing further is payable on delivery. Every piece is authenticated before dispatch; if it
        fails, nothing ships and you are refunded everything.
        <a href="/returns">How refunds work</a>.
      </p>
    </div>
  </form>
</section>`;
}

// What the buyer sees. The internal pipeline has more steps than this — seller dispatch,
// inspection, customs — but those are our operations, not the customer's business, and they
// would reveal where a piece is coming from. Nothing shows as "Shipped" until it has passed
// authentication, so the status can never run ahead of the guarantee.
const PUBLIC_STAGES = [
  ['placed', 'Order placed', 'Reserved for you and on its way to our facility'],
  ['shipped', 'Shipped', 'Authenticated, sealed and dispatched to you'],
  ['out_for_delivery', 'Out for delivery', 'With the local courier'],
  ['delivered', 'Delivered', 'Signed for'],
];

// Internal stage -> the stage the buyer is shown. Everything before authentication reads as
// "Order placed": the piece is genuinely still being processed, and saying more would leak
// sourcing.
const PUBLIC_STAGE_OF = {
  placed: 'placed',
  seller_shipped: 'placed',
  authenticating: 'placed',
  authenticated: 'shipped',
  in_transit: 'shipped',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
};

export function publicStageIndex(internalStatus) {
  const key = PUBLIC_STAGE_OF[internalStatus] || 'placed';
  return PUBLIC_STAGES.findIndex(([k]) => k === key);
}

export function orderPage({ order, events, certificate }) {
  const current = publicStageIndex(order.status);
  const refund = refundBreakdown(order);

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
      ${PUBLIC_STAGES.map(([key, label, sub], i) => {
        const cls = i < current ? 'done' : i === current ? 'done current' : '';
        return `<div class="stage ${cls}" style="min-width:150px;">
          <div class="bar"></div>
          <div class="label">${label}</div>
          <div class="sub">${sub}</div>
        </div>`;
      }).join('')}
    </div>
  </div>

  ${
    current === 0
      ? `<div class="notice" style="margin-top:18px;">
           Your piece is being prepared and authenticated. We do not mark an order as shipped until
           it has passed our inspection, so this step takes a little longer than you may be used to —
           that wait is the guarantee doing its job.
         </div>`
      : ''
  }

  <div class="panel" style="margin-top:18px; padding:20px 24px;">
    <div style="font-size:13.5px; font-weight:600; margin-bottom:10px;">If this order were refunded</div>
    <div style="display:flex; flex-direction:column; gap:10px; font-size:12.5px; color:#5c5748; max-width:460px;">
      <div>
        <div style="font-weight:600; color:var(--green); margin-bottom:2px;">If it's our fault — not authentic, damaged, or not as described</div>
        <div style="display:flex; justify-content:space-between;"><span>You receive</span><span style="font-weight:600;">${formatINR(
          order.amount
        )}</span></div>
        <div style="font-size:11px; color:var(--faint);">Everything, duty and freight included. Nothing withheld.</div>
      </div>
      <div style="padding-top:10px; border-top:1px solid var(--line);">
        <div style="font-weight:600; margin-bottom:2px;">If you change your mind</div>
        <div style="display:flex; justify-content:space-between;"><span>Piece and authentication</span><span>${formatINR(
          refund.refundable
        )}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Import duty and freight — not refundable</span><span>${formatINR(
          refund.nonRefundable
        )}</span></div>
        <div style="display:flex; justify-content:space-between; padding-top:6px; font-weight:600; color:var(--text);"><span>You would receive</span><span>${formatINR(
          refund.refundable
        )}</span></div>
      </div>
    </div>
    <div style="font-size:11.5px; color:var(--muted); margin-top:10px; line-height:1.55;">
      Duty is paid to customs on arrival and cannot be reclaimed. Before dispatch, nothing has been
      imported yet and a cancellation returns the full amount. <a href="/returns">Returns policy</a>.
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
</section>`;
}

export function trackPage({ error }) {
  return `
<section class="section" style="max-width:640px;">
  <span class="tag gold">Tracking</span>
  <h2 class="serif" style="font-size:34px; margin:10px 0 8px;">Track your order</h2>
  <p class="muted" style="margin:0 0 22px;">Enter the reference from your confirmation email, e.g. RH-4F2A19.</p>
  ${error ? `<div class="notice notice-bad" style="margin-bottom:16px;">${escapeHtml(error)}</div>` : ''}
  <form method="get" action="/track">
    <div class="field"><input name="ref" placeholder="RH-XXXXXX" required maxlength="20" autocapitalize="characters"></div>
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
