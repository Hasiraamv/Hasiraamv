import { escapeHtml, formatINR, html, redirect, sealMark } from './render.js';
import * as db from './db.js';
import { issueCertificate } from './certificates.js';
import { storeImage, deleteImage, storeVideo } from './images.js';
import {
  computeOfferPricing,
  listCategoryRates,
  listSourceCities,
  nextStockCode,
  refundBreakdown,
} from './pricing.js';
import {
  parseCookies,
  cookieHeader,
  clearCookie,
  createAdminToken,
  verifyAdminToken,
  checkPassword,
} from './session.js';

const ADMIN_COOKIE = 'rh_admin';

const ORDER_STAGES = [
  'placed',
  'seller_shipped',
  'authenticating',
  'authenticated',
  'in_transit',
  'out_for_delivery',
  'delivered',
];

export async function adminRouter(request, env, path) {
  const method = request.method.toUpperCase();

  if (!env.SESSION_SECRET || !env.ADMIN_PASSWORD) {
    return adminHtml(
      `<div class="notice notice-bad">
         Admin is disabled because its secrets are not set. Run
         <code>wrangler secret put ADMIN_PASSWORD</code> and
         <code>wrangler secret put SESSION_SECRET</code>, then redeploy.
       </div>`,
      503
    );
  }

  if (path === '/admin/login') {
    if (method === 'POST') {
      const form = await request.formData();
      if (checkPassword(form.get('password'), env.ADMIN_PASSWORD)) {
        const token = await createAdminToken(env.SESSION_SECRET);
        return redirect('/admin', {
          'set-cookie': cookieHeader(ADMIN_COOKIE, token, { maxAge: 60 * 60 * 8 }),
        });
      }
      return adminHtml(loginForm('That password is not right.'), 401);
    }
    return adminHtml(loginForm());
  }

  if (path === '/admin/logout') {
    return redirect('/admin/login', { 'set-cookie': clearCookie(ADMIN_COOKIE) });
  }

  const token = parseCookies(request)[ADMIN_COOKIE];
  if (!(await verifyAdminToken(env.SESSION_SECRET, token))) {
    return redirect('/admin/login');
  }

  if (path === '/admin') return dashboard(env);
  if (path === '/admin/orders')
    return ordersPage(env, new URL(request.url).searchParams.get('issued'));
  if (path === '/admin/orders/advance' && method === 'POST') return advanceOrder(request, env);
  if (path === '/admin/certificates') return certificatesPage(env);
  if (path === '/admin/certificates/issue' && method === 'POST') return issueCert(request, env);
  if (path === '/admin/certificates/revoke' && method === 'POST') return revokeCert(request, env);
  if (path === '/admin/products') {
    const qs = new URL(request.url).searchParams;
    const forOffer = Number(qs.get('offer_for'));
    return productsPage(env, qs.get('error'), Number.isInteger(forOffer) ? forOffer : null);
  }
  if (path === '/admin/products/create' && method === 'POST') return createProduct(request, env);
  if (path === '/admin/offers/create' && method === 'POST') return createOffer(request, env);
  if (path === '/admin/images/upload' && method === 'POST') return uploadImage(request, env);
  if (path === '/admin/images/delete' && method === 'POST') return removeImage(request, env);
  if (path === '/admin/images/reorder' && method === 'POST') return reorderImage(request, env);
  if (path === '/admin/products/video-upload' && method === 'POST') return uploadVideo(request, env);
  if (path === '/admin/products/video-remove' && method === 'POST') return removeVideo(request, env);
  if (path === '/admin/rates')
    return ratesPage(env, new URL(request.url).searchParams.get('saved'));
  if (path === '/admin/rates/categories' && method === 'POST') return saveCategoryRates(request, env);
  if (path === '/admin/rates/cities' && method === 'POST') return saveCity(request, env);
  if (path === '/admin/sourcing') return sourcingPage(env);
  if (path === '/admin/sellers') return sellerApplicationsPage(env);
  if (path === '/admin/sellers/decide' && method === 'POST') return decideApplication(request, env);

  return adminHtml('<div class="notice">Unknown admin page.</div>', 404);
}

// Shell ----------------------------------------------------------------------

function adminHtml(body, status = 200, extraHeaders = {}) {
  return html(
    `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin · Rarehaus</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500;6..96,700&family=Archivo:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/styles.css">
</head><body>
<div class="announce"><span class="tag">Rarehaus admin</span></div>
<div class="nav">
  <a class="logo" href="/admin">${sealMark('var(--gold)', 22)}RAREHAUS <span style="font-size:13px; letter-spacing:0; color:var(--faint)">admin</span></a>
  <nav class="nav-links">
    <a href="/admin/orders">Orders</a>
    <a href="/admin/certificates">Certificates</a>
    <a href="/admin/products">Products &amp; offers</a>
    <a href="/admin/rates">Rates</a>
    <a href="/admin/sellers">Seller applications</a>
    <a href="/admin/sourcing">Sourcing requests</a>
  </nav>
  <div class="nav-right"><a href="/" target="_blank">View site</a><a href="/admin/logout">Sign out</a></div>
</div>
<main class="section" style="padding-top:32px;">${body}</main>
</body></html>`,
    status,
    extraHeaders
  );
}

function loginForm(error) {
  return `
<div style="max-width:380px;">
  <h2 class="serif" style="font-size:30px; margin:0 0 16px;">Sign in</h2>
  ${error ? `<div class="notice notice-bad" style="margin-bottom:14px;">${escapeHtml(error)}</div>` : ''}
  <form method="post" action="/admin/login">
    <div class="field">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required autofocus autocomplete="current-password">
    </div>
    <button class="btn btn-block" type="submit">Sign in</button>
  </form>
</div>`;
}

// Pages ----------------------------------------------------------------------

async function dashboard(env) {
  const [orders, requests, stats] = await Promise.all([
    db.listOrders(env.DB, 8),
    db.listSourcingRequests(env.DB, 5),
    db.getStats(env.DB),
  ]);
  const pendingCerts = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM orders WHERE certificate_no IS NULL AND status IN ('authenticating','authenticated','seller_shipped')`
  ).first();
  const revenue = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount),0) AS total FROM orders WHERE payment_status = 'paid'`
  ).first();

  return adminHtml(`
<h2 class="serif" style="font-size:32px; margin:0 0 22px;">Today</h2>
<div class="grid grid-4" style="margin-bottom:32px;">
  ${[
    ['Live listings', stats.listings],
    ['Orders', orders.length],
    ['Awaiting certificate', pendingCerts?.n || 0],
    ['Paid revenue', formatINR(revenue?.total || 0)],
  ]
    .map(
      ([k, v]) =>
        `<div class="panel" style="padding:20px;"><div class="tag muted">${k}</div><div class="serif" style="font-size:28px; margin-top:6px;">${v}</div></div>`
    )
    .join('')}
</div>

<h3 class="serif" style="font-size:24px; margin:0 0 14px;">Recent orders</h3>
${ordersTable(orders)}

<h3 class="serif" style="font-size:24px; margin:32px 0 14px;">Latest sourcing requests</h3>
${
  requests.length
    ? `<table class="table"><thead><tr><th>Item</th><th>Size</th><th>Budget</th><th>Contact</th><th>When</th></tr></thead><tbody>
       ${requests
         .map(
           (r) => `<tr>
             <td data-label="Item">${escapeHtml(r.item)}</td>
             <td data-label="Size">${escapeHtml(r.size_label || '—')}</td>
             <td data-label="Budget">${r.budget_max ? formatINR(r.budget_max) : '—'}</td>
             <td data-label="Contact">${escapeHtml(r.contact)}</td>
             <td data-label="When">${escapeHtml(String(r.created_at).slice(0, 10))}</td>
           </tr>`
         )
         .join('')}
       </tbody></table>`
    : '<div class="notice">No requests yet.</div>'
}`);
}

function ordersTable(orders) {
  if (!orders.length) return '<div class="notice">No orders yet.</div>';
  return `
<table class="table">
  <thead><tr><th>Ref</th><th>Item</th><th>Buyer</th><th class="num">Amount</th><th>Status</th><th>Certificate</th><th>Advance</th></tr></thead>
  <tbody>
    ${orders
      .map((o) => {
        const idx = ORDER_STAGES.indexOf(o.status);
        const next = idx >= 0 && idx < ORDER_STAGES.length - 1 ? ORDER_STAGES[idx + 1] : null;
        return `<tr>
        <td data-label="Ref"><a href="/order/${encodeURIComponent(o.public_ref)}" target="_blank">${escapeHtml(
          o.public_ref
        )}</a></td>
        <td data-label="Item">${escapeHtml(o.product_title)}${
          o.size_label !== 'One size' ? ` · ${escapeHtml(o.size_label)}` : ''
        }</td>
        <td data-label="Buyer">${escapeHtml(o.buyer_name)}<div style="font-size:11.5px; color:var(--faint)">${escapeHtml(
          o.buyer_phone
        )}</div></td>
        <td data-label="Amount" class="num">${formatINR(o.amount)}
          <div style="font-size:11px; color:var(--faint);">refundable ${formatINR(
            refundBreakdown(o).refundable
          )}</div>
        </td>
        <td data-label="Status">${escapeHtml(o.status.replace(/_/g, ' '))}</td>
        <td data-label="Certificate">${
          o.certificate_no
            ? `<a href="/certificate/${encodeURIComponent(o.certificate_no)}" target="_blank">${escapeHtml(
                o.certificate_no
              )}</a>`
            : '<span class="faint">—</span>'
        }</td>
        <td data-label="Advance">${
          next
            ? `<form method="post" action="/admin/orders/advance" style="display:flex; gap:6px;">
                 <input type="hidden" name="order_id" value="${o.id}">
                 <input type="hidden" name="status" value="${next}">
                 <button class="chip" type="submit" style="cursor:pointer;">→ ${escapeHtml(
                   next.replace(/_/g, ' ')
                 )}</button>
               </form>`
            : '<span class="faint">done</span>'
        }</td>
      </tr>`;
      })
      .join('')}
  </tbody>
</table>`;
}

async function ordersPage(env, issuedNo) {
  const orders = await db.listOrders(env.DB, 100);

  let banner = '';
  if (issuedNo) {
    const cert = await env.DB.prepare(
      'SELECT certificate_no, verify_code FROM certificates WHERE certificate_no = ?'
    )
      .bind(String(issuedNo).toUpperCase())
      .first();
    if (cert) {
      banner = `
<div class="cert-card" style="margin-bottom:24px;">
  <div class="notice notice-good" style="margin-bottom:18px;">Certificate issued automatically on authentication.</div>
  <div class="tag" style="color:var(--gold-light)">Certificate number</div>
  <div class="serif" style="font-size:28px; letter-spacing:.08em; margin:6px 0 20px;">${escapeHtml(
    cert.certificate_no
  )}</div>
  <div class="tag" style="color:var(--gold-light)">Verification code — print this and seal it inside the package</div>
  <div class="serif" style="font-size:28px; letter-spacing:.22em; margin-top:6px;">${escapeHtml(
    cert.verify_code
  )}</div>
  <div style="margin-top:20px; display:flex; gap:12px; flex-wrap:wrap;">
    <a class="btn btn-gold" href="/certificate/${encodeURIComponent(cert.certificate_no)}" target="_blank">Print certificate</a>
  </div>
</div>`;
    }
  }

  return adminHtml(`
<h2 class="serif" style="font-size:32px; margin:0 0 8px;">Orders</h2>
<p class="muted" style="margin:0 0 22px; font-size:13.5px;">
  Advancing an order adds a stage to the buyer's tracking timeline immediately. Moving one to
  <strong>authenticated</strong> issues its certificate automatically.
</p>
${banner}
${ordersTable(orders)}`);
}

async function advanceOrder(request, env) {
  const form = await request.formData();
  const orderId = Number(form.get('order_id'));
  const status = String(form.get('status') || '');
  if (!Number.isInteger(orderId) || !ORDER_STAGES.includes(status)) return redirect('/admin/orders');

  const notes = {
    seller_shipped: 'Seller dispatched the piece to our authentication facility.',
    authenticating: 'Arrived at our facility. 30-point inspection under way.',
    authenticated: 'Passed inspection. Certificate issued and package sealed.',
    in_transit: 'Duties paid. In transit and clearing customs.',
    out_for_delivery: 'With the local courier for delivery.',
    delivered: 'Delivered and signed for.',
  };

  await db.addOrderEvent(env.DB, orderId, status, notes[status] || null);

  // Passing authentication is what earns a certificate, so issue it here rather than
  // leaving it as a separate step someone can forget.
  if (status === 'authenticated') {
    const issued = await issueCertificateForOrder(env, orderId);
    if (issued) {
      return redirect(`/admin/orders?issued=${encodeURIComponent(issued.certificateNo)}`);
    }
  }

  if (status === 'delivered') {
    await env.DB.prepare("UPDATE offers SET status = 'sold' WHERE id = (SELECT offer_id FROM orders WHERE id = ?)")
      .bind(orderId)
      .run();
  }
  return redirect('/admin/orders');
}

// Issues a certificate for an order that does not have one yet. Returns null when the
// order is missing or already certified, so advancing twice never mints a second number.
async function issueCertificateForOrder(env, orderId, { authenticatorId, sellerReportRef, notes } = {}) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  if (!order || order.certificate_no) return null;

  const offer = await db.getOfferById(env.DB, order.offer_id);
  const product = await env.DB.prepare('SELECT * FROM products WHERE id = ?')
    .bind(order.product_id)
    .first();
  if (!offer || !product) return null;

  const category = await env.DB.prepare('SELECT slug FROM categories WHERE id = ?')
    .bind(product.category_id)
    .first();
  const seller = await env.DB.prepare('SELECT * FROM sellers WHERE id = ?').bind(offer.seller_id).first();

  // Fall back to the first active authenticator so an automatic issue is still signed.
  let signedBy = authenticatorId;
  if (!signedBy) {
    const fallback = await env.DB.prepare(
      'SELECT id FROM authenticators WHERE active = 1 ORDER BY id LIMIT 1'
    ).first();
    signedBy = fallback?.id || null;
  }

  return issueCertificate(env.DB, {
    order,
    product,
    offer,
    seller,
    categorySlug: category?.slug,
    authenticatorId: signedBy,
    sellerReportRef: sellerReportRef || null,
    notes: notes || null,
  });
}

async function certificatesPage(env) {
  const { results: certs } = await env.DB.prepare(
    `SELECT c.*, a.initials AS authenticator_initials, o.public_ref
       FROM certificates c
       LEFT JOIN authenticators a ON a.id = c.authenticator_id
       LEFT JOIN orders o ON o.id = c.order_id
      ORDER BY c.created_at DESC LIMIT 100`
  ).all();

  const { results: awaiting } = await env.DB.prepare(
    `SELECT o.id, o.public_ref, o.size_label, p.title AS product_title
       FROM orders o JOIN products p ON p.id = o.product_id
      WHERE o.certificate_no IS NULL
      ORDER BY o.created_at DESC LIMIT 50`
  ).all();

  const { results: auths } = await env.DB.prepare(
    'SELECT * FROM authenticators WHERE active = 1 ORDER BY initials'
  ).all();

  return adminHtml(`
<h2 class="serif" style="font-size:32px; margin:0 0 8px;">Certificates</h2>
<p class="muted" style="margin:0 0 24px; font-size:13.5px;">
  Issue a certificate once the piece has passed its in-house inspection. The number is generated
  from the year, source city and category, with a check character. The verification code is shown
  once here — print it and put it inside the sealed package.
</p>

<div class="panel" style="padding:22px; margin-bottom:28px;">
  <h3 class="serif" style="font-size:20px; margin:0 0 14px;">Issue a certificate</h3>
  ${
    (awaiting || []).length
      ? `<form method="post" action="/admin/certificates/issue">
    <div class="form-row">
      <div class="field">
        <label for="order_id">Order</label>
        <select id="order_id" name="order_id" required>
          ${(awaiting || [])
            .map(
              (o) =>
                `<option value="${o.id}">${escapeHtml(o.public_ref)} — ${escapeHtml(o.product_title)}${
                  o.size_label !== 'One size' ? ` (${escapeHtml(o.size_label)})` : ''
                }</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="field">
        <label for="authenticator_id">Authenticator</label>
        <select id="authenticator_id" name="authenticator_id">
          <option value="">—</option>
          ${(auths || [])
            .map((a) => `<option value="${a.id}">${escapeHtml(a.initials)} — ${escapeHtml(a.full_name)}</option>`)
            .join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="field"><label for="report">Seller report reference</label><input id="report" name="report" maxlength="60" placeholder="LC-000000"></div>
      <div class="field"><label for="notes">Inspection notes</label><input id="notes" name="notes" maxlength="300"></div>
    </div>
    <button class="btn" type="submit">Issue certificate</button>
  </form>`
      : '<div class="notice">Every order already has a certificate.</div>'
  }
</div>

<h3 class="serif" style="font-size:24px; margin:0 0 14px;">Issued</h3>
${
  (certs || []).length
    ? `<table class="table">
       <thead><tr><th>Number</th><th>Item</th><th>Source</th><th>Issued</th><th>By</th><th>Status</th><th></th></tr></thead>
       <tbody>
       ${certs
         .map(
           (c) => `<tr>
           <td data-label="Number"><a href="/certificate/${encodeURIComponent(
             c.certificate_no
           )}" target="_blank">${escapeHtml(c.certificate_no)}</a></td>
           <td data-label="Item">${escapeHtml(c.product_title)}</td>
           <td data-label="Source">${escapeHtml(c.sourced_from)}</td>
           <td data-label="Issued">${escapeHtml(c.issued_on)}</td>
           <td data-label="By">${escapeHtml(c.authenticator_initials || '—')}</td>
           <td data-label="Status">${escapeHtml(c.status)}</td>
           <td>${
             c.status === 'valid'
               ? `<form method="post" action="/admin/certificates/revoke" onsubmit="return confirm('Revoke ${escapeHtml(
                   c.certificate_no
                 )}? Buyers checking it will be told it is not valid.');">
                    <input type="hidden" name="certificate_no" value="${escapeHtml(c.certificate_no)}">
                    <input name="reason" placeholder="Reason" maxlength="120" style="padding:8px; border:1px solid var(--line); font-size:12px; width:130px;">
                    <button class="chip" type="submit" style="cursor:pointer;">Revoke</button>
                  </form>`
               : escapeHtml(c.revoked_reason || '')
           }</td>
         </tr>`
         )
         .join('')}
       </tbody></table>`
    : '<div class="notice">None issued yet.</div>'
}`);
}

async function issueCert(request, env) {
  const form = await request.formData();
  const orderId = Number(form.get('order_id'));
  if (!Number.isInteger(orderId)) return redirect('/admin/certificates');

  const issued = await issueCertificateForOrder(env, orderId, {
    authenticatorId: Number(form.get('authenticator_id')) || null,
    sellerReportRef: String(form.get('report') || '').trim() || null,
    notes: String(form.get('notes') || '').trim() || null,
  });
  if (!issued) return redirect('/admin/certificates');

  return adminHtml(`
<div class="notice notice-good">
  <strong>Certificate issued.</strong>
</div>
<div class="cert-card" style="margin:20px 0;">
  <div class="tag" style="color:var(--gold-light)">Certificate number</div>
  <div class="serif" style="font-size:30px; letter-spacing:.08em; margin:8px 0 22px;">${escapeHtml(
    issued.certificateNo
  )}</div>
  <div class="tag" style="color:var(--gold-light)">Verification code — print and seal inside the package</div>
  <div class="serif" style="font-size:30px; letter-spacing:.22em; margin-top:8px;">${escapeHtml(
    issued.verifyCode
  )}</div>
  <p style="font-size:12px; color:#8b8474; margin:22px 0 0; line-height:1.6;">
    This code is shown once. It is what proves possession of the sealed package, so do not email it
    or print it on the outside.
  </p>
</div>
<div style="display:flex; gap:12px;">
  <a class="btn" href="/certificate/${encodeURIComponent(issued.certificateNo)}" target="_blank">Print certificate</a>
  <a class="btn btn-outline" href="/admin/certificates">Back to certificates</a>
</div>`);
}

async function revokeCert(request, env) {
  const form = await request.formData();
  const certificateNo = String(form.get('certificate_no') || '').toUpperCase();
  const reason = String(form.get('reason') || '').trim().slice(0, 120) || 'Revoked by admin';
  await env.DB.prepare(
    "UPDATE certificates SET status = 'revoked', revoked_reason = ?, revoked_on = date('now') WHERE certificate_no = ?"
  )
    .bind(reason, certificateNo)
    .run();
  return redirect('/admin/certificates');
}

async function productsPage(env, errorMessage, preselectProductId = null) {
  const [categories, sellers] = await Promise.all([
    db.getCategories(env.DB),
    env.DB.prepare('SELECT * FROM sellers ORDER BY name').all().then((r) => r.results || []),
  ]);
  const { results: products } = await env.DB.prepare(
    `SELECT p.*, c.name AS category_name,
            (SELECT COUNT(*) FROM offers o WHERE o.product_id = p.id AND o.status = 'active') AS offer_count,
            (SELECT MIN(landed_price) FROM offers o WHERE o.product_id = p.id AND o.status = 'active') AS lowest
       FROM products p JOIN categories c ON c.id = p.category_id
      ORDER BY p.created_at DESC LIMIT 100`
  ).all();

  const { results: allImages } = await env.DB.prepare(
    'SELECT id, product_id, url FROM product_images ORDER BY product_id, sort_order'
  ).all();
  const imagesByProduct = new Map();
  for (const im of allImages || []) {
    if (!imagesByProduct.has(im.product_id)) imagesByProduct.set(im.product_id, []);
    imagesByProduct.get(im.product_id).push(im);
  }

  return adminHtml(`
<h2 class="serif" style="font-size:32px; margin:0 0 22px;">Products &amp; offers</h2>
${errorMessage ? `<div class="notice notice-bad" style="margin-bottom:20px;">${escapeHtml(errorMessage)}</div>` : ''}
${
  env.IMAGES
    ? ''
    : `<div class="notice" style="margin-bottom:20px;">
         <strong>Image storage is not connected.</strong> Enable R2 in the Cloudflare dashboard,
         create a bucket called <code>rarehaus-images</code>, then uncomment the
         <code>[[r2_buckets]]</code> block in <code>wrangler.toml</code> and redeploy. Until then you
         can still paste an image URL when creating a product.
       </div>`
}

<div class="grid grid-2" style="gap:24px; align-items:start; margin-bottom:32px;">
  <div class="panel" style="padding:22px;">
    <h3 class="serif" style="font-size:20px; margin:0 0 14px;">Add a product</h3>
    <form method="post" action="/admin/products/create">
      <div class="field"><label for="title">Title</label><input id="title" name="title" required maxlength="160"></div>
      <div class="form-row">
        <div class="field"><label for="category_id">Category</label>
          <select id="category_id" name="category_id" required>
            ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label for="size_type">Sizing</label>
          <select id="size_type" name="size_type">
            <option value="none">None</option><option value="uk">UK</option>
            <option value="eu">EU</option><option value="apparel">Apparel</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label for="sku">Style / SKU</label><input id="sku" name="sku" maxlength="60"></div>
        <div class="field"><label for="retail">Retail price (₹)</label><input id="retail" name="retail" inputmode="numeric" maxlength="12">
          <span class="hint">Set this to unlock the "under retail" badge.</span>
        </div>
      </div>
      <div class="field"><label for="description">Description</label><textarea id="description" name="description" rows="3" maxlength="1200"></textarea></div>
      <div class="field"><label for="condition">Condition notes</label><input id="condition" name="condition" maxlength="200"></div>
      <div class="field"><label for="image">Image URL (optional)</label><input id="image" name="image" maxlength="400" placeholder="https://...">
        <span class="hint">
          Only use photographs you took or have written permission to use. Brand press images,
          another reseller's photos and images lifted from search results are someone else's
          copyright, and using them is how a shop like this gets a takedown notice.
        </span>
      </div>
      <div class="field"><label for="video">Video URL (optional)</label><input id="video" name="video" maxlength="400" placeholder="YouTube, Vimeo, or a direct .mp4 link">
        <span class="hint">A short unboxing or 360° clip. YouTube/Vimeo links embed automatically; a direct video file plays inline. Same copyright rule as photos.</span>
      </div>
      <button class="btn btn-block" type="submit">Add product</button>
    </form>
  </div>

  <div class="panel" style="padding:22px;" id="offer-form">
    <h3 class="serif" style="font-size:20px; margin:0 0 14px;">Add a seller offer</h3>
    <p class="muted" style="font-size:12.5px; margin:0 0 14px;">The landed price is the sum of the four parts — that is what the buyer pays and what the breakdown shows.</p>
    <form method="post" action="/admin/offers/create">
      <div class="field"><label for="product_id">Product</label>
        <select id="product_id" name="product_id" required>
          ${(products || [])
            .map(
              (p) =>
                `<option value="${p.id}"${p.id === preselectProductId ? ' selected' : ''}>${escapeHtml(p.title)}</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="field" style="flex-direction:row; align-items:center; gap:8px;">
        <input type="checkbox" id="inhouse" name="inhouse" value="1" style="width:auto;">
        <label for="inhouse" style="margin:0;">Sourced and imported by us directly (in-house — no seller commission)</label>
      </div>
      <div class="form-row">
        <div class="field"><label for="seller_id">Seller</label>
          <select id="seller_id" name="seller_id" required>
            ${sellers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)} — ${escapeHtml(s.city)}</option>`).join('')}
          </select>
          <span class="hint">Ignored if "sourced in-house" above is checked.</span>
        </div>
        <div class="field"><label for="size_label">Size</label><input id="size_label" name="size_label" value="One size" maxlength="40"></div>
      </div>
      <div class="form-row">
        <div class="field"><label for="ships_from">Ships from</label><input id="ships_from" name="ships_from" required maxlength="60" placeholder="Tokyo"></div>
        <div class="field"><label for="condition_o">Condition</label><input id="condition_o" name="condition" value="Deadstock" maxlength="60"></div>
      </div>
      <div class="field"><label for="seller_price">Seller price (₹)</label><input id="seller_price" name="seller_price" required inputmode="numeric" maxlength="12">
        <span class="hint">Duty, authentication, shipping and lead time are worked out from your
        <a href="/admin/rates">rates</a>. Leave the overrides below blank unless this one is unusual.</span>
      </div>

      <details style="margin-bottom:14px;">
        <summary style="cursor:pointer; font-size:12.5px; color:var(--muted); padding:6px 0;">Override the calculated values</summary>
        <div style="padding-top:12px;">
          <div class="form-row">
            <div class="field"><label for="duty">Duty (₹)</label><input id="duty" name="duty" inputmode="numeric" maxlength="12" placeholder="auto"></div>
            <div class="field"><label for="auth_fee">Authentication (₹)</label><input id="auth_fee" name="auth_fee" inputmode="numeric" maxlength="12" placeholder="auto"></div>
          </div>
          <div class="form-row">
            <div class="field"><label for="shipping">Shipping (₹)</label><input id="shipping" name="shipping" inputmode="numeric" maxlength="12" placeholder="auto"></div>
            <div class="field"><label for="lead_min">Lead days min</label><input id="lead_min" name="lead_min" inputmode="numeric" maxlength="3" placeholder="auto"></div>
          </div>
          <div class="field" style="max-width:180px;"><label for="lead_max">Lead days max</label><input id="lead_max" name="lead_max" inputmode="numeric" maxlength="3" placeholder="auto"></div>
        </div>
      </details>

      <button class="btn btn-block" type="submit">Add offer</button>
    </form>
  </div>
</div>

<h3 class="serif" style="font-size:24px; margin:0 0 14px;">Catalogue</h3>
<table class="table">
  <thead><tr><th>Product</th><th>Photos</th><th>Video</th><th class="num">Offers</th><th class="num">Lowest</th><th></th></tr></thead>
  <tbody>
    ${(products || [])
      .map((p) => {
        const imgs = imagesByProduct.get(p.id) || [];
        return `<tr>
        <td data-label="Product">
          <strong>${escapeHtml(p.title)}</strong>
          <div style="font-size:11.5px; color:var(--faint);">${escapeHtml(p.category_name)}</div>
        </td>
        <td data-label="Photos">
          <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
            ${imgs
              .map(
                (im, i) => `<span style="position:relative; display:inline-block;">
                  <img src="${escapeHtml(im.url)}" alt="" style="width:44px; height:44px; object-fit:cover; border:1px solid var(--line);">
                  ${i === 0 ? `<span style="position:absolute; bottom:-2px; left:-2px; background:var(--ink-soft); color:var(--paper); font-size:9px; padding:1px 4px;">1st</span>` : ''}
                  <form method="post" action="/admin/images/delete" style="display:inline;">
                    <input type="hidden" name="image_id" value="${im.id}">
                    <button type="submit" title="Delete photo" aria-label="Delete this photo" style="position:absolute; top:-6px; right:-6px; width:18px; height:18px; line-height:1; border:1px solid var(--line); background:var(--card); cursor:pointer; font-size:11px; padding:0;">×</button>
                  </form>
                  <span style="position:absolute; top:-6px; left:-6px; display:flex; flex-direction:column;">
                    <form method="post" action="/admin/images/reorder" style="display:inline;">
                      <input type="hidden" name="image_id" value="${im.id}">
                      <input type="hidden" name="direction" value="up">
                      <button type="submit" title="Move earlier" aria-label="Move this photo earlier" ${i === 0 ? 'disabled' : ''} style="width:16px; height:14px; line-height:1; border:1px solid var(--line); background:var(--card); cursor:pointer; font-size:9px; padding:0;">&uarr;</button>
                    </form>
                    <form method="post" action="/admin/images/reorder" style="display:inline;">
                      <input type="hidden" name="image_id" value="${im.id}">
                      <input type="hidden" name="direction" value="down">
                      <button type="submit" title="Move later" aria-label="Move this photo later" ${i === imgs.length - 1 ? 'disabled' : ''} style="width:16px; height:14px; line-height:1; border:1px solid var(--line); background:var(--card); cursor:pointer; font-size:9px; padding:0;">&darr;</button>
                    </form>
                  </span>
                </span>`
              )
              .join('')}
            ${
              env.IMAGES
                ? `<form method="post" action="/admin/images/upload" enctype="multipart/form-data" style="display:flex; gap:6px; align-items:center;">
                     <input type="hidden" name="product_id" value="${p.id}">
                     <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/gif" required style="font-size:11px; max-width:170px;">
                     <button class="chip" type="submit" style="cursor:pointer;">Upload</button>
                   </form>`
                : `<span class="faint" style="font-size:11.5px;">${imgs.length ? '' : 'No photos'}</span>`
            }
          </div>
        </td>
        <td data-label="Video" style="font-size:11.5px;">
          ${
            p.video_url
              ? `<div style="display:flex; align-items:center; gap:6px;">
                   <span class="faint">Set</span>
                   <form method="post" action="/admin/products/video-remove" style="display:inline;">
                     <input type="hidden" name="product_id" value="${p.id}">
                     <button type="submit" title="Remove video" class="chip" style="cursor:pointer; padding:2px 8px;">×</button>
                   </form>
                 </div>`
              : env.IMAGES
              ? `<form method="post" action="/admin/products/video-upload" enctype="multipart/form-data" style="display:flex; gap:6px; align-items:center;">
                   <input type="hidden" name="product_id" value="${p.id}">
                   <input type="file" name="file" accept="video/mp4,video/webm" required style="font-size:11px; max-width:140px;">
                   <button class="chip" type="submit" style="cursor:pointer;">Upload</button>
                 </form>`
              : `<span class="faint">None</span>`
          }
        </td>
        <td data-label="Offers" class="num">
          ${p.offer_count}
          ${!p.offer_count ? `<div><a href="/admin/products?offer_for=${p.id}#offer-form" style="font-size:11px; color:var(--oxblood);">Add an offer &rarr;</a></div>` : ''}
        </td>
        <td data-label="Lowest" class="num">${p.lowest ? formatINR(p.lowest) : '—'}</td>
        <td><a href="/p/${escapeHtml(p.slug)}" target="_blank">View</a></td>
      </tr>`;
      })
      .join('')}
  </tbody>
</table>`);
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function createProduct(request, env) {
  const form = await request.formData();
  const title = String(form.get('title') || '').trim();
  const categoryId = Number(form.get('category_id'));
  if (!title || !Number.isInteger(categoryId)) return redirect('/admin/products');

  const num = (k) => {
    const v = String(form.get(k) || '').replace(/[^\d]/g, '');
    return v ? Number(v) : null;
  };

  let slug = slugify(title);
  const existing = await env.DB.prepare('SELECT id FROM products WHERE slug = ?').bind(slug).first();
  if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const video = String(form.get('video') || '').trim();

  const result = await env.DB.prepare(
    `INSERT INTO products (slug, title, category_id, sku, description, condition_notes, retail_price, size_type, video_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      slug,
      title,
      categoryId,
      String(form.get('sku') || '').trim() || null,
      String(form.get('description') || '').trim() || null,
      String(form.get('condition') || '').trim() || null,
      num('retail'),
      String(form.get('size_type') || 'none'),
      video && /^https:\/\//i.test(video) ? video : null
    )
    .run();

  const image = String(form.get('image') || '').trim();
  if (image && /^https:\/\//i.test(image)) {
    await env.DB.prepare('INSERT INTO product_images (product_id, url, alt) VALUES (?, ?, ?)')
      .bind(result.meta.last_row_id, image, title)
      .run();
  }

  return redirect('/admin/products');
}

// The "sourced in-house" system seller. Created on first use rather than in seed data, so
// it exists whether or not seed.sql ever ran against this database.
async function ensureHouseSeller(env) {
  const existing = await env.DB.prepare("SELECT id FROM sellers WHERE name = 'Rarehaus (in-house)'").first();
  if (existing) return existing.id;
  const result = await env.DB.prepare(
    `INSERT INTO sellers (name, city, country, kyc_verified, legit_check)
     VALUES ('Rarehaus (in-house)', 'Guwahati', 'India', 1, 1)`
  ).run();
  return result.meta.last_row_id;
}

async function createOffer(request, env) {
  const form = await request.formData();
  const raw = (k) => String(form.get(k) || '').replace(/[^\d]/g, '');

  const productId = Number(form.get('product_id'));
  const inhouse = form.get('inhouse') === '1';
  const sellerId = inhouse ? await ensureHouseSeller(env) : Number(form.get('seller_id'));
  if (!Number.isInteger(productId) || !Number.isInteger(sellerId)) return redirect('/admin/products');

  const sellerPrice = Number(raw('seller_price')) || 0;
  if (sellerPrice <= 0) {
    return redirect('/admin/products?error=' + encodeURIComponent('Enter a seller price.'));
  }

  const product = await env.DB.prepare(
    'SELECT p.id, p.category_id, c.slug AS category_slug FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?'
  )
    .bind(productId)
    .first();
  if (!product) return redirect('/admin/products');

  const city = String(form.get('ships_from') || '').trim();

  // Duty, fees, shipping and lead time all come from the rate rules. Only values the
  // operator actually typed are treated as overrides.
  const priced = await computeOfferPricing(env.DB, {
    categoryId: product.category_id,
    city,
    sellerPrice,
    overrides: {
      duty: raw('duty'),
      auth_fee: raw('auth_fee'),
      shipping: raw('shipping'),
      lead_days_min: raw('lead_min'),
      lead_days_max: raw('lead_max'),
    },
  });

  const stockCode = await nextStockCode(env.DB, product.category_slug);

  await env.DB.prepare(
    `INSERT INTO offers (stock_code, product_id, seller_id, sourced_by, size_label, condition, ships_from,
                         seller_price, duty, auth_fee, shipping, landed_price, lead_days_min, lead_days_max)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      stockCode,
      productId,
      sellerId,
      inhouse ? 'inhouse' : 'seller',
      String(form.get('size_label') || 'One size').trim() || 'One size',
      String(form.get('condition') || 'Deadstock').trim(),
      city,
      priced.seller_price,
      priced.duty,
      priced.auth_fee,
      priced.shipping,
      priced.landed_price,
      priced.lead_days_min,
      priced.lead_days_max
    )
    .run();

  const warn = !priced.rate_found
    ? '?error=' + encodeURIComponent('Offer added, but no duty rate is set for that category — duty was charged at 0. Set it under Rates.')
    : !priced.city_found
    ? '?error=' + encodeURIComponent(`Offer added, but "${city}" is not in your source cities — shipping was charged at 0. Add it under Rates.`)
    : '';

  return redirect('/admin/products' + warn);
}

// Rates -----------------------------------------------------------------------

async function ratesPage(env, message) {
  const [rates, cities] = await Promise.all([listCategoryRates(env.DB), listSourceCities(env.DB)]);

  return adminHtml(`
<h2 class="serif" style="font-size:32px; margin:0 0 8px;">Rates</h2>
<p class="muted" style="margin:0 0 20px; font-size:13.5px; max-width:760px;">
  These turn a seller price into a landed price automatically. Change a rate here and every
  new offer uses it — existing offers keep the numbers they were created with, so a rate
  change never silently reprices something a customer is already looking at.
</p>

<div class="notice notice-bad" style="margin-bottom:24px; max-width:760px;">
  <strong>Duty rates decide whether you make money.</strong> The values below are placeholders,
  not researched Indian customs rates. Get the real rate for each category from a customs broker
  and put it in here before you list anything. If duty is set too low, every order loses money
  quietly — the sale still completes, the shortfall just comes out of your margin.
</div>

${message ? `<div class="notice notice-good" style="margin-bottom:20px;">${escapeHtml(message)}</div>` : ''}

<div class="grid grid-2" style="gap:28px; align-items:start;">
  <div>
    <h3 class="serif" style="font-size:22px; margin:0 0 12px;">Duty and authentication by category</h3>
    <form method="post" action="/admin/rates/categories">
      <table class="table">
        <thead><tr><th>Category</th><th class="num">Duty %</th><th class="num">Authentication ₹</th></tr></thead>
        <tbody>
          ${rates
            .map(
              (r) => `<tr>
            <td data-label="Category">${escapeHtml(r.name)}</td>
            <td data-label="Duty %" class="num">
              <label class="visually-hidden" for="duty-${r.id}">Duty percent for ${escapeHtml(r.name)}</label>
              <input id="duty-${r.id}" name="duty_${r.id}" value="${r.duty_pct}" inputmode="decimal" maxlength="6" style="width:80px; text-align:right; padding:8px; border:1px solid var(--line);">
            </td>
            <td data-label="Authentication" class="num">
              <label class="visually-hidden" for="auth-${r.id}">Authentication fee for ${escapeHtml(r.name)}</label>
              <input id="auth-${r.id}" name="auth_${r.id}" value="${r.auth_fee}" inputmode="numeric" maxlength="8" style="width:100px; text-align:right; padding:8px; border:1px solid var(--line);">
            </td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
      <button class="btn" type="submit" style="margin-top:14px;">Save category rates</button>
    </form>
  </div>

  <div>
    <h3 class="serif" style="font-size:22px; margin:0 0 12px;">Shipping and lead time by city</h3>
    <table class="table">
      <thead><tr><th>City</th><th class="num">Shipping ₹</th><th class="num">Lead days</th></tr></thead>
      <tbody>
        ${
          cities.length
            ? cities
                .map(
                  (c) => `<tr>
              <td data-label="City">${escapeHtml(c.city)}${c.country ? `<div style="font-size:11.5px; color:var(--faint);">${escapeHtml(c.country)}</div>` : ''}</td>
              <td data-label="Shipping" class="num">${formatINR(c.shipping_cost)}</td>
              <td data-label="Lead days" class="num">${c.lead_days_min}–${c.lead_days_max}</td>
            </tr>`
                )
                .join('')
            : '<tr><td colspan="3">No source cities yet.</td></tr>'
        }
      </tbody>
    </table>

    <div class="panel" style="padding:20px; margin-top:16px;">
      <h4 class="serif" style="font-size:18px; margin:0 0 12px; font-weight:400;">Add or update a city</h4>
      <form method="post" action="/admin/rates/cities">
        <div class="form-row">
          <div class="field"><label for="city">City</label><input id="city" name="city" required maxlength="60"></div>
          <div class="field"><label for="country">Country</label><input id="country" name="country" maxlength="60"></div>
        </div>
        <div class="form-row">
          <div class="field"><label for="ship">Shipping cost (₹)</label><input id="ship" name="shipping_cost" inputmode="numeric" maxlength="8" required></div>
          <div class="field"><label for="lmin">Lead days min</label><input id="lmin" name="lead_days_min" inputmode="numeric" maxlength="3" value="14"></div>
        </div>
        <div class="field" style="max-width:180px;"><label for="lmax">Lead days max</label><input id="lmax" name="lead_days_max" inputmode="numeric" maxlength="3" value="28"></div>
        <button class="btn btn-block" type="submit">Save city</button>
      </form>
    </div>
  </div>
</div>`);
}

async function saveCategoryRates(request, env) {
  const form = await request.formData();
  const categories = await db.getCategories(env.DB);

  const writes = [];
  for (const c of categories) {
    const duty = Number(String(form.get(`duty_${c.id}`) || '').replace(/[^\d.]/g, ''));
    const auth = Number(String(form.get(`auth_${c.id}`) || '').replace(/[^\d]/g, ''));
    writes.push(
      env.DB.prepare(
        `INSERT INTO category_rates (category_id, duty_pct, auth_fee, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(category_id) DO UPDATE SET
           duty_pct = excluded.duty_pct, auth_fee = excluded.auth_fee, updated_at = datetime('now')`
      ).bind(c.id, Number.isFinite(duty) ? duty : 0, Number.isFinite(auth) ? auth : 0)
    );
  }
  await env.DB.batch(writes);

  return redirect('/admin/rates?saved=' + encodeURIComponent('Category rates saved.'));
}

async function saveCity(request, env) {
  const form = await request.formData();
  const city = String(form.get('city') || '').trim().slice(0, 60);
  if (!city) return redirect('/admin/rates');

  const num = (k, fallback) => {
    const n = Number(String(form.get(k) || '').replace(/[^\d]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  await env.DB.prepare(
    `INSERT INTO source_cities (city, country, shipping_cost, lead_days_min, lead_days_max, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(city) DO UPDATE SET
       country = excluded.country, shipping_cost = excluded.shipping_cost,
       lead_days_min = excluded.lead_days_min, lead_days_max = excluded.lead_days_max,
       updated_at = datetime('now')`
  )
    .bind(
      city,
      String(form.get('country') || '').trim().slice(0, 60) || null,
      num('shipping_cost', 0),
      num('lead_days_min', 14),
      num('lead_days_max', 28)
    )
    .run();

  return redirect('/admin/rates?saved=' + encodeURIComponent(`Saved ${city}.`));
}

async function uploadImage(request, env) {
  const form = await request.formData();
  const productId = Number(form.get('product_id'));
  if (!Number.isInteger(productId)) return redirect('/admin/products');

  const result = await storeImage(env, form.get('file'));
  if (!result.ok) {
    return redirect(`/admin/products?error=${encodeURIComponent(result.error)}`);
  }

  const product = await env.DB.prepare('SELECT title FROM products WHERE id = ?')
    .bind(productId)
    .first();
  const next = await env.DB.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM product_images WHERE product_id = ?'
  )
    .bind(productId)
    .first();

  await env.DB.prepare(
    'INSERT INTO product_images (product_id, url, alt, sort_order) VALUES (?, ?, ?, ?)'
  )
    .bind(productId, `/img/${result.key}`, product?.title || null, next?.n || 0)
    .run();

  return redirect('/admin/products');
}

async function removeImage(request, env) {
  const form = await request.formData();
  const imageId = Number(form.get('image_id'));
  if (!Number.isInteger(imageId)) return redirect('/admin/products');

  const row = await env.DB.prepare('SELECT url FROM product_images WHERE id = ?').bind(imageId).first();
  if (row) {
    await env.DB.prepare('DELETE FROM product_images WHERE id = ?').bind(imageId).run();
    await deleteImage(env, row.url);
  }
  return redirect('/admin/products');
}

// Swaps this image's sort_order with its neighbour in the same direction -- the whole
// reorder operation, one step at a time, matching the up/down buttons in the admin table.
async function reorderImage(request, env) {
  const form = await request.formData();
  const imageId = Number(form.get('image_id'));
  const direction = form.get('direction') === 'up' ? 'up' : 'down';
  if (!Number.isInteger(imageId)) return redirect('/admin/products');

  const current = await env.DB.prepare('SELECT id, product_id, sort_order FROM product_images WHERE id = ?')
    .bind(imageId)
    .first();
  if (!current) return redirect('/admin/products');

  const neighbor = await env.DB.prepare(
    `SELECT id, sort_order FROM product_images WHERE product_id = ? AND sort_order ${direction === 'up' ? '<' : '>'} ?
     ORDER BY sort_order ${direction === 'up' ? 'DESC' : 'ASC'} LIMIT 1`
  )
    .bind(current.product_id, current.sort_order)
    .first();

  if (neighbor) {
    await env.DB.batch([
      env.DB.prepare('UPDATE product_images SET sort_order = ? WHERE id = ?').bind(neighbor.sort_order, current.id),
      env.DB.prepare('UPDATE product_images SET sort_order = ? WHERE id = ?').bind(current.sort_order, neighbor.id),
    ]);
  }
  return redirect('/admin/products');
}

async function uploadVideo(request, env) {
  const form = await request.formData();
  const productId = Number(form.get('product_id'));
  if (!Number.isInteger(productId)) return redirect('/admin/products');

  const result = await storeVideo(env, form.get('file'));
  if (!result.ok) {
    return redirect(`/admin/products?error=${encodeURIComponent(result.error)}`);
  }

  await env.DB.prepare('UPDATE products SET video_url = ? WHERE id = ?')
    .bind(`/img/${result.key}`, productId)
    .run();

  return redirect('/admin/products');
}

async function removeVideo(request, env) {
  const form = await request.formData();
  const productId = Number(form.get('product_id'));
  if (!Number.isInteger(productId)) return redirect('/admin/products');

  const product = await env.DB.prepare('SELECT video_url FROM products WHERE id = ?').bind(productId).first();
  if (product?.video_url) {
    await env.DB.prepare('UPDATE products SET video_url = NULL WHERE id = ?').bind(productId).run();
    // Only delete the R2 object if we hosted it ourselves (a YouTube/Vimeo/external URL is
    // never stored in R2, so deleteImage's key pattern check already no-ops on those safely).
    await deleteImage(env, product.video_url);
  }
  return redirect('/admin/products');
}

async function sellerApplicationsPage(env) {
  const { results: apps } = await env.DB.prepare(
    'SELECT * FROM seller_applications ORDER BY created_at DESC LIMIT 100'
  ).all();

  if (!(apps || []).length) {
    return adminHtml(`
<h2 class="serif" style="font-size:32px; margin:0 0 8px;">Seller applications</h2>
<p class="muted" style="margin:0 0 22px; font-size:13.5px;">Applications from <a href="/sell" target="_blank">/sell</a> land here.</p>
<div class="notice">No applications yet.</div>`);
  }

  return adminHtml(`
<h2 class="serif" style="font-size:32px; margin:0 0 8px;">Seller applications</h2>
<p class="muted" style="margin:0 0 22px; font-size:13.5px;">
  Approving an application creates a seller you can attach offers to. It does not verify anyone —
  collect and check their KYC documents yourself first.
</p>
<table class="table">
  <thead><tr><th>Business</th><th>Contact</th><th>Sells</th><th>Volume</th><th>Status</th><th></th></tr></thead>
  <tbody>
    ${apps
      .map(
        (a) => `<tr>
      <td data-label="Business">
        <strong>${escapeHtml(a.business_name)}</strong>
        <div style="font-size:11.5px; color:var(--faint);">${escapeHtml(a.city)}, ${escapeHtml(a.country)}${
          a.website ? ` · ${escapeHtml(a.website)}` : ''
        }</div>
      </td>
      <td data-label="Contact">
        ${escapeHtml(a.contact_name)}
        <div style="font-size:11.5px; color:var(--faint);">${escapeHtml(a.email)}${
          a.phone ? `<br>${escapeHtml(a.phone)}` : ''
        }</div>
      </td>
      <td data-label="Sells">${escapeHtml(a.categories || '—')}
        ${a.authentication ? `<div style="font-size:11.5px; color:var(--faint);">Auth: ${escapeHtml(a.authentication)}</div>` : ''}
      </td>
      <td data-label="Volume">${escapeHtml(a.volume || '—')}</td>
      <td data-label="Status">${escapeHtml(a.status)}</td>
      <td>
        ${
          a.status === 'new' || a.status === 'reviewing'
            ? `<div style="display:flex; gap:6px;">
                 <form method="post" action="/admin/sellers/decide">
                   <input type="hidden" name="id" value="${a.id}">
                   <input type="hidden" name="decision" value="approved">
                   <button class="chip" type="submit" style="cursor:pointer;">Approve</button>
                 </form>
                 <form method="post" action="/admin/sellers/decide">
                   <input type="hidden" name="id" value="${a.id}">
                   <input type="hidden" name="decision" value="declined">
                   <button class="chip" type="submit" style="cursor:pointer;">Decline</button>
                 </form>
               </div>`
            : '<span class="faint">—</span>'
        }
      </td>
    </tr>`
      )
      .join('')}
  </tbody>
</table>`);
}

async function decideApplication(request, env) {
  const form = await request.formData();
  const id = Number(form.get('id'));
  const decision = String(form.get('decision') || '');
  if (!Number.isInteger(id) || !['approved', 'declined'].includes(decision)) {
    return redirect('/admin/sellers');
  }

  const app = await env.DB.prepare('SELECT * FROM seller_applications WHERE id = ?').bind(id).first();
  if (!app) return redirect('/admin/sellers');

  await env.DB.prepare('UPDATE seller_applications SET status = ? WHERE id = ?')
    .bind(decision, id)
    .run();

  // Approving creates the seller record so offers can be attached straight away. They start
  // unverified: KYC is a document check you do off the site, then tick here.
  if (decision === 'approved') {
    const existing = await env.DB.prepare('SELECT id FROM sellers WHERE name = ?')
      .bind(app.business_name)
      .first();
    if (!existing) {
      await env.DB.prepare(
        'INSERT INTO sellers (name, city, country, kyc_verified, legit_check) VALUES (?, ?, ?, 0, 0)'
      )
        .bind(app.business_name, app.city, app.country)
        .run();
    }
  }

  return redirect('/admin/sellers');
}

async function sourcingPage(env) {
  const requests = await db.listSourcingRequests(env.DB, 100);
  return adminHtml(`
<h2 class="serif" style="font-size:32px; margin:0 0 22px;">Sourcing requests</h2>
${
  requests.length
    ? `<table class="table">
      <thead><tr><th>Item</th><th>Size</th><th>Budget</th><th>Contact</th><th>Status</th><th>When</th></tr></thead>
      <tbody>${requests
        .map(
          (r) => `<tr>
          <td data-label="Item">${escapeHtml(r.item)}${
            r.notes ? `<div style="font-size:11.5px; color:var(--faint)">${escapeHtml(r.notes)}</div>` : ''
          }</td>
          <td data-label="Size">${escapeHtml(r.size_label || '—')}</td>
          <td data-label="Budget">${r.budget_max ? formatINR(r.budget_max) : '—'}</td>
          <td data-label="Contact">${escapeHtml(r.contact)}</td>
          <td data-label="Status">${escapeHtml(r.status)}</td>
          <td data-label="When">${escapeHtml(String(r.created_at).slice(0, 10))}</td>
        </tr>`
        )
        .join('')}</tbody></table>`
    : '<div class="notice">No requests yet.</div>'
}`);
}
