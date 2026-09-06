// Every query is parameterised. No string interpolation of user input into SQL.

// One row per product, carrying the best live offer — this is the marketplace view the
// listing pages are built on.
const PRODUCT_LIST_SELECT = `
  SELECT p.id, p.slug, p.title, p.retail_price, p.size_type, p.created_at,
         c.slug AS category_slug, c.name AS category_name,
         (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order LIMIT 1) AS image_url,
         o.landed_price   AS lowest_price,
         o.ships_from     AS ships_from,
         o.lead_days_min  AS lead_days_min,
         o.lead_days_max  AS lead_days_max,
         (SELECT COUNT(*) FROM offers o2 WHERE o2.product_id = p.id AND o2.status = 'active') AS offer_count
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN offers o ON o.id = (
      SELECT id FROM offers ox
       WHERE ox.product_id = p.id AND ox.status = 'active'
       ORDER BY ox.landed_price ASC LIMIT 1
    )
   WHERE p.is_published = 1`;

export async function getCategories(db) {
  const { results } = await db
    .prepare('SELECT * FROM categories ORDER BY sort_order, name')
    .all();
  return results || [];
}

export async function getCategoryBySlug(db, slug) {
  return db.prepare('SELECT * FROM categories WHERE slug = ?').bind(slug).first();
}

export async function listProducts(db, opts = {}) {
  const clauses = [];
  const binds = [];

  if (opts.categorySlug && opts.categorySlug !== 'all') {
    clauses.push('c.slug = ?');
    binds.push(opts.categorySlug);
  }
  if (opts.search) {
    clauses.push('(p.title LIKE ? OR p.description LIKE ?)');
    const like = `%${opts.search}%`;
    binds.push(like, like);
  }
  if (opts.maxPrice) {
    clauses.push('o.landed_price <= ?');
    binds.push(opts.maxPrice);
  }
  if (opts.minPrice) {
    clauses.push('o.landed_price >= ?');
    binds.push(opts.minPrice);
  }
  if (opts.underRetail) {
    clauses.push('p.retail_price IS NOT NULL AND o.landed_price < p.retail_price');
  }
  if (opts.maxLead) {
    clauses.push('o.lead_days_max <= ?');
    binds.push(opts.maxLead);
  }
  if (opts.inStockOnly !== false) {
    clauses.push('o.id IS NOT NULL');
  }

  let sql = PRODUCT_LIST_SELECT;
  if (clauses.length) sql += ' AND ' + clauses.join(' AND ');

  const sorts = {
    price_asc: 'o.landed_price ASC',
    price_desc: 'o.landed_price DESC',
    new: 'p.created_at DESC, p.id DESC',
    fastest: 'o.lead_days_max ASC',
  };
  sql += ` ORDER BY ${sorts[opts.sort] || 'p.created_at DESC, p.id DESC'}`;
  sql += ' LIMIT ? OFFSET ?';
  binds.push(Math.min(opts.limit || 24, 60), opts.offset || 0);

  const { results } = await db.prepare(sql).bind(...binds).all();
  return results || [];
}

export async function getProductBySlug(db, slug) {
  return db
    .prepare(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name
         FROM products p JOIN categories c ON c.id = p.category_id
        WHERE p.slug = ? AND p.is_published = 1`
    )
    .bind(slug)
    .first();
}

export async function getProductImages(db, productId) {
  const { results } = await db
    .prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order')
    .bind(productId)
    .all();
  return results || [];
}

// All live offers for a product, cheapest first — the competing-sellers table.
export async function getOffersForProduct(db, productId) {
  const { results } = await db
    .prepare(
      `SELECT o.*, s.name AS seller_name, s.city AS seller_city, s.rating, s.sales_count,
              s.kyc_verified, s.legit_check
         FROM offers o JOIN sellers s ON s.id = o.seller_id
        WHERE o.product_id = ? AND o.status = 'active'
        ORDER BY o.landed_price ASC`
    )
    .bind(productId)
    .all();
  return results || [];
}

export async function getOfferById(db, id) {
  return db
    .prepare(
      `SELECT o.*, s.name AS seller_name, s.city AS seller_city,
              p.title AS product_title, p.slug AS product_slug, p.id AS product_id,
              c.slug AS category_slug
         FROM offers o
         JOIN sellers s ON s.id = o.seller_id
         JOIN products p ON p.id = o.product_id
         JOIN categories c ON c.id = p.category_id
        WHERE o.id = ?`
    )
    .bind(id)
    .first();
}

export async function getRelatedProducts(db, product, limit = 4) {
  const sql = `${PRODUCT_LIST_SELECT} AND p.id != ? AND c.id = ? AND o.id IS NOT NULL ORDER BY o.landed_price ASC LIMIT ?`;
  const { results } = await db.prepare(sql).bind(product.id, product.category_id, limit).all();
  return results || [];
}

export async function getSourcingRegions(db) {
  const { results } = await db
    .prepare(
      `SELECT ships_from AS city,
              MIN(lead_days_min) AS lead_min,
              MAX(lead_days_max) AS lead_max,
              COUNT(*) AS listings
         FROM offers WHERE status = 'active'
        GROUP BY ships_from
        ORDER BY listings DESC LIMIT 6`
    )
    .all();
  return results || [];
}

export async function getStats(db) {
  const sellers = await db.prepare("SELECT COUNT(*) AS n FROM sellers WHERE kyc_verified = 1").first();
  const listings = await db.prepare("SELECT COUNT(*) AS n FROM offers WHERE status = 'active'").first();
  return { sellers: sellers?.n || 0, listings: listings?.n || 0 };
}

// Orders --------------------------------------------------------------------

export async function createOrder(db, data) {
  const result = await db
    .prepare(
      `INSERT INTO orders
        (public_ref, offer_id, product_id, size_label, amount, seller_price, duty, auth_fee, shipping,
         buyer_name, buyer_email, buyer_phone, address_line1, address_line2, city, state, pincode,
         status, payment_status, eta_min, eta_max)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'placed', 'pending', ?, ?)`
    )
    .bind(
      data.publicRef,
      data.offerId,
      data.productId,
      data.sizeLabel,
      data.amount,
      data.sellerPrice,
      data.duty,
      data.authFee,
      data.shipping,
      data.buyerName,
      data.buyerEmail,
      data.buyerPhone,
      data.addressLine1,
      data.addressLine2 || null,
      data.city,
      data.state,
      data.pincode,
      data.etaMin,
      data.etaMax
    )
    .run();

  const orderId = result.meta.last_row_id;
  await addOrderEvent(db, orderId, 'placed', 'Order placed. Seller notified.');
  // Take the offer off the market so it cannot be sold twice.
  await db.prepare("UPDATE offers SET status = 'reserved' WHERE id = ?").bind(data.offerId).run();
  return orderId;
}

export async function addOrderEvent(db, orderId, status, note) {
  await db
    .prepare('INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)')
    .bind(orderId, status, note || null)
    .run();
  await db.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, orderId).run();
}

export async function getOrderByRef(db, ref) {
  return db
    .prepare(
      `SELECT o.*, p.title AS product_title, p.slug AS product_slug
         FROM orders o JOIN products p ON p.id = o.product_id
        WHERE o.public_ref = ?`
    )
    .bind(String(ref || '').trim().toUpperCase())
    .first();
}

export async function getOrderEvents(db, orderId) {
  const { results } = await db
    .prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at, id')
    .bind(orderId)
    .all();
  return results || [];
}

export async function listOrders(db, limit = 50) {
  const { results } = await db
    .prepare(
      `SELECT o.*, p.title AS product_title
         FROM orders o JOIN products p ON p.id = o.product_id
        ORDER BY o.created_at DESC LIMIT ?`
    )
    .bind(limit)
    .all();
  return results || [];
}

export async function createSourcingRequest(db, data) {
  await db
    .prepare(
      'INSERT INTO sourcing_requests (item, size_label, budget_max, name, contact, notes) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(data.item, data.sizeLabel || null, data.budgetMax || null, data.name || null, data.contact, data.notes || null)
    .run();
}

export async function listSourcingRequests(db, limit = 50) {
  const { results } = await db
    .prepare('SELECT * FROM sourcing_requests ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all();
  return results || [];
}
