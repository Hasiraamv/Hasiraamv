import { escapeHtml, formatINR, html, redirect } from './render.js';
import * as db from './db.js';
import { issueCertificate } from './certificates.js';
import { storeImage, deleteImage } from './images.js';
import {
  parseCookies,
  cookieHeader,
  clearCookie,
  createAdminToken,
  verifyAdminToken,
  checkPassword,
} from './session.js';

const ADMIN_COOKIE = 'mm_admin';

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
  if (path === '/admin/orders') return ordersPage(env);
  if (path === '/admin/orders/advance' && method === 'POST') return advanceOrder(request, env);
  if (path === '/admin/certificates') return certificatesPage(env);
  if (path === '/admin/certificates/issue' && method === 'POST') return issueCert(request, env);
  if (path === '/admin/certificates/revoke' && method === 'POST') return revokeCert(request, env);
  if (path === '/admin/products')
    return productsPage(env, new URL(request.url).searchParams.get('error'));
  if (path === '/admin/products/create' && method === 'POST') return createProduct(request, env);
  if (path === '/admin/offers/create' && method === 'POST') return createOffer(request, env);
  if (path === '/admin/images/upload' && method === 'POST') return uploadImage(request, env);
  if (path === '/admin/images/delete' && method === 'POST') return removeImage(request, env);
  if (path === '/admin/sourcing') return sourcingPage(env);

  return adminHtml('<div class="notice">Unknown admin page.</div>', 404);
}

// Shell ----------------------------------------------------------------------

function adminHtml(body, status = 200, extraHeaders = {}) {
  return html(
    `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin · Mintmark</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Work+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/styles.css">
</head><body>
<div class="announce"><span class="tag">Mintmark admin</span></div>
<div class="nav">
  <a class="logo" href="/admin">MINTMARK <span style="font-size:13px; letter-spacing:0; color:var(--faint)">admin</span></a>
  <nav class="nav-links">
    <a href="/admin/orders">Orders</a>
    <a href="/admin/certificates">Certificates</a>
    <a href="/admin/products">Products &amp; offers</a>
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
        <td data-label="Amount" class="num">${formatINR(o.amount)}</td>
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

async function ordersPage(env) {
  const orders = await db.listOrders(env.DB, 100);
  return adminHtml(`
<h2 class="serif" style="font-size:32px; margin:0 0 8px;">Orders</h2>
<p class="muted" style="margin:0 0 22px; font-size:13.5px;">Advancing an order adds a stage to the buyer's tracking timeline immediately.</p>
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
  if (status === 'delivered') {
    await env.DB.prepare("UPDATE offers SET status = 'sold' WHERE id = (SELECT offer_id FROM orders WHERE id = ?)")
      .bind(orderId)
      .run();
  }
  return redirect('/admin/orders');
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

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  if (!order || order.certificate_no) return redirect('/admin/certificates');

  const offer = await db.getOfferById(env.DB, order.offer_id);
  const product = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(order.product_id).first();
  const category = await env.DB.prepare('SELECT slug FROM categories WHERE id = ?')
    .bind(product.category_id)
    .first();
  const seller = await env.DB.prepare('SELECT * FROM sellers WHERE id = ?').bind(offer.seller_id).first();

  const authenticatorId = Number(form.get('authenticator_id')) || null;
  const issued = await issueCertificate(env.DB, {
    order,
    product,
    offer,
    seller,
    categorySlug: category?.slug,
    authenticatorId,
    sellerReportRef: String(form.get('report') || '').trim() || null,
    notes: String(form.get('notes') || '').trim() || null,
  });

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

async function productsPage(env, errorMessage) {
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
         create a bucket called <code>mintmark-images</code>, then uncomment the
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
      <div class="field"><label for="image">Image URL (optional)</label><input id="image" name="image" maxlength="400" placeholder="https://..."></div>
      <button class="btn btn-block" type="submit">Add product</button>
    </form>
  </div>

  <div class="panel" style="padding:22px;">
    <h3 class="serif" style="font-size:20px; margin:0 0 14px;">Add a seller offer</h3>
    <p class="muted" style="font-size:12.5px; margin:0 0 14px;">The landed price is the sum of the four parts — that is what the buyer pays and what the breakdown shows.</p>
    <form method="post" action="/admin/offers/create">
      <div class="field"><label for="product_id">Product</label>
        <select id="product_id" name="product_id" required>
          ${(products || []).map((p) => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="field"><label for="seller_id">Seller</label>
          <select id="seller_id" name="seller_id" required>
            ${sellers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)} — ${escapeHtml(s.city)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label for="size_label">Size</label><input id="size_label" name="size_label" value="One size" maxlength="40"></div>
      </div>
      <div class="form-row">
        <div class="field"><label for="ships_from">Ships from</label><input id="ships_from" name="ships_from" required maxlength="60" placeholder="Tokyo"></div>
        <div class="field"><label for="condition_o">Condition</label><input id="condition_o" name="condition" value="Deadstock" maxlength="60"></div>
      </div>
      <div class="form-row">
        <div class="field"><label for="seller_price">Seller price (₹)</label><input id="seller_price" name="seller_price" required inputmode="numeric" maxlength="12"></div>
        <div class="field"><label for="duty">Duty (₹)</label><input id="duty" name="duty" inputmode="numeric" maxlength="12" value="0"></div>
      </div>
      <div class="form-row">
        <div class="field"><label for="auth_fee">Authentication (₹)</label><input id="auth_fee" name="auth_fee" inputmode="numeric" maxlength="12" value="0"></div>
        <div class="field"><label for="shipping">Shipping (₹)</label><input id="shipping" name="shipping" inputmode="numeric" maxlength="12" value="0"></div>
      </div>
      <div class="form-row">
        <div class="field"><label for="lead_min">Lead days min</label><input id="lead_min" name="lead_min" inputmode="numeric" value="14" maxlength="3"></div>
        <div class="field"><label for="lead_max">Lead days max</label><input id="lead_max" name="lead_max" inputmode="numeric" value="28" maxlength="3"></div>
      </div>
      <button class="btn btn-block" type="submit">Add offer</button>
    </form>
  </div>
</div>

<h3 class="serif" style="font-size:24px; margin:0 0 14px;">Catalogue</h3>
<table class="table">
  <thead><tr><th>Product</th><th>Photos</th><th class="num">Offers</th><th class="num">Lowest</th><th></th></tr></thead>
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
                (im) => `<span style="position:relative; display:inline-block;">
                  <img src="${escapeHtml(im.url)}" alt="" style="width:44px; height:44px; object-fit:cover; border:1px solid var(--line);">
                  <form method="post" action="/admin/images/delete" style="display:inline;">
                    <input type="hidden" name="image_id" value="${im.id}">
                    <button type="submit" title="Delete photo" style="position:absolute; top:-6px; right:-6px; width:18px; height:18px; line-height:1; border:1px solid var(--line); background:var(--card); cursor:pointer; font-size:11px; padding:0;">×</button>
                  </form>
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
        <td data-label="Offers" class="num">${p.offer_count}</td>
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

  const result = await env.DB.prepare(
    `INSERT INTO products (slug, title, category_id, sku, description, condition_notes, retail_price, size_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      slug,
      title,
      categoryId,
      String(form.get('sku') || '').trim() || null,
      String(form.get('description') || '').trim() || null,
      String(form.get('condition') || '').trim() || null,
      num('retail'),
      String(form.get('size_type') || 'none')
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

async function createOffer(request, env) {
  const form = await request.formData();
  const num = (k) => Number(String(form.get(k) || '').replace(/[^\d]/g, '')) || 0;

  const productId = Number(form.get('product_id'));
  const sellerId = Number(form.get('seller_id'));
  if (!Number.isInteger(productId) || !Number.isInteger(sellerId)) return redirect('/admin/products');

  const sellerPrice = num('seller_price');
  const duty = num('duty');
  const authFee = num('auth_fee');
  const shipping = num('shipping');
  if (sellerPrice <= 0) return redirect('/admin/products');
  const landed = sellerPrice + duty + authFee + shipping;

  await env.DB.prepare(
    `INSERT INTO offers (product_id, seller_id, size_label, condition, ships_from,
                         seller_price, duty, auth_fee, shipping, landed_price, lead_days_min, lead_days_max)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      productId,
      sellerId,
      String(form.get('size_label') || 'One size').trim() || 'One size',
      String(form.get('condition') || 'Deadstock').trim(),
      String(form.get('ships_from') || '').trim(),
      sellerPrice,
      duty,
      authFee,
      shipping,
      landed,
      num('lead_min') || 14,
      num('lead_max') || 28
    )
    .run();

  return redirect('/admin/products');
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
