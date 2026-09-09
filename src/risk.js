// High-value / suspicious order review (spec section 10: "High-value order review").
//
// This is a set of visible flags for a human to check before an order ships, not an automatic
// block -- refusing a legitimate buyer's money over a heuristic is its own kind of damage, and
// with no payment gateway wired yet there is nothing here to "decline" anyway. What it can do
// honestly, with the data actually available (no card network, no device fingerprinting, no
// fraud-scoring service), is surface the handful of signals that matter for a luxury reseller:
// a big first order, a burst of orders from the same buyer, and a shipping destination outside
// India for a business that only ships within it.
//
// FRAUD_REVIEW_THRESHOLD (wrangler.toml [vars], rupees) sets what counts as "high value" --
// tune it to the business, there is no universal number.

const DEFAULT_THRESHOLD = 200000; // ₹2,00,000 -- adjust via FRAUD_REVIEW_THRESHOLD

export async function computeOrderRisk(env, { orderId, amount, userId, buyerEmail, buyerPhone, request }) {
  const flags = [];
  const threshold = Number(env.FRAUD_REVIEW_THRESHOLD) || DEFAULT_THRESHOLD;

  if (amount >= threshold) flags.push('high_value');

  // A guest checkout, or a signed-in account with no completed order history, carries more
  // risk on a high-value order than a returning buyer does -- not on its own, but combined
  // with size it is worth a look.
  const priorOrders = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM orders WHERE id != ? AND (buyer_email = ? COLLATE NOCASE OR (user_id IS NOT NULL AND user_id = ?))`
  )
    .bind(orderId, buyerEmail, userId || 0)
    .first();
  if (!priorOrders?.n) flags.push('first_order');

  // Several orders from the same email or phone in a short window is the classic card-testing
  // pattern -- one declined attempt is normal, a burst of them within the hour is not.
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM orders
      WHERE id != ? AND created_at >= datetime('now', '-1 hour')
        AND (buyer_email = ? COLLATE NOCASE OR buyer_phone = ?)`
  )
    .bind(orderId, buyerEmail, buyerPhone)
    .first();
  if ((recent?.n || 0) >= 2) flags.push('order_burst');

  // Cloudflare sets this on every request it proxies -- no external lookup needed. The
  // storefront only ships within India, so a checkout from outside it (or a Tor exit node,
  // "T1") is worth a second look, not a spoofed shipping address on its own.
  const country = request?.headers.get('cf-ipcountry');
  if (country && country !== 'IN' && country !== 'XX') flags.push(`ip_country_${country.toLowerCase()}`);

  return { score: flags.length, flags };
}

export function riskLabel(flag) {
  const labels = {
    high_value: 'High value',
    first_order: 'First order from this buyer',
    order_burst: 'Several orders in the last hour',
  };
  if (labels[flag]) return labels[flag];
  if (flag.startsWith('ip_country_')) return `Checkout from outside India (${flag.slice(11).toUpperCase()})`;
  return flag;
}
