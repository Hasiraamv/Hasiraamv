// Coupon lookup and discount math. Nothing here trusts anything from a cookie beyond the
// code itself -- scope, expiry, use limits and amounts are always re-read from the database
// and re-checked against the actual cart, so a tampered cookie can never change what a
// coupon is worth.

export function normalizeCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase();
}

export async function findCoupon(db, code) {
  const c = normalizeCode(code);
  if (!c) return null;
  return db.prepare('SELECT * FROM coupons WHERE code = ?').bind(c).first();
}

function itemQualifies(coupon, item) {
  if (coupon.scope === 'product') return item.product_id === coupon.product_id;
  if (coupon.scope === 'category') return item.category_id === coupon.category_id;
  return true; // 'all'
}

// Checks a coupon against the current cart and, if it applies, returns how much it takes
// off each item. Percent coupons discount every qualifying item individually; a fixed-rupee
// coupon is capped at the qualifying subtotal and split across those items proportionally,
// so a multi-item bag still gets a sensible per-item breakdown instead of going negative.
export function evaluateCoupon(coupon, items) {
  if (!coupon) return { ok: false, error: 'That coupon code does not exist.' };
  if (!coupon.active) return { ok: false, error: 'That coupon is no longer active.' };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { ok: false, error: 'That coupon has expired.' };
  }
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) {
    return { ok: false, error: 'That coupon has reached its usage limit.' };
  }

  const cartTotal = items.reduce((s, i) => s + i.landed_price, 0);
  if (coupon.min_order_value && cartTotal < coupon.min_order_value) {
    return {
      ok: false,
      error: `This coupon needs a bag of at least ₹${Number(coupon.min_order_value).toLocaleString('en-IN')}.`,
    };
  }

  const qualifying = items.filter((it) => itemQualifies(coupon, it));
  if (!qualifying.length) {
    return { ok: false, error: 'This coupon does not apply to anything in your bag.' };
  }

  const perItem = new Map();
  let totalDiscount = 0;

  if (coupon.discount_type === 'fixed') {
    const qualifyingTotal = qualifying.reduce((s, i) => s + i.landed_price, 0);
    const cap = Math.min(coupon.discount_value, qualifyingTotal);
    let remaining = cap;
    qualifying.forEach((it, i) => {
      const isLast = i === qualifying.length - 1;
      const share = isLast ? remaining : Math.round((it.landed_price / qualifyingTotal) * cap);
      perItem.set(it.id, share);
      remaining -= share;
      totalDiscount += share;
    });
  } else {
    for (const it of qualifying) {
      const d = Math.min(it.landed_price, Math.round((it.landed_price * coupon.discount_value) / 100));
      perItem.set(it.id, d);
      totalDiscount += d;
    }
  }

  return { ok: true, coupon, perItem, totalDiscount };
}
