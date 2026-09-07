// Turns a seller price into a landed price using editable rate rules, so nobody works out
// duty by hand for every listing.
//
// Duty is the number that decides whether an order makes money. Getting it wrong is silent
// — the order still completes, you just lose on it — which is exactly why it belongs in one
// place you can audit rather than retyped into every offer.

import { categoryCode } from './certificates.js';

export async function getCategoryRate(db, categoryId) {
  return db
    .prepare('SELECT duty_pct, auth_fee FROM category_rates WHERE category_id = ?')
    .bind(categoryId)
    .first();
}

export async function getSourceCity(db, city) {
  if (!city) return null;
  return db
    .prepare('SELECT * FROM source_cities WHERE city = ? COLLATE NOCASE')
    .bind(String(city).trim())
    .first();
}

export async function listSourceCities(db) {
  const { results } = await db
    .prepare('SELECT * FROM source_cities WHERE active = 1 ORDER BY city')
    .all();
  return results || [];
}

export async function listCategoryRates(db) {
  const { results } = await db
    .prepare(
      `SELECT c.id, c.name, c.slug,
              COALESCE(r.duty_pct, 0) AS duty_pct,
              COALESCE(r.auth_fee, 0) AS auth_fee
         FROM categories c
         LEFT JOIN category_rates r ON r.category_id = c.id
        ORDER BY c.sort_order, c.name`
    )
    .all();
  return results || [];
}

// Works out the four components for an offer. Anything passed in `overrides` wins, so a
// one-off shipment with unusual freight can still be entered by hand.
export async function computeOfferPricing(db, { categoryId, city, sellerPrice, overrides = {} }) {
  const rate = await getCategoryRate(db, categoryId);
  const source = await getSourceCity(db, city);

  const price = Math.max(0, Math.round(Number(sellerPrice) || 0));
  const dutyPct = Number(rate?.duty_pct ?? 0);

  const computed = {
    duty: Math.round((price * dutyPct) / 100),
    auth_fee: Math.round(Number(rate?.auth_fee ?? 0)),
    shipping: Math.round(Number(source?.shipping_cost ?? 0)),
    lead_days_min: Number(source?.lead_days_min ?? 14),
    lead_days_max: Number(source?.lead_days_max ?? 28),
  };

  for (const key of Object.keys(computed)) {
    const given = overrides[key];
    if (given !== undefined && given !== null && given !== '') {
      const n = Number(given);
      if (Number.isFinite(n) && n >= 0) computed[key] = Math.round(n);
    }
  }

  computed.seller_price = price;
  computed.landed_price = price + computed.duty + computed.auth_fee + computed.shipping;
  computed.duty_pct_used = dutyPct;
  computed.rate_found = !!rate;
  computed.city_found = !!source;
  return computed;
}

// What comes back to the buyer on a refund.
//
// Import duty is paid to the government the moment the parcel lands and cannot be reclaimed,
// and the freight has already been flown. So the refundable part is the piece itself plus the
// authentication fee — we charged for a check, and a refund means that check did not deliver
// what it promised.
//
// This split MUST be disclosed before purchase, not discovered afterwards. A term that only
// appears once a customer is complaining is exactly the kind an Indian consumer forum treats
// as an unfair contract term under s.2(46) of the Consumer Protection Act 2019.
export function refundBreakdown(order) {
  const amount = Number(order.amount) || 0;
  const duty = Number(order.duty) || 0;
  const shipping = Number(order.shipping) || 0;
  const nonRefundable = duty + shipping;
  return {
    total: amount,
    refundable: Math.max(0, amount - nonRefundable),
    nonRefundable,
    duty,
    shipping,
  };
}

// Internal shelf number, one per physical item: MM-SNK-00042.
// Unlike a certificate number this is for you, not the buyer, so it carries no check
// character — it is read off a label in your own warehouse, not typed by a stranger.
export async function nextStockCode(db, categorySlug) {
  const code = categoryCode(categorySlug);
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM offers WHERE stock_code LIKE ?`
    )
    .bind(`MM-${code}-%`)
    .first();

  // Take the highest existing sequence rather than the count, so deleting an offer never
  // causes the next one to reuse a number that has already been printed on a label.
  const highest = await db
    .prepare(
      `SELECT stock_code FROM offers WHERE stock_code LIKE ? ORDER BY stock_code DESC LIMIT 1`
    )
    .bind(`MM-${code}-%`)
    .first();

  let next = (row?.n || 0) + 1;
  if (highest?.stock_code) {
    const m = /-(\d+)$/.exec(highest.stock_code);
    if (m) next = Number(m[1]) + 1;
  }

  return `MM-${code}-${String(next).padStart(5, '0')}`;
}
