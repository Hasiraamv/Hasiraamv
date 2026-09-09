import { escapeHtml, formatINR, formatINRWords, html, redirect, sealMark } from './render.js';
import * as db from './db.js';
import { issueCertificate } from './certificates.js';
import { storeImage, deleteImage, storeVideo, normalizeImageUrl, imageStore } from './images.js';
import { SHOE_SIZE_LABELS } from './sizing.js';
import { riskLabel } from './risk.js';
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
  hashPassword,
  verifyPassword,
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

// Employee roles. Kept to four, matched to a small team doing real jobs rather than the full
// permission matrix a company with a dedicated security team would build -- see ROUTE_RULES
// below for exactly what each one can reach. "owner" is the only role that can manage other
// admin accounts, touch pricing/rates, or edit the catalogue.
const ROLES = ['owner', 'authenticator', 'warehouse', 'support'];
const ROLE_LABELS = {
  owner: 'Owner',
  authenticator: 'Authenticator',
  warehouse: 'Warehouse',
  support: 'Support',
};

// Coarse, route-group permissions. An unmatched path defaults to owner-only rather than open
// access, so a new route added later is safe by default until someone deliberately widens it.
const ROUTE_RULES = [
  { test: (p) => p === '/admin', roles: ROLES },
  { test: (p) => p === '/admin/account/password', roles: ROLES },
  { test: (p) => p === '/admin/orders', roles: ['owner', 'authenticator', 'warehouse', 'support'] },
  { test: (p) => p === '/admin/orders/advance', roles: ['owner', 'authenticator', 'warehouse'] },
  { test: (p) => p.startsWith('/admin/certificates'), roles: ['owner', 'authenticator'] },
  { test: (p) => p.startsWith('/admin/authentication'), roles: ['owner', 'authenticator'] },
  { test: (p) => p === '/admin/listings' || p === '/admin/offers/status', roles: ['owner', 'authenticator', 'warehouse'] },
  {
    test: (p) =>
      p.startsWith('/admin/products') ||
      p.startsWith('/admin/offers') ||
      p.startsWith('/admin/images') ||
      p.startsWith('/admin/rates'),
    roles: ['owner'],
  },
  { test: (p) => p.startsWith('/admin/sellers') || p === '/admin/sourcing', roles: ['owner', 'support'] },
  { test: (p) => p.startsWith('/admin/users'), roles: ['owner'] },
  { test: (p) => p === '/admin/audit', roles: ['owner'] },
];

// Writes one audit_log row. Never throws into the caller -- a logging failure must not be
// the reason a real action (a price change, a refund, disabling an account) gets rolled back
// or reported as failed to the person doing it. `request` is optional; when given, the
// client's IP is recorded (Cloudflare sets cf-connecting-ip on every request it proxies).
async function logAudit(env, currentUser, action, { entityType, entityId, detail, request } = {}) {
  try {
    const ip = request ? request.headers.get('cf-connecting-ip') : null;
    await env.DB.prepare(
      `INSERT INTO audit_log (admin_user_id, admin_name, admin_email, action, entity_type, entity_id, detail, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        currentUser?.id ?? null,
        currentUser?.name ?? 'system',
        currentUser?.email ?? '',
        action,
        entityType ?? null,
        entityId != null ? String(entityId) : null,
        detail ?? null,
        ip
      )
      .run();
  } catch (err) {
    console.error('audit log write failed', err);
  }
}

function roleCanAccess(path, role) {
  const rule = ROUTE_RULES.find((r) => r.test(path));
  return rule ? rule.roles.includes(role) : role === 'owner';
}

export async function adminRouter(request, env, path) {
  const method = request.method.toUpperCase();

  if (!env.SESSION_SECRET) {
    return adminHtml(
      `<div class="notice notice-bad">
         Admin is disabled because its secret is not set. Run
         <code>wrangler secret put SESSION_SECRET</code>, then redeploy.
       </div>`,
      503
    );
  }

  if (path === '/admin/login') {
    if (method === 'POST') {
      const form = await request.formData();
      const email = String(form.get('email') || '').trim().toLowerCase();
      const password = String(form.get('password') || '');
      const user = email
        ? await env.DB.prepare('SELECT * FROM admin_users WHERE email = ? COLLATE NOCASE').bind(email).first()
        : null;
      const ok = !!user && user.status === 'active' && (await verifyPassword(password, user.password_hash));
      if (ok) {
        const token = await createAdminToken(env.SESSION_SECRET, user.id);
        await env.DB.prepare("UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?")
          .bind(user.id)
          .run();
        return redirect('/admin', {
          'set-cookie': cookieHeader(ADMIN_COOKIE, token, { maxAge: 60 * 60 * 8 }),
        });
      }
      return adminHtml(loginForm('That email or password is not right.'), 401);
    }
    const anyUsers = await env.DB.prepare('SELECT id FROM admin_users LIMIT 1').first();
    return adminHtml(loginForm(null, !anyUsers));
  }

  if (path === '/admin/logout') {
    return redirect('/admin/login', { 'set-cookie': clearCookie(ADMIN_COOKIE) });
  }

  const token = parseCookies(request)[ADMIN_COOKIE];
  const userId = await verifyAdminToken(env.SESSION_SECRET, token);
  if (!userId) return redirect('/admin/login');

  // Re-read the account on every request rather than trusting anything cached in the token,
  // so disabling someone or changing their role takes effect on their very next click instead
  // of waiting out an up-to-8-hour-old session.
  const currentUser = await env.DB.prepare('SELECT * FROM admin_users WHERE id = ?').bind(userId).first();
  if (!currentUser || currentUser.status !== 'active') {
    return redirect('/admin/login', { 'set-cookie': clearCookie(ADMIN_COOKIE) });
  }

  if (!roleCanAccess(path, currentUser.role)) {
    return adminHtml(
      `<div class="notice notice-bad">Your role (${escapeHtml(ROLE_LABELS[currentUser.role] || currentUser.role)}) does not have access to this page.</div>`,
      403
    );
  }

  if (path === '/admin/account/password') {
    if (method === 'POST') return changeOwnPassword(request, env, currentUser);
    return adminHtml(changePasswordForm());
  }
  if (path === '/admin/users') return adminUsersPage(env, currentUser, new URL(request.url).searchParams.get('error'));
  if (path === '/admin/users/create' && method === 'POST') return createAdminUser(request, env, currentUser);
  {
    const m = path.match(/^\/admin\/users\/(\d+)\/status$/);
    if (m && method === 'POST') return setAdminUserStatus(request, env, Number(m[1]), currentUser);
  }
  {
    const m = path.match(/^\/admin\/users\/(\d+)\/reset-password$/);
    if (m && method === 'POST') return resetAdminUserPassword(request, env, Number(m[1]), currentUser);
  }

  if (path === '/admin') return dashboard(env, currentUser);
  if (path === '/admin/orders')
    return ordersPage(env, new URL(request.url).searchParams.get('issued'), new URL(request.url).searchParams.get('error'), currentUser);
  if (path === '/admin/orders/advance' && method === 'POST') return advanceOrder(request, env, currentUser);
  {
    const m = path.match(/^\/admin\/orders\/(\d+)\/clear-risk$/);
    if (m && method === 'POST') return clearOrderRisk(request, env, Number(m[1]), currentUser);
  }
  if (path === '/admin/certificates') return certificatesPage(env);
  if (path === '/admin/certificates/issue' && method === 'POST') return issueCert(request, env, currentUser);
  if (path === '/admin/certificates/revoke' && method === 'POST') return revokeCert(request, env, currentUser);
  if (path === '/admin/authentication')
    return authenticationPage(env, currentUser, new URL(request.url).searchParams.get('error'));
  {
    const m = path.match(/^\/admin\/authentication\/(\d+)\/assign$/);
    if (m && method === 'POST') return assignAuthCase(request, env, Number(m[1]), currentUser);
  }
  {
    const m = path.match(/^\/admin\/authentication\/(\d+)\/decide$/);
    if (m && method === 'POST') return decideAuthCase(request, env, Number(m[1]), currentUser);
  }
  if (path === '/admin/products') {
    const qs = new URL(request.url).searchParams;
    const forOffer = Number(qs.get('offer_for'));
    return productsPage(env, qs.get('error'), Number.isInteger(forOffer) ? forOffer : null);
  }
  if (path === '/admin/listings')
    return listingsPage(env, new URL(request.url).searchParams.get('error'));
  if (path === '/admin/products/create' && method === 'POST') return createProduct(request, env, currentUser);
  if (path === '/admin/offers/create' && method === 'POST') return createOffer(request, env, currentUser);
  if (path === '/admin/offers/status' && method === 'POST') return setOfferStatus(request, env, currentUser);

  {
    const m = path.match(/^\/admin\/products\/(\d+)\/edit$/);
    if (m) return editProductPage(env, Number(m[1]));
  }
  {
    const m = path.match(/^\/admin\/products\/(\d+)\/update$/);
    if (m && method === 'POST') return updateProduct(request, env, Number(m[1]), currentUser);
  }
  {
    const m = path.match(/^\/admin\/products\/(\d+)\/delete$/);
    if (m && method === 'POST') return deleteProduct(request, env, Number(m[1]), currentUser);
  }
  {
    const m = path.match(/^\/admin\/offers\/(\d+)\/edit$/);
    if (m) return editOfferPage(env, Number(m[1]));
  }
  {
    const m = path.match(/^\/admin\/offers\/(\d+)\/update$/);
    if (m && method === 'POST') return updateOffer(request, env, Number(m[1]), currentUser);
  }
  {
    const m = path.match(/^\/admin\/offers\/(\d+)\/delete$/);
    if (m && method === 'POST') return deleteOffer(request, env, Number(m[1]), currentUser);
  }
  if (path === '/admin/images/upload' && method === 'POST') return uploadImage(request, env);
  if (path === '/admin/images/delete' && method === 'POST') return removeImage(request, env);
  if (path === '/admin/images/reorder' && method === 'POST') return reorderImage(request, env);
  if (path === '/admin/products/video-upload' && method === 'POST') return uploadVideo(request, env);
  if (path === '/admin/products/video-remove' && method === 'POST') return removeVideo(request, env);
  if (path === '/admin/rates')
    return ratesPage(env, new URL(request.url).searchParams.get('saved'));
  if (path === '/admin/rates/categories' && method === 'POST') return saveCategoryRates(request, env, currentUser);
  if (path === '/admin/rates/cities' && method === 'POST') return saveCity(request, env, currentUser);
  if (path === '/admin/sourcing') return sourcingPage(env);
  if (path === '/admin/sellers') return sellerApplicationsPage(env);
  if (path === '/admin/sellers/decide' && method === 'POST') return decideApplication(request, env, currentUser);
  if (path === '/admin/audit') return auditLogPage(env, new URL(request.url).searchParams.get('entity'));

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
    <a href="/admin/authentication">Authentication</a>
    <a href="/admin/listings">Listings</a>
    <a href="/admin/products">Add &amp; edit</a>
    <a href="/admin/rates">Rates</a>
    <a href="/admin/sellers">Seller applications</a>
    <a href="/admin/sourcing">Sourcing requests</a>
    <a href="/admin/users">Employees</a>
    <a href="/admin/audit">Audit log</a>
  </nav>
  <div class="nav-right">
    <a href="/" target="_blank">View site</a>
    <a href="/admin/account/password">My account</a>
    <a href="/admin/logout">Sign out</a>
  </div>
</div>
<main class="section" style="padding-top:32px;">${body}</main>
</body></html>`,
    status,
    extraHeaders
  );
}

function loginForm(error, noAccountsYet = false) {
  return `
<div style="max-width:380px;">
  <h2 class="serif" style="font-size:30px; margin:0 0 16px;">Sign in</h2>
  ${
    noAccountsYet
      ? `<div class="notice notice-bad" style="margin-bottom:14px;">
           No employee accounts exist yet. Create the first one (an Owner) directly in the
           database, then sign in here with its email and password.
         </div>`
      : ''
  }
  ${error ? `<div class="notice notice-bad" style="margin-bottom:14px;">${escapeHtml(error)}</div>` : ''}
  <form method="post" action="/admin/login">
    <div class="field">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" required autofocus autocomplete="username">
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required autocomplete="current-password">
    </div>
    <button class="btn btn-block" type="submit">Sign in</button>
  </form>
</div>`;
}

// Pages ----------------------------------------------------------------------

async function dashboard(env, currentUser) {
  const [orders, requests, stats] = await Promise.all([
    db.listOrders(env.DB, 8),
    db.listSourcingRequests(env.DB, 5),
    db.getStats(env.DB),
  ]);
  const pendingCerts = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM orders WHERE certificate_no IS NULL AND status IN ('authenticating','authenticated','seller_shipped')`
  ).first();

  // Revenue is a financial figure, not an operational one -- shown to the owner only. Everyone
  // else who can reach the dashboard (authenticator, warehouse, support) sees the operational
  // tiles that matter for their own job.
  const flaggedCount = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM orders WHERE risk_flags IS NOT NULL AND risk_cleared_at IS NULL"
  ).first();

  const tiles = [
    ['Live listings', stats.listings],
    ['Orders', orders.length],
    ['Awaiting certificate', pendingCerts?.n || 0],
  ];
  if (flaggedCount?.n) tiles.push(['Awaiting fraud review', flaggedCount.n]);
  if (currentUser?.role === 'owner') {
    const revenue = await env.DB.prepare(
      `SELECT COALESCE(SUM(amount),0) AS total FROM orders WHERE payment_status = 'paid'`
    ).first();
    tiles.push(['Paid revenue', formatINR(revenue?.total || 0)]);
  }

  return adminHtml(`
<h2 class="serif" style="font-size:32px; margin:0 0 22px;">Today</h2>
<div class="grid grid-4" style="margin-bottom:32px;">
  ${tiles
    .map(
      ([k, v]) =>
        `<div class="panel" style="padding:20px;"><div class="tag muted">${k}</div><div class="serif" style="font-size:28px; margin-top:6px;">${v}</div></div>`
    )
    .join('')}
</div>

<h3 class="serif" style="font-size:24px; margin:0 0 14px;">Recent orders</h3>
${ordersTable(orders, currentUser)}

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

function ordersTable(orders, currentUser) {
  if (!orders.length) return '<div class="notice">No orders yet.</div>';
  return `
<table class="table">
  <thead><tr><th>Ref</th><th>Item</th><th>Buyer</th><th class="num">Amount</th><th>Status</th><th>Certificate</th><th>Advance</th></tr></thead>
  <tbody>
    ${orders
      .map((o) => {
        const idx = ORDER_STAGES.indexOf(o.status);
        const next = idx >= 0 && idx < ORDER_STAGES.length - 1 ? ORDER_STAGES[idx + 1] : null;
        const flagged = o.risk_flags && !o.risk_cleared_at;
        return `<tr${flagged ? ' style="background:#fbf1ee;"' : ''}>
        <td data-label="Ref"><a href="/order/${encodeURIComponent(o.public_ref)}" target="_blank">${escapeHtml(
          o.public_ref
        )}</a>
          ${
            flagged
              ? `<div style="margin-top:4px;">
                   <div style="font-size:10.5px; color:var(--oxblood); font-weight:700; line-height:1.5;">
                     ⚠ ${o.risk_flags.split(',').map((f) => escapeHtml(riskLabel(f))).join(', ')}
                   </div>
                   ${
                     currentUser?.role === 'owner'
                       ? `<form method="post" action="/admin/orders/${o.id}/clear-risk" style="display:inline;">
                            <button class="chip" type="submit" style="cursor:pointer; font-size:10px; padding:2px 7px;">Clear</button>
                          </form>`
                       : ''
                   }
                 </div>`
              : ''
          }
        </td>
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
          o.status === 'authentication_failed'
            ? '<span style="color:var(--oxblood); font-weight:600;">Failed authentication</span>'
            : next === 'authenticated'
            ? `<a class="chip" href="/admin/authentication">→ Authenticate</a>`
            : next
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

async function ordersPage(env, issuedNo, errorMessage, currentUser) {
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
  Advancing an order adds a stage to the buyer's tracking timeline immediately. Authentication
  itself happens on the <a href="/admin/authentication">Authentication</a> page, not here --
  passing it is what issues the certificate and moves the order on.
</p>
${errorMessage ? `<div class="notice notice-bad" style="margin-bottom:20px;">${escapeHtml(errorMessage)}</div>` : ''}
${banner}
${ordersTable(orders, currentUser)}`);
}

async function advanceOrder(request, env, currentUser) {
  const form = await request.formData();
  const orderId = Number(form.get('order_id'));
  const status = String(form.get('status') || '');
  if (!Number.isInteger(orderId) || !ORDER_STAGES.includes(status)) return redirect('/admin/orders');

  // Authentication is no longer a stage you can just click through -- it needs an actual
  // decision recorded on a case (see /admin/authentication), which is what is allowed to move
  // an order on to "authenticated" (and so issue its certificate). ordersTable no longer
  // offers this as a button, but the route itself refuses it too, since a POST can be crafted
  // by hand regardless of what the UI shows.
  if (status === 'authenticated') {
    return redirect('/admin/orders?error=' + encodeURIComponent('Authenticate this order from the Authentication page, not here.'));
  }

  const notes = {
    seller_shipped: 'Seller dispatched the piece to our authentication facility.',
    authenticating: 'Arrived at our facility. 30-point inspection under way.',
    in_transit: 'Duties paid. In transit and clearing customs.',
    out_for_delivery: 'With the local courier for delivery.',
    delivered: 'Delivered and signed for.',
  };

  await db.addOrderEvent(env.DB, orderId, status, notes[status] || null);
  await logAudit(env, currentUser, 'order.stage_advanced', {
    entityType: 'order',
    entityId: orderId,
    detail: `stage -> ${status}`,
    request,
  });

  // Arriving at the facility opens its authentication case, so there's always exactly one
  // case per order and it exists the moment there's actually something to inspect.
  if (status === 'authenticating') {
    await env.DB.prepare('INSERT OR IGNORE INTO authentication_cases (order_id) VALUES (?)').bind(orderId).run();
  }

  if (status === 'delivered') {
    await env.DB.prepare("UPDATE offers SET status = 'sold' WHERE id = (SELECT offer_id FROM orders WHERE id = ?)")
      .bind(orderId)
      .run();
  }
  return redirect('/admin/orders');
}

// Acknowledges a fraud-review flag without touching the order's real status -- the flag was
// never a block, just something for a human to have actually looked at before this order
// keeps moving. Owner only (see ROUTE_RULES's default), and it's on the audit log like
// everything else here.
async function clearOrderRisk(request, env, orderId, currentUser) {
  await env.DB.prepare("UPDATE orders SET risk_cleared_by = ?, risk_cleared_at = datetime('now') WHERE id = ?")
    .bind(currentUser.id, orderId)
    .run();
  await logAudit(env, currentUser, 'order.risk_cleared', { entityType: 'order', entityId: orderId, request });
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

  // Only orders whose authentication case has actually passed -- issuing a certificate is
  // what the case's "Pass" decision is for, this panel is a manual re-issue/override path,
  // not a way around the case system.
  const { results: awaiting } = await env.DB.prepare(
    `SELECT o.id, o.public_ref, o.size_label, p.title AS product_title
       FROM orders o
       JOIN products p ON p.id = o.product_id
       JOIN authentication_cases ac ON ac.order_id = o.id AND ac.status = 'passed'
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

async function issueCert(request, env, currentUser) {
  const form = await request.formData();
  const orderId = Number(form.get('order_id'));
  if (!Number.isInteger(orderId)) return redirect('/admin/certificates');

  const issued = await issueCertificateForOrder(env, orderId, {
    authenticatorId: Number(form.get('authenticator_id')) || null,
    sellerReportRef: String(form.get('report') || '').trim() || null,
    notes: String(form.get('notes') || '').trim() || null,
  });
  if (!issued) return redirect('/admin/certificates');
  await logAudit(env, currentUser, 'certificate.issued', {
    entityType: 'certificate',
    entityId: issued.certificateNo,
    detail: `order #${orderId}`,
    request,
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

async function revokeCert(request, env, currentUser) {
  const form = await request.formData();
  const certificateNo = String(form.get('certificate_no') || '').toUpperCase();
  const reason = String(form.get('reason') || '').trim().slice(0, 120) || 'Revoked by admin';
  await env.DB.prepare(
    "UPDATE certificates SET status = 'revoked', revoked_reason = ?, revoked_on = date('now') WHERE certificate_no = ?"
  )
    .bind(reason, certificateNo)
    .run();
  await logAudit(env, currentUser, 'certificate.revoked', {
    entityType: 'certificate',
    entityId: certificateNo,
    detail: reason,
    request,
  });
  return redirect('/admin/certificates');
}

// Authentication -----------------------------------------------------------------------
// A dedicated case per order (see authentication_cases in db/schema.sql), separate from
// ordinary order-status editing. Passing one is the only way an order reaches "authenticated"
// and gets its certificate; failing one sends it to "authentication_failed" instead. Owner
// and Authenticator roles only.

async function authenticationPage(env, currentUser, errorMessage) {
  const { results: cases } = await env.DB.prepare(
    `SELECT ac.*, o.public_ref, o.size_label, o.buyer_name, p.title AS product_title,
            au.name AS assigned_name
       FROM authentication_cases ac
       JOIN orders o ON o.id = ac.order_id
       JOIN products p ON p.id = o.product_id
       LEFT JOIN admin_users au ON au.id = ac.assigned_to
      WHERE ac.status IN ('not_started', 'assigned')
      ORDER BY ac.created_at`
  ).all();

  const { results: recent } = await env.DB.prepare(
    `SELECT ac.*, o.public_ref, p.title AS product_title
       FROM authentication_cases ac
       JOIN orders o ON o.id = ac.order_id
       JOIN products p ON p.id = o.product_id
      WHERE ac.status IN ('passed', 'failed')
      ORDER BY ac.decided_at DESC LIMIT 20`
  ).all();

  const { results: auths } = await env.DB.prepare('SELECT * FROM authenticators WHERE active = 1 ORDER BY initials').all();

  const row = (c) => {
    const mine = c.assigned_to === currentUser.id;
    return `<div class="panel" style="padding:20px; margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:14px;">
        <div>
          <strong style="font-size:15px;">${escapeHtml(c.product_title)}</strong>${c.size_label && c.size_label !== 'One size' ? ` · ${escapeHtml(c.size_label)}` : ''}
          <div style="font-size:12px; color:var(--faint); margin-top:2px;">
            <a href="/order/${encodeURIComponent(c.public_ref)}" target="_blank">${escapeHtml(c.public_ref)}</a>
            &middot; buyer ${escapeHtml(c.buyer_name)}
          </div>
        </div>
        <span class="tag" style="color:${c.status === 'assigned' ? 'var(--gold)' : 'var(--muted)'};">
          ${c.status === 'assigned' ? `Assigned to ${escapeHtml(c.assigned_name || '?')}` : 'Not started'}
        </span>
      </div>

      ${
        c.status === 'not_started'
          ? `<form method="post" action="/admin/authentication/${c.id}/assign">
               <button class="chip" type="submit" style="cursor:pointer;">Assign to me</button>
             </form>`
          : mine || currentUser.role === 'owner'
          ? `<form method="post" action="/admin/authentication/${c.id}/decide">
               <div class="form-row">
                 <div class="field"><label for="auth_id_${c.id}">Signed by</label>
                   <select id="auth_id_${c.id}" name="authenticator_id">
                     <option value="">—</option>
                     ${(auths || []).map((a) => `<option value="${a.id}">${escapeHtml(a.initials)} — ${escapeHtml(a.full_name)}</option>`).join('')}
                   </select>
                 </div>
                 <div class="field"><label for="report_${c.id}">Seller report reference</label><input id="report_${c.id}" name="report" maxlength="60" placeholder="LC-000000"></div>
               </div>
               <div class="field"><label for="notes_${c.id}">Inspection notes</label><textarea id="notes_${c.id}" name="notes" rows="2" maxlength="1000" placeholder="Material, hardware, stitching, logo, packaging..."></textarea></div>
               <div style="display:flex; gap:10px;">
                 <button class="btn" type="submit" name="result" value="pass" style="background:var(--green,#3f5f45);">Pass — issue certificate</button>
                 <button class="btn" type="submit" name="result" value="fail" style="background:var(--oxblood);">Fail</button>
               </div>
             </form>`
          : `<p class="muted" style="font-size:12.5px; margin:0;">Assigned to ${escapeHtml(c.assigned_name || 'someone else')}. Only they (or an Owner) can record the result.</p>`
      }
    </div>`;
  };

  return adminHtml(`
<h2 class="serif" style="font-size:32px; margin:0 0 8px;">Authentication</h2>
<p class="muted" style="margin:0 0 22px; font-size:13.5px; max-width:640px;">
  Every order opens a case here the moment it arrives at the facility. Passing one issues its
  certificate and moves the order on; failing one stops it there instead -- neither happens
  from the Orders page any more.
</p>
${errorMessage ? `<div class="notice notice-bad" style="margin-bottom:20px;">${escapeHtml(errorMessage)}</div>` : ''}

${(cases || []).length ? cases.map(row).join('') : '<div class="notice">Nothing waiting on authentication right now.</div>'}

${
  (recent || []).length
    ? `<h3 class="serif" style="font-size:22px; margin:32px 0 14px;">Recently decided</h3>
       <table class="table">
         <thead><tr><th>Item</th><th>Order</th><th>Result</th><th>When</th></tr></thead>
         <tbody>
           ${recent
             .map(
               (c) => `<tr>
             <td data-label="Item">${escapeHtml(c.product_title)}</td>
             <td data-label="Order"><a href="/order/${encodeURIComponent(c.public_ref)}" target="_blank">${escapeHtml(c.public_ref)}</a></td>
             <td data-label="Result"><span class="tag" style="color:${c.status === 'passed' ? 'var(--green)' : 'var(--oxblood)'};">${escapeHtml(c.status)}</span></td>
             <td data-label="When" style="font-size:12px;">${escapeHtml(String(c.decided_at || '').slice(0, 16).replace('T', ' '))}</td>
           </tr>`
             )
             .join('')}
         </tbody>
       </table>`
    : ''
}`);
}

async function assignAuthCase(request, env, caseId, currentUser) {
  await env.DB.prepare(
    "UPDATE authentication_cases SET status = 'assigned', assigned_to = ? WHERE id = ? AND status = 'not_started'"
  )
    .bind(currentUser.id, caseId)
    .run();
  await logAudit(env, currentUser, 'authentication.assigned', { entityType: 'authentication_case', entityId: caseId, request });
  return redirect('/admin/authentication');
}

async function decideAuthCase(request, env, caseId, currentUser) {
  const form = await request.formData();
  const result = form.get('result') === 'pass' ? 'passed' : 'fail';
  const notes = String(form.get('notes') || '').trim().slice(0, 1000) || null;

  const authCase = await env.DB.prepare(
    `SELECT ac.*, o.id AS order_id FROM authentication_cases ac JOIN orders o ON o.id = ac.order_id WHERE ac.id = ?`
  )
    .bind(caseId)
    .first();
  if (!authCase) return redirect('/admin/authentication');

  // Only the person it's assigned to, or an Owner, can record the result -- an Authenticator
  // can't quietly pass their own unassigned case by hitting this route directly.
  if (authCase.assigned_to !== currentUser.id && currentUser.role !== 'owner') {
    return redirect('/admin/authentication?error=' + encodeURIComponent('This case is assigned to someone else.'));
  }

  if (result === 'passed') {
    const issued = await issueCertificateForOrder(env, authCase.order_id, {
      authenticatorId: Number(form.get('authenticator_id')) || null,
      sellerReportRef: String(form.get('report') || '').trim() || null,
      notes,
    });
    if (!issued) {
      return redirect('/admin/authentication?error=' + encodeURIComponent('Could not issue a certificate for this order -- it may already have one.'));
    }
    await env.DB.prepare(
      "UPDATE authentication_cases SET status = 'passed', notes = ?, decided_by = ?, decided_at = datetime('now') WHERE id = ?"
    )
      .bind(notes, currentUser.id, caseId)
      .run();
    await db.addOrderEvent(env.DB, authCase.order_id, 'authenticated', 'Passed inspection. Certificate issued and package sealed.');
    await logAudit(env, currentUser, 'authentication.passed', {
      entityType: 'authentication_case',
      entityId: caseId,
      detail: `certificate ${issued.certificateNo}`,
      request,
    });
    return redirect(`/admin/orders?issued=${encodeURIComponent(issued.certificateNo)}`);
  }

  await env.DB.prepare(
    "UPDATE authentication_cases SET status = 'failed', notes = ?, decided_by = ?, decided_at = datetime('now') WHERE id = ?"
  )
    .bind(notes, currentUser.id, caseId)
    .run();
  await env.DB.prepare("UPDATE orders SET status = 'authentication_failed' WHERE id = ?").bind(authCase.order_id).run();
  await db.addOrderEvent(
    env.DB,
    authCase.order_id,
    'authentication_failed',
    'This piece did not pass our independent authentication check. We are in touch about a full refund.'
  );
  await logAudit(env, currentUser, 'authentication.failed', { entityType: 'authentication_case', entityId: caseId, detail: notes, request });

  return redirect('/admin/authentication');
}

// The day-to-day page: everything that is (or should be) for sale, with the controls that
// get used most -- mark sold, relist, edit. Adding new pieces lives on /admin/products.
async function listingsPage(env, errorMessage) {
  const { results: rows } = await env.DB.prepare(
    `SELECT p.id AS product_id, p.title, p.slug, c.name AS category_name,
            (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order LIMIT 1) AS image_url,
            o.id AS offer_id, o.size_label, o.status, o.landed_price, o.stock_code, o.sourced_by,
            s.name AS seller_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN offers o ON o.product_id = p.id
       LEFT JOIN sellers s ON s.id = o.seller_id
      ORDER BY (o.status = 'active') DESC, p.created_at DESC, o.id`
  ).all();

  const live = (rows || []).filter((r) => r.status === 'active');
  const other = (rows || []).filter((r) => r.offer_id && r.status !== 'active');
  const unpriced = (rows || []).filter((r) => !r.offer_id);

  const row = (r) => {
    const canToggle = r.status === 'active' || r.status === 'withdrawn';
    const nextStatus = r.status === 'active' ? 'withdrawn' : 'active';
    const label = r.status === 'active' ? 'Mark sold out' : 'Relist';
    return `<tr>
      <td data-label="Piece">
        <div style="display:flex; align-items:center; gap:12px;">
          ${
            r.image_url
              ? `<img src="${escapeHtml(r.image_url)}" alt="" style="width:46px; height:46px; object-fit:cover; border:1px solid var(--line); flex:none;">`
              : `<span style="width:46px; height:46px; background:var(--tile); border:1px solid var(--line); flex:none; display:inline-block;"></span>`
          }
          <div>
            <strong>${escapeHtml(r.title)}</strong>
            <div style="font-size:11.5px; color:var(--faint);">
              ${escapeHtml(r.category_name)}${r.size_label && r.size_label !== 'One size' ? ` · ${escapeHtml(r.size_label)}` : ''}${r.stock_code ? ` · ${escapeHtml(r.stock_code)}` : ''}
            </div>
          </div>
        </div>
      </td>
      <td data-label="Source">${r.sourced_by === 'inhouse' ? 'Inhaus' : escapeHtml(r.seller_name || '—')}</td>
      <td data-label="Price" class="num">${r.landed_price ? formatINRWords(r.landed_price, { tag: 'div' }) : '—'}</td>
      <td data-label="Status">
        ${
          r.offer_id
            ? `<span class="tag" style="color:${
                r.status === 'active' ? 'var(--green)' : r.status === 'withdrawn' ? 'var(--oxblood)' : 'var(--muted)'
              };">${escapeHtml(r.status)}</span>`
            : `<span class="tag" style="color:var(--oxblood);">not priced</span>`
        }
      </td>
      <td style="white-space:nowrap;">
        ${
          r.offer_id
            ? `<a href="/admin/offers/${r.offer_id}/edit" style="font-size:12.5px;">Edit</a>`
            : `<a href="/admin/products?offer_for=${r.product_id}#offer-form" style="font-size:12.5px; color:var(--oxblood);">Add a price</a>`
        }
        &middot; <a href="/p/${escapeHtml(r.slug)}" target="_blank" style="font-size:12.5px;">View</a>
        ${
          r.offer_id && canToggle
            ? ` <form method="post" action="/admin/offers/status" style="display:inline;">
                  <input type="hidden" name="offer_id" value="${r.offer_id}">
                  <input type="hidden" name="status" value="${nextStatus}">
                  <button class="chip" type="submit" style="cursor:pointer;">${label}</button>
                </form>`
            : ''
        }
      </td>
    </tr>`;
  };

  const table = (items, empty) =>
    items.length
      ? `<table class="table">
           <thead><tr><th>Piece</th><th>Source</th><th class="num">Price</th><th>Status</th><th></th></tr></thead>
           <tbody>${items.map(row).join('')}</tbody>
         </table>`
      : `<div class="notice">${empty}</div>`;

  return adminHtml(`
<div style="display:flex; justify-content:space-between; align-items:baseline; gap:20px; flex-wrap:wrap;">
  <h2 class="serif" style="font-size:32px; margin:0 0 8px;">Listings</h2>
  <a class="btn" href="/admin/products">Add a piece</a>
</div>
<p class="muted" style="margin:0 0 22px; font-size:13.5px;">Everything for sale, and everything waiting to be.</p>
${errorMessage ? `<div class="notice notice-bad" style="margin-bottom:20px;">${escapeHtml(errorMessage)}</div>` : ''}

<h3 class="serif" style="font-size:22px; margin:0 0 12px;">Live <span class="muted" style="font-size:14px;">(${live.length})</span></h3>
${table(live, 'Nothing is live yet. Add a piece with a price and it appears here.')}

${
  unpriced.length
    ? `<h3 class="serif" style="font-size:22px; margin:32px 0 12px;">Not priced yet <span class="muted" style="font-size:14px;">(${unpriced.length})</span></h3>
       <p class="muted" style="font-size:12.5px; margin:0 0 12px;">Saved as drafts. They stay off the site until a price is set — nobody can buy a piece without one.</p>
       ${table(unpriced, '')}`
    : ''
}

${
  other.length
    ? `<h3 class="serif" style="font-size:22px; margin:32px 0 12px;">Sold out and reserved <span class="muted" style="font-size:14px;">(${other.length})</span></h3>
       ${table(other, '')}`
    : ''
}`);
}

// A free-text "ships from" box lets an operator type a city we have never seen and quietly
// get zero shipping cost and the wrong duty treatment -- see computeOfferPricing's domestic
// check. A dropdown of cities already registered under Rates (each with a real country)
// forces that decision to happen once, in one place, instead of being guessed per offer.
function shipsFromField(cities, { id = 'ships_from', name = 'ships_from', required = false, selected = '' } = {}) {
  const req = required ? ' required' : '';
  if (!cities.length) {
    return `<div class="field"><label for="${id}">Ships from</label><input id="${id}" name="${name}"${req} maxlength="60" placeholder="Tokyo" value="${escapeHtml(selected)}">
      <span class="hint">No source cities set up yet &mdash; <a href="/admin/rates">add one under Rates</a> first, with its country, so duty and shipping come out right (India-sourced pieces pay no import duty).</span>
    </div>`;
  }
  return `<div class="field"><label for="${id}">Ships from</label>
    <select id="${id}" name="${name}"${req}>
      ${!selected ? '<option value="" disabled selected>Choose a city&hellip;</option>' : ''}
      ${cities
        .map(
          (c) =>
            `<option value="${escapeHtml(c.city)}"${c.city === selected ? ' selected' : ''}>${escapeHtml(c.city)} &mdash; ${escapeHtml(c.country || 'country not set')}</option>`
        )
        .join('')}
    </select>
    <span class="hint">Decides shipping cost, lead time, and whether import duty applies &mdash; India-sourced pieces pay none, everything else uses the category's duty rate. Sourcing somewhere new? <a href="/admin/rates">add the city and its country under Rates</a> first.</span>
  </div>`;
}

const STOCK_LABEL_OPTIONS = [
  ['', 'Normal'],
  ['limited', 'Limited stock'],
  ['last_one', 'Only one left'],
  ['made_to_order', 'Made to order'],
];

function normalizeStockLabel(value) {
  const v = String(value || '');
  return STOCK_LABEL_OPTIONS.some(([opt]) => opt === v) && v ? v : null;
}

function stockLabelField(id, name, selected = '') {
  return `<div class="field"><label for="${id}">Stock</label>
    <select id="${id}" name="${name}">
      ${STOCK_LABEL_OPTIONS.map(
        ([v, label]) => `<option value="${v}"${v === (selected || '') ? ' selected' : ''}>${label}</option>`
      ).join('')}
    </select>
    <span class="hint">Shows as a small tag on the listing. "Normal" shows nothing.</span>
  </div>`;
}

// A UK/US shoe size picker -- one clickable box per size, same look as the buyer-facing size
// grid on the product page (reuses its .sizes/.size CSS) -- or a free-text size field when the
// product isn't sized in UK (apparel, "one size", etc). `sizeType` decides which renders; when
// it isn't known server-side (the product is picked from a dropdown on the same form), both
// render and a small script swaps between them as the selection changes.
function shoeSizeChips(idPrefix, name, selected = '', multiple = false) {
  const selectedList = Array.isArray(selected) ? selected : [selected];
  const type = multiple ? 'checkbox' : 'radio';
  return `<div class="sizes" style="grid-template-columns:repeat(4,minmax(0,1fr));">
    ${SHOE_SIZE_LABELS.map(
      (label, i) => `<input type="${type}" class="visually-hidden size-radio" id="${idPrefix}_${i}" name="${name}" value="${escapeHtml(label)}"${selectedList.includes(label) ? ' checked' : ''}>
        <label for="${idPrefix}_${i}" class="size"><span class="n">${escapeHtml(label)}</span></label>`
    ).join('')}
  </div>`;
}

// `multiple: true` turns the box grid into checkboxes instead of radios, so one form
// submission can create several offers at once -- the same seller, price and terms, several
// sizes of the same piece, without repeating the whole form per size. Both share the same
// .size-radio CSS (:checked works identically on a checkbox and a radio input).
function sizeField({ idPrefix, name, sizeType, selected = '', label = 'Size', multiple = false }) {
  if (sizeType === 'uk') {
    return `<div class="field"><label>${label}${multiple ? ' <span class="hint" style="font-weight:400;">(pick as many as you have)</span>' : ''}</label>${shoeSizeChips(`${idPrefix}_uk`, name, selected, multiple)}</div>`;
  }
  return `<div class="field"><label for="${idPrefix}_text">${label}</label><input id="${idPrefix}_text" name="${name}" value="${escapeHtml(Array.isArray(selected) ? selected[0] || '' : selected || 'One size')}" maxlength="40"></div>`;
}

async function productsPage(env, errorMessage, preselectProductId = null) {
  const [categories, sellers, offersResult, cities] = await Promise.all([
    db.getCategories(env.DB),
    env.DB.prepare('SELECT * FROM sellers ORDER BY name').all().then((r) => r.results || []),
    env.DB.prepare(
      `SELECT o.id, o.size_label, o.status, o.landed_price, o.stock_code, o.sourced_by,
              p.title AS product_title, s.name AS seller_name
         FROM offers o
         JOIN products p ON p.id = o.product_id
         JOIN sellers s ON s.id = o.seller_id
        ORDER BY o.created_at DESC LIMIT 200`
    ).all(),
    listSourceCities(env.DB),
  ]);
  const offerRows = offersResult.results || [];
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
  imageStore(env)
    ? ''
    : `<div class="notice" style="margin-bottom:20px;">
         <strong>Photo upload is not connected.</strong> Add the <code>IMAGES_KV</code> binding in
         <code>wrangler.toml</code> and redeploy. Until then you can paste an image URL instead.
       </div>`
}
${
  imageStore(env) === 'kv'
    ? `<div class="notice" style="margin-bottom:20px;">
         Photos upload straight from your computer and are served from rarehaus.in. Video needs R2
         enabled in the Cloudflare dashboard — a stored photo is fine on the free plan, a video file
         is too large for it.
       </div>`
    : ''
}

<div class="grid grid-2" style="gap:24px; align-items:start; margin-bottom:32px;">
  <div class="panel" style="padding:22px;">
    <h3 class="serif" style="font-size:20px; margin:0 0 14px;">Add a product</h3>
    <form method="post" action="/admin/products/create" enctype="multipart/form-data">
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
        <div class="field"><label for="gender">Section</label>
          <select id="gender" name="gender">
            <option value="unisex" selected>Unisex</option>
            <option value="men">Men's</option>
            <option value="women">Women's</option>
          </select>
        </div>
        <div class="field"><label for="sku">Style / SKU</label><input id="sku" name="sku" maxlength="60"></div>
        <div class="field"><label for="retail">Retail price (₹)</label><input id="retail" name="retail" inputmode="numeric" maxlength="12">
          <span class="hint">Set this to unlock the "under retail" badge.</span>
        </div>
      </div>
      <div class="field"><label for="description">Description</label><textarea id="description" name="description" rows="3" maxlength="1200"></textarea></div>
      <div class="field"><label for="details">Details</label><textarea id="details" name="details" rows="3" maxlength="2000" placeholder="Material, dimensions, what's in the box..."></textarea>
        <span class="hint">Shown in its own "Details" section on the product page, separate from the description above.</span>
      </div>
      <div class="field"><label for="condition">Condition notes</label><input id="condition" name="condition" maxlength="200"></div>
      ${
        imageStore(env)
          ? `<div class="field"><label for="photo">Photos</label><input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple>
               <span class="hint">
                 Pick one or several files straight off your computer &mdash; JPEG, PNG, WEBP or GIF, up to
                 5&nbsp;MB each. The first one becomes the cover photo; reorder them, or add more, from the
                 table below once the product is saved. Stored on rarehaus.in itself, so it always loads.
                 Only use photographs you took or have written permission to use: brand press
                 images and another reseller's photos are someone else's copyright.
               </span>
             </div>`
          : ''
      }
      <div class="field"><label for="image">Or an image URL</label><input id="image" name="image" maxlength="400" placeholder="https://...">
        <span class="hint">
          Only needed if the photo lives somewhere else already. A Google Drive share link is
          converted automatically, but Google throttles hotlinked Drive images and they can stop
          loading without warning &mdash; uploading the file above is the reliable option.
        </span>
      </div>
      <div class="field"><label for="video">Video URL (optional)</label><input id="video" name="video" maxlength="400" placeholder="YouTube, Vimeo, or a direct .mp4 link">
        <span class="hint">A short unboxing or 360° clip. YouTube/Vimeo links embed automatically; a direct video file plays inline. Same copyright rule as photos.</span>
      </div>

      <div style="border-top:1px solid var(--line); margin:20px 0 16px; padding-top:16px;">
        <div style="font-size:13px; font-weight:600; margin-bottom:4px;">Price and stock</div>
        <p class="muted" style="font-size:12px; margin:0 0 14px;">
          Fill in a price and this goes live straight away. Leave it blank to save the piece as a
          draft — it stays off the site until you price it.
        </p>
        <div class="form-row">
          <div class="field"><label for="price">Your cost (₹)</label><input id="price" name="price" inputmode="numeric" maxlength="12">
            <span class="hint">What you pay. Duty, authentication and shipping are added on top, based on the category's rate and the ships-from city's country below &mdash; India-sourced pieces pay no import duty.</span>
          </div>
          ${shipsFromField(cities, { id: 'p_ships_from', name: 'ships_from' })}
        </div>
        <div class="form-row">
          <div id="offer_size_wrap">${sizeField({ idPrefix: 'offer_size', name: 'offer_size', sizeType: 'none', multiple: true })}</div>
          <div class="field"><label for="offer_condition">Condition</label><input id="offer_condition" name="offer_condition" value="Deadstock" maxlength="60"></div>
        </div>
        <div class="form-row">
          ${stockLabelField('p_stock_label', 'stock_label')}
        </div>
        <div class="field" style="flex-direction:row; align-items:center; gap:8px;">
          <input type="checkbox" id="p_inhouse" name="inhouse" value="1" style="width:auto;" checked>
          <label for="p_inhouse" style="margin:0;">Inhaus — sourced and imported by us (no seller commission)</label>
        </div>
        <div class="field"><label for="p_seller">Or a marketplace seller</label>
          <select id="p_seller" name="seller_id">
            ${sellers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)} — ${escapeHtml(s.city)}</option>`).join('')}
          </select>
          <span class="hint">Ignored while "Inhaus" is ticked.</span>
        </div>

        <details style="margin-top:10px;">
          <summary style="cursor:pointer; font-size:12.5px; color:var(--muted); padding:6px 0;">Set duty, authentication or shipping myself</summary>
          <div style="padding-top:12px;">
            <div class="form-row">
              <div class="field"><label for="p_duty">Duty (₹)</label><input id="p_duty" name="duty" inputmode="numeric" maxlength="12" placeholder="auto"></div>
              <div class="field"><label for="p_auth_fee">Authentication (₹)</label><input id="p_auth_fee" name="auth_fee" inputmode="numeric" maxlength="12" placeholder="auto"></div>
            </div>
            <div class="form-row">
              <div class="field"><label for="p_shipping">Shipping (₹)</label><input id="p_shipping" name="shipping" inputmode="numeric" maxlength="12" placeholder="auto"></div>
              <div class="field"><label for="p_lead_min">Lead days min</label><input id="p_lead_min" name="lead_min" inputmode="numeric" maxlength="3" placeholder="auto"></div>
            </div>
            <div class="field" style="max-width:180px;"><label for="p_lead_max">Lead days max</label><input id="p_lead_max" name="lead_max" inputmode="numeric" maxlength="3" placeholder="auto"></div>
            <span class="hint">Leave these blank to use the city and category rates. Fill one in and it wins over the automatic number.</span>
          </div>
        </details>
      </div>

      <button class="btn btn-block" type="submit">Add product</button>
    </form>
    <script>
    (function () {
      var SHOE_SIZES = ${JSON.stringify(SHOE_SIZE_LABELS)};
      var sizingSelect = document.getElementById('size_type');
      var wrap = document.getElementById('offer_size_wrap');
      function chipsHtml(idPrefix, name) {
        return '<div class="sizes" style="grid-template-columns:repeat(4,minmax(0,1fr));">' +
          SHOE_SIZES.map(function (l, i) {
            return '<input type="checkbox" class="visually-hidden size-radio" id="' + idPrefix + '_' + i + '" name="' + name + '" value="' + l + '">' +
              '<label for="' + idPrefix + '_' + i + '" class="size"><span class="n">' + l + '</span></label>';
          }).join('') + '</div>';
      }
      function render(sizeType) {
        if (sizeType === 'uk') {
          wrap.innerHTML = '<div class="field"><label>Size</label>' + chipsHtml('offer_size_uk', 'offer_size') + '</div>';
        } else {
          wrap.innerHTML = '<div class="field"><label for="offer_size_text">Size</label><input id="offer_size_text" name="offer_size" value="One size" maxlength="40"></div>';
        }
      }
      if (sizingSelect) {
        sizingSelect.addEventListener('change', function () { render(sizingSelect.value); });
      }
    })();
    </script>
  </div>

  <div class="panel" style="padding:22px;" id="offer-form">
    <h3 class="serif" style="font-size:20px; margin:0 0 14px;">Add a seller offer</h3>
    <p class="muted" style="font-size:12.5px; margin:0 0 14px;">The landed price is the sum of the four parts — that is what the buyer pays and what the breakdown shows.</p>
    <form method="post" action="/admin/offers/create">
      <div class="field"><label for="product_id">Product</label>
        <select id="product_id" name="product_id" required data-size-types='${JSON.stringify(
          Object.fromEntries((products || []).map((p) => [p.id, p.size_type]))
        )}'>
          ${(products || [])
            .map(
              (p) =>
                `<option value="${p.id}" data-size-type="${p.size_type}"${p.id === preselectProductId ? ' selected' : ''}>${escapeHtml(p.title)}</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="field" style="flex-direction:row; align-items:center; gap:8px;">
        <input type="checkbox" id="inhouse" name="inhouse" value="1" style="width:auto;">
        <label for="inhouse" style="margin:0;">Inhaus — sourced and imported by us directly (no seller commission)</label>
      </div>
      <div class="form-row">
        <div class="field"><label for="seller_id">Seller</label>
          <select id="seller_id" name="seller_id" required>
            ${sellers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)} — ${escapeHtml(s.city)}</option>`).join('')}
          </select>
          <span class="hint">Ignored if "Inhaus" above is checked.</span>
        </div>
        <div id="size_label_wrap">${sizeField({ idPrefix: 'size_label_o', name: 'size_label', sizeType: (products || []).find((p) => p.id === preselectProductId)?.size_type, multiple: true })}</div>
      </div>
      <div class="form-row">
        ${shipsFromField(cities, { required: true })}
        <div class="field"><label for="condition_o">Condition</label><input id="condition_o" name="condition" value="Deadstock" maxlength="60"></div>
      </div>
      <div class="field"><label for="seller_price">Seller price (₹)</label><input id="seller_price" name="seller_price" required inputmode="numeric" maxlength="12">
        <span class="hint">Duty, authentication, shipping and lead time are worked out from your
        <a href="/admin/rates">rates</a> and the ships-from city's country &mdash; India-sourced pieces pay no import duty. Leave the overrides below blank unless this one is unusual.</span>
      </div>
      ${stockLabelField('stock_label_o', 'stock_label')}

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
    <script>
    (function () {
      var SHOE_SIZES = ${JSON.stringify(SHOE_SIZE_LABELS)};
      var select = document.getElementById('product_id');
      var wrap = document.getElementById('size_label_wrap');
      function render(sizeType, keepValue) {
        if (sizeType === 'uk') {
          var chips = SHOE_SIZES.map(function (l, i) {
            return '<input type="checkbox" class="visually-hidden size-radio" id="size_label_o_' + i + '" name="size_label" value="' + l + '"' +
              (l === keepValue ? ' checked' : '') + '><label for="size_label_o_' + i + '" class="size"><span class="n">' + l + '</span></label>';
          }).join('');
          wrap.innerHTML = '<div class="field"><label>Size</label><div class="sizes" style="grid-template-columns:repeat(4,minmax(0,1fr));">' + chips + '</div></div>';
        } else {
          wrap.innerHTML = '<div class="field"><label for="size_label_o">Size</label><input id="size_label_o" name="size_label" value="' +
            (keepValue && SHOE_SIZES.indexOf(keepValue) === -1 ? keepValue : 'One size') + '" maxlength="40"></div>';
        }
      }
      if (select) {
        select.addEventListener('change', function () {
          var opt = select.options[select.selectedIndex];
          render(opt ? opt.dataset.sizeType : '', '');
        });
      }
    })();
    </script>
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
              imageStore(env)
                ? `<form method="post" action="/admin/images/upload" enctype="multipart/form-data" style="display:flex; gap:6px; align-items:center;">
                     <input type="hidden" name="product_id" value="${p.id}">
                     <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple required style="font-size:11px; max-width:170px;">
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
        <td data-label="Lowest" class="num">${p.lowest ? formatINRWords(p.lowest, { tag: 'div' }) : '—'}</td>
        <td><a href="/p/${escapeHtml(p.slug)}" target="_blank">View</a> &middot; <a href="/admin/products/${p.id}/edit">Edit</a></td>
      </tr>`;
      })
      .join('')}
  </tbody>
</table>

<h3 class="serif" style="font-size:24px; margin:32px 0 6px;">Stock</h3>
<p class="muted" style="font-size:12.5px; margin:0 0 14px;">
  Sold out or mark it back live. "Reserved" and "Sold" come from a real order and are not
  editable here.
</p>
<table class="table">
  <thead><tr><th>Item</th><th>Size</th><th>Seller</th><th class="num">Price</th><th>Status</th><th></th></tr></thead>
  <tbody>
    ${offerRows
      .map((o) => {
        const canToggle = o.status === 'active' || o.status === 'withdrawn';
        const nextStatus = o.status === 'active' ? 'withdrawn' : 'active';
        const label = o.status === 'active' ? 'Mark sold out' : 'Relist';
        return `<tr>
        <td data-label="Item"><strong>${escapeHtml(o.product_title)}</strong>
          <div style="font-size:11px; color:var(--faint);">${escapeHtml(o.stock_code || '')}</div>
        </td>
        <td data-label="Size">${escapeHtml(o.size_label)}</td>
        <td data-label="Seller">${o.sourced_by === 'inhouse' ? 'Inhaus' : escapeHtml(o.seller_name)}</td>
        <td data-label="Price" class="num">${formatINRWords(o.landed_price, { tag: 'div' })}</td>
        <td data-label="Status">
          <span class="tag" style="color:${
            o.status === 'active' ? 'var(--green)' : o.status === 'withdrawn' ? 'var(--oxblood)' : 'var(--muted)'
          };">${escapeHtml(o.status)}</span>
        </td>
        <td style="white-space:nowrap;">
          <a href="/admin/offers/${o.id}/edit" style="font-size:12.5px;">Edit</a>
          ${
            canToggle
              ? ` &middot; <form method="post" action="/admin/offers/status" style="display:inline;">
                   <input type="hidden" name="offer_id" value="${o.id}">
                   <input type="hidden" name="status" value="${nextStatus}">
                   <button class="chip" type="submit" style="cursor:pointer;">${label}</button>
                 </form>`
              : ''
          }
        </td>
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

async function createProduct(request, env, currentUser) {
  const form = await request.formData();
  const title = String(form.get('title') || '').trim();
  const categoryId = Number(form.get('category_id'));
  if (!title || !Number.isInteger(categoryId)) return redirect('/admin/products');

  const num = (k) => {
    const v = String(form.get(k) || '').split('.')[0].replace(/[^\d]/g, '');
    return v ? Number(v) : null;
  };

  let slug = slugify(title);
  const existing = await env.DB.prepare('SELECT id FROM products WHERE slug = ?').bind(slug).first();
  if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const video = String(form.get('video') || '').trim();

  const gender = ['men', 'women', 'unisex'].includes(form.get('gender')) ? form.get('gender') : 'unisex';

  const result = await env.DB.prepare(
    `INSERT INTO products (slug, title, category_id, sku, description, details, condition_notes, retail_price, size_type, gender, video_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      slug,
      title,
      categoryId,
      String(form.get('sku') || '').trim() || null,
      String(form.get('description') || '').trim() || null,
      String(form.get('details') || '').trim() || null,
      String(form.get('condition') || '').trim() || null,
      num('retail'),
      String(form.get('size_type') || 'none'),
      gender,
      video && /^https:\/\//i.test(video) ? video : null
    )
    .run();

  const productId = result.meta.last_row_id;
  await logAudit(env, currentUser, 'product.created', { entityType: 'product', entityId: productId, detail: title, request });

  // Uploaded files win over a pasted URL: they are hosted by us, so they cannot break later.
  // Several photos can be picked at once; they are stored in the order the browser sent them,
  // so the first one is the cover photo the same way a single upload would be.
  const uploads = form.getAll('photo').filter((f) => f && typeof f.arrayBuffer === 'function' && f.size > 0);
  let uploadError = '';
  let sortOrder = 0;
  let storedAny = false;
  for (const file of uploads) {
    const stored = await storeImage(env, file);
    if (!stored.ok) {
      uploadError += ` ${stored.error}`;
      continue;
    }
    await env.DB.prepare('INSERT INTO product_images (product_id, url, alt, sort_order) VALUES (?, ?, ?, ?)')
      .bind(productId, `/img/${stored.key}`, title, sortOrder)
      .run();
    sortOrder += 1;
    storedAny = true;
  }
  if (!storedAny) {
    const image = normalizeImageUrl(form.get('image'));
    if (image) {
      await env.DB.prepare('INSERT INTO product_images (product_id, url, alt) VALUES (?, ?, ?)')
        .bind(productId, image, title)
        .run();
    }
  }
  uploadError = uploadError.trim();

  // A product with no offer has no price and cannot be bought, so the price fields live on
  // this same form: fill one in and the listing goes live in a single step.
  const sellerPrice = Number(String(form.get('price') || '').split('.')[0].replace(/[^\d]/g, '')) || 0;
  if (sellerPrice > 0) {
    const inhouse = form.get('inhouse') === '1';
    const sellerId = inhouse ? await ensureHouseSeller(env) : Number(form.get('seller_id'));
    if (Number.isInteger(sellerId)) {
      const city = String(form.get('ships_from') || '').trim();
      const rawNum = (k) => String(form.get(k) || '').split('.')[0].replace(/[^\d]/g, '');
      // A shoe size picker allows checking several boxes -- one offer per size checked, all
      // the same seller/price/terms, so restocking a piece in multiple sizes doesn't mean
      // repeating this whole form once per size.
      const sizes = form.getAll('offer_size').map((v) => String(v).trim()).filter(Boolean);
      let priced = null;
      let city_found_all = true;
      let rate_found_all = true;
      for (const sizeLabel of sizes.length ? sizes : ['One size']) {
        const result = await insertOffer(env, {
          productId,
          inhouse,
          sellerId,
          sizeLabel,
          condition: String(form.get('offer_condition') || 'Deadstock').trim(),
          city,
          sellerPrice,
          stockLabel: form.get('stock_label'),
          overrides: {
            duty: rawNum('duty'),
            auth_fee: rawNum('auth_fee'),
            shipping: rawNum('shipping'),
            lead_days_min: rawNum('lead_min'),
            lead_days_max: rawNum('lead_max'),
          },
          currentUser,
          request,
        });
        if (result) {
          priced = result;
          if (!result.city_found) city_found_all = false;
          if (!result.rate_found) rate_found_all = false;
        }
      }
      const warn = priced ? pricingWarning({ ...priced, city_found: city_found_all, rate_found: rate_found_all }, city) : '';
      if (uploadError) {
        return redirect('/admin/listings?error=' + encodeURIComponent(uploadError.trim()));
      }
      return redirect('/admin/listings' + warn);
    }
  }

  return redirect('/admin/products?error=' + encodeURIComponent(
    'Product saved, but with no price it is not for sale yet. Add a price from the Listings page to make it buyable.' +
      uploadError
  ));
}

// The "sourced in-house" system seller. Created on first use rather than in seed data, so
// it exists whether or not seed.sql ever ran against this database.
const HOUSE_SELLER_NAME = 'Inhaus (by Rarehaus)';

async function ensureHouseSeller(env) {
  const existing = await env.DB.prepare('SELECT id FROM sellers WHERE name = ?')
    .bind(HOUSE_SELLER_NAME)
    .first();
  if (existing) return existing.id;

  // Databases created before the name settled on "Inhaus" carry the old row. Rename it rather
  // than adding a second house seller, so existing offers stay attached to it.
  const legacy = await env.DB.prepare("SELECT id FROM sellers WHERE name = 'Rarehaus (in-house)'").first();
  if (legacy) {
    await env.DB.prepare('UPDATE sellers SET name = ? WHERE id = ?').bind(HOUSE_SELLER_NAME, legacy.id).run();
    return legacy.id;
  }

  const result = await env.DB.prepare(
    `INSERT INTO sellers (name, city, country, kyc_verified, legit_check)
     VALUES (?, 'Guwahati', 'India', 1, 1)`
  )
    .bind(HOUSE_SELLER_NAME)
    .run();
  return result.meta.last_row_id;
}

// Shared by the one-step "Add a product" form and the standalone offer form, so a listing
// priced either way goes through exactly the same duty/fee/shipping rules.
async function insertOffer(env, { productId, inhouse, sellerId, sizeLabel, condition, city, sellerPrice, stockLabel, overrides = {}, currentUser, request } = {}) {
  const product = await env.DB.prepare(
    'SELECT p.id, p.category_id, c.slug AS category_slug FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?'
  )
    .bind(productId)
    .first();
  if (!product) return null;

  // Duty, fees, shipping and lead time all come from the rate rules. Only values the
  // operator actually typed are treated as overrides.
  const priced = await computeOfferPricing(env.DB, {
    categoryId: product.category_id,
    city,
    sellerPrice,
    overrides,
  });

  const stockCode = await nextStockCode(env.DB, product.category_slug);

  await env.DB.prepare(
    `INSERT INTO offers (stock_code, product_id, seller_id, sourced_by, size_label, condition, ships_from,
                         seller_price, duty, auth_fee, shipping, landed_price, lead_days_min, lead_days_max, stock_label)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      stockCode,
      productId,
      sellerId,
      inhouse ? 'inhouse' : 'seller',
      sizeLabel || 'One size',
      condition || 'Deadstock',
      city,
      priced.seller_price,
      priced.duty,
      priced.auth_fee,
      priced.shipping,
      priced.landed_price,
      priced.lead_days_min,
      priced.lead_days_max,
      normalizeStockLabel(stockLabel)
    )
    .run();

  await logAudit(env, currentUser, 'offer.created', {
    entityType: 'offer',
    entityId: stockCode,
    detail: `product #${productId}, seller price ${priced.seller_price}, landed ${priced.landed_price}`,
    request,
  });

  return priced;
}

// Turns a priced offer's rate-lookup result into the warning query string, so a missing duty
// rate or unknown city is surfaced rather than silently charging zero.
function pricingWarning(priced, city) {
  if (!priced) return '';
  if (!priced.rate_found) {
    return '?error=' + encodeURIComponent('Listed, but no duty rate is set for that category — duty was charged at 0. Set it under Rates.');
  }
  if (!priced.city_found) {
    return '?error=' + encodeURIComponent(`Listed, but "${city}" is not in your source cities — shipping was charged at 0. Add it under Rates.`);
  }
  return '';
}

async function createOffer(request, env, currentUser) {
  const form = await request.formData();
  const raw = (k) => String(form.get(k) || '').split('.')[0].replace(/[^\d]/g, '');

  const productId = Number(form.get('product_id'));
  const inhouse = form.get('inhouse') === '1';
  const sellerId = inhouse ? await ensureHouseSeller(env) : Number(form.get('seller_id'));
  if (!Number.isInteger(productId) || !Number.isInteger(sellerId)) return redirect('/admin/products');

  const sellerPrice = Number(raw('seller_price')) || 0;
  if (sellerPrice <= 0) {
    return redirect('/admin/products?error=' + encodeURIComponent('Enter a seller price.'));
  }

  const city = String(form.get('ships_from') || '').trim();
  const sizes = form.getAll('size_label').map((v) => String(v).trim()).filter(Boolean);

  let priced = null;
  for (const sizeLabel of sizes.length ? sizes : ['One size']) {
    const result = await insertOffer(env, {
      productId,
      inhouse,
      sellerId,
      sizeLabel,
      condition: String(form.get('condition') || 'Deadstock').trim(),
      city,
      sellerPrice,
      stockLabel: form.get('stock_label'),
      overrides: {
        duty: raw('duty'),
        auth_fee: raw('auth_fee'),
        shipping: raw('shipping'),
        lead_days_min: raw('lead_min'),
        lead_days_max: raw('lead_max'),
      },
      currentUser,
      request,
    });
    if (result) priced = result;
  }
  if (!priced) return redirect('/admin/products');

  const warn = !priced.rate_found
    ? '?error=' + encodeURIComponent('Offer(s) added, but no duty rate is set for that category — duty was charged at 0. Set it under Rates.')
    : !priced.city_found
    ? '?error=' + encodeURIComponent(`Offer(s) added, but "${city}" is not in your source cities — shipping was charged at 0. Add it under Rates.`)
    : '';

  return redirect('/admin/products' + warn);
}

// Only toggles between active and withdrawn -- reserved/sold reflect a real order and must
// not be hand-edited out from under it.
async function setOfferStatus(request, env, currentUser) {
  const form = await request.formData();
  const offerId = Number(form.get('offer_id'));
  const status = form.get('status') === 'active' ? 'active' : 'withdrawn';
  if (!Number.isInteger(offerId)) return redirect('/admin/products');

  await env.DB.prepare("UPDATE offers SET status = ? WHERE id = ? AND status IN ('active', 'withdrawn')")
    .bind(status, offerId)
    .run();
  await logAudit(env, currentUser, 'offer.status_changed', { entityType: 'offer', entityId: offerId, detail: `status -> ${status}`, request });

  return redirect('/admin/products');
}

// Edit / delete -----------------------------------------------------------------
// Deletion is only ever offered when nothing real depends on the row -- a product or
// offer that already has an order against it can be withdrawn but never deleted, so order
// history and certificates never end up pointing at something that no longer exists.

async function editProductPage(env, productId) {
  const [product, categories, images] = await Promise.all([
    env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first(),
    db.getCategories(env.DB),
    env.DB.prepare('SELECT id, url FROM product_images WHERE product_id = ? ORDER BY sort_order')
      .bind(productId)
      .all()
      .then((r) => r.results || []),
  ]);
  if (!product) return adminHtml('<div class="notice">No such product.</div>', 404);

  const orderCount = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM orders o JOIN offers ofr ON ofr.id = o.offer_id WHERE ofr.product_id = ?`
  )
    .bind(productId)
    .first();
  const canDelete = (orderCount?.n || 0) === 0;

  return adminHtml(`
<h2 class="serif" style="font-size:32px; margin:0 0 22px;">Edit product</h2>
<div class="panel" style="padding:22px; max-width:640px;">
  <form method="post" action="/admin/products/${product.id}/update">
    <div class="field"><label for="title">Title</label><input id="title" name="title" required maxlength="160" value="${escapeHtml(product.title)}"></div>
    <div class="form-row">
      <div class="field"><label for="category_id">Category</label>
        <select id="category_id" name="category_id" required>
          ${categories
            .map(
              (c) =>
                `<option value="${c.id}"${c.id === product.category_id ? ' selected' : ''}>${escapeHtml(c.name)}</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="field"><label for="size_type">Sizing</label>
        <select id="size_type" name="size_type">
          ${['none', 'uk', 'eu', 'apparel']
            .map(
              (v) =>
                `<option value="${v}"${v === product.size_type ? ' selected' : ''}>${v === 'none' ? 'None' : v.toUpperCase()}</option>`
            )
            .join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="field"><label for="gender">Section</label>
        <select id="gender" name="gender">
          ${[['unisex', 'Unisex'], ['men', "Men's"], ['women', "Women's"]]
            .map(
              ([v, label]) => `<option value="${v}"${v === product.gender ? ' selected' : ''}>${label}</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="field"><label for="sku">Style / SKU</label><input id="sku" name="sku" maxlength="60" value="${escapeHtml(product.sku || '')}"></div>
    </div>
    <div class="field"><label for="retail">Retail price (₹)</label><input id="retail" name="retail" inputmode="numeric" maxlength="12" value="${product.retail_price || ''}"></div>
    <div class="field"><label for="description">Description</label><textarea id="description" name="description" rows="3" maxlength="1200">${escapeHtml(product.description || '')}</textarea></div>
    <div class="field"><label for="details">Details</label><textarea id="details" name="details" rows="3" maxlength="2000" placeholder="Material, dimensions, what's in the box...">${escapeHtml(product.details || '')}</textarea>
      <span class="hint">Shown in its own "Details" section on the product page, separate from the description above.</span>
    </div>
    <div class="field"><label for="condition">Condition notes</label><input id="condition" name="condition" maxlength="200" value="${escapeHtml(product.condition_notes || '')}"></div>
    <div class="field" style="flex-direction:row; align-items:center; gap:8px;">
      <input type="checkbox" id="is_published" name="is_published" value="1" style="width:auto;" ${product.is_published ? 'checked' : ''}>
      <label for="is_published" style="margin:0;">Published (visible on the site)</label>
    </div>
    <button class="btn btn-block" type="submit">Save changes</button>
  </form>
</div>

<h3 class="serif" style="font-size:20px; margin:28px 0 12px;">Photos</h3>
<div style="display:flex; gap:10px; flex-wrap:wrap;">
  ${
    images.length
      ? images
          .map((im) => `<img src="${escapeHtml(im.url)}" alt="" style="width:70px; height:70px; object-fit:cover; border:1px solid var(--line);">`)
          .join('')
      : '<span class="faint">None yet — manage photos from the catalogue table.</span>'
  }
</div>

<div style="margin-top:32px; padding-top:20px; border-top:1px solid var(--line);">
  ${
    canDelete
      ? `<form method="post" action="/admin/products/${product.id}/delete" onsubmit="return confirm('Delete this product and all its offers permanently? This cannot be undone.');">
           <button class="btn" type="submit" style="background:var(--oxblood);">Delete this product</button>
         </form>`
      : `<p class="muted" style="font-size:12.5px;">This product has real orders against it, so it can't be deleted — withdraw its offers instead.</p>`
  }
</div>

<p style="margin-top:20px;"><a href="/admin/products">&larr; Back to products</a></p>`);
}

async function updateProduct(request, env, productId, currentUser) {
  const form = await request.formData();
  const title = String(form.get('title') || '').trim();
  const categoryId = Number(form.get('category_id'));
  if (!title || !Number.isInteger(categoryId)) return redirect(`/admin/products/${productId}/edit`);

  const num = (k) => {
    const v = String(form.get(k) || '').split('.')[0].replace(/[^\d]/g, '');
    return v ? Number(v) : null;
  };

  const gender = ['men', 'women', 'unisex'].includes(form.get('gender')) ? form.get('gender') : 'unisex';

  await env.DB.prepare(
    `UPDATE products SET title = ?, category_id = ?, sku = ?, description = ?, details = ?, condition_notes = ?,
       retail_price = ?, size_type = ?, gender = ?, is_published = ? WHERE id = ?`
  )
    .bind(
      title,
      categoryId,
      String(form.get('sku') || '').trim() || null,
      String(form.get('description') || '').trim() || null,
      String(form.get('details') || '').trim() || null,
      String(form.get('condition') || '').trim() || null,
      num('retail'),
      String(form.get('size_type') || 'none'),
      gender,
      form.get('is_published') === '1' ? 1 : 0,
      productId
    )
    .run();
  await logAudit(env, currentUser, 'product.updated', { entityType: 'product', entityId: productId, detail: title, request });

  return redirect('/admin/products');
}

async function deleteProduct(request, env, productId, currentUser) {
  const orderCount = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM orders o JOIN offers ofr ON ofr.id = o.offer_id WHERE ofr.product_id = ?`
  )
    .bind(productId)
    .first();
  if ((orderCount?.n || 0) > 0) return redirect('/admin/products');

  const images = await env.DB.prepare('SELECT url FROM product_images WHERE product_id = ?').bind(productId).all();
  for (const im of images.results || []) {
    await deleteImage(env, im.url);
  }
  const product = await env.DB.prepare('SELECT title, video_url FROM products WHERE id = ?').bind(productId).first();
  if (product?.video_url) await deleteImage(env, product.video_url);

  // product_images and offers both reference products with ON DELETE CASCADE, so this
  // takes the rest of the row's data with it.
  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(productId).run();
  await logAudit(env, currentUser, 'product.deleted', { entityType: 'product', entityId: productId, detail: product?.title, request });
  return redirect('/admin/products');
}

async function editOfferPage(env, offerId) {
  const offer = await env.DB.prepare(
    `SELECT o.*, p.title AS product_title, p.size_type AS product_size_type
       FROM offers o JOIN products p ON p.id = o.product_id WHERE o.id = ?`
  )
    .bind(offerId)
    .first();
  if (!offer) return adminHtml('<div class="notice">No such offer.</div>', 404);

  const [sellers, cities, orderCount] = await Promise.all([
    env.DB.prepare('SELECT * FROM sellers ORDER BY name').all().then((r) => r.results || []),
    listSourceCities(env.DB),
    env.DB.prepare('SELECT COUNT(*) AS n FROM orders WHERE offer_id = ?').bind(offerId).first(),
  ]);
  const canDelete = (orderCount?.n || 0) === 0;

  return adminHtml(`
<h2 class="serif" style="font-size:32px; margin:0 0 6px;">Edit offer</h2>
<p class="muted" style="font-size:13px; margin:0 0 20px;">${escapeHtml(offer.product_title)} &middot; ${escapeHtml(offer.stock_code || '')}</p>
<div class="panel" style="padding:22px; max-width:640px;">
  <form method="post" action="/admin/offers/${offer.id}/update">
    <div class="form-row">
      <div class="field"><label for="seller_id">Seller</label>
        <select id="seller_id" name="seller_id" required>
          ${sellers
            .map(
              (s) =>
                `<option value="${s.id}"${s.id === offer.seller_id ? ' selected' : ''}>${escapeHtml(s.name)} — ${escapeHtml(s.city)}</option>`
            )
            .join('')}
        </select>
      </div>
      ${sizeField({ idPrefix: 'size_label', name: 'size_label', sizeType: offer.product_size_type, selected: offer.size_label })}
    </div>
    <div class="field" style="flex-direction:row; align-items:center; gap:8px;">
      <input type="checkbox" id="inhouse" name="inhouse" value="1" style="width:auto;" ${offer.sourced_by === 'inhouse' ? 'checked' : ''}>
      <label for="inhouse" style="margin:0;">Inhaus — sourced by us (ignores the seller above)</label>
    </div>
    <div class="form-row">
      ${shipsFromField(cities, { required: true, selected: offer.ships_from })}
      <div class="field"><label for="condition_o">Condition</label><input id="condition_o" name="condition" value="${escapeHtml(offer.condition)}" maxlength="60"></div>
    </div>
    <div class="form-row">
      <div class="field"><label for="seller_price">Seller price (₹)</label><input id="seller_price" name="seller_price" required inputmode="numeric" maxlength="12" value="${offer.seller_price}"></div>
      <div class="field"><label for="status">Status</label>
        <select id="status" name="status">
          ${['active', 'withdrawn', 'reserved', 'sold']
            .map((s) => `<option value="${s}"${s === offer.status ? ' selected' : ''}>${s}</option>`)
            .join('')}
        </select>
      </div>
    </div>
    ${stockLabelField('stock_label_e', 'stock_label', offer.stock_label)}
    <p class="hint" style="margin:-6px 0 14px;">Landed price is always seller price + duty + authentication + shipping, recalculated from these four fields on save.</p>
    <div class="form-row">
      <div class="field"><label for="duty">Duty (₹)</label><input id="duty" name="duty" inputmode="numeric" maxlength="12" value="${offer.duty}"></div>
      <div class="field"><label for="auth_fee">Authentication (₹)</label><input id="auth_fee" name="auth_fee" inputmode="numeric" maxlength="12" value="${offer.auth_fee}"></div>
    </div>
    <div class="form-row">
      <div class="field"><label for="shipping">Shipping (₹)</label><input id="shipping" name="shipping" inputmode="numeric" maxlength="12" value="${offer.shipping}"></div>
      <div class="field"><label for="lead_min">Lead days min</label><input id="lead_min" name="lead_min" inputmode="numeric" maxlength="3" value="${offer.lead_days_min}"></div>
    </div>
    <div class="field" style="max-width:180px;"><label for="lead_max">Lead days max</label><input id="lead_max" name="lead_max" inputmode="numeric" maxlength="3" value="${offer.lead_days_max}"></div>
    <button class="btn btn-block" type="submit">Save changes</button>
  </form>
</div>

<div style="margin-top:32px; padding-top:20px; border-top:1px solid var(--line);">
  ${
    canDelete
      ? `<form method="post" action="/admin/offers/${offer.id}/delete" onsubmit="return confirm('Delete this offer permanently? This cannot be undone.');">
           <button class="btn" type="submit" style="background:var(--oxblood);">Delete this offer</button>
         </form>`
      : `<p class="muted" style="font-size:12.5px;">This offer has a real order against it, so it can't be deleted — change its status instead.</p>`
  }
</div>

<p style="margin-top:20px;"><a href="/admin/products">&larr; Back to products</a></p>`);
}

async function updateOffer(request, env, offerId, currentUser) {
  const form = await request.formData();
  const raw = (k) => Number(String(form.get(k) || '').split('.')[0].replace(/[^\d]/g, '')) || 0;

  const before = await env.DB.prepare('SELECT seller_price, landed_price, status FROM offers WHERE id = ?').bind(offerId).first();

  const inhouse = form.get('inhouse') === '1';
  const sellerId = inhouse ? await ensureHouseSeller(env) : Number(form.get('seller_id'));
  if (!Number.isInteger(sellerId)) return redirect(`/admin/offers/${offerId}/edit`);

  const sellerPrice = raw('seller_price');
  const duty = raw('duty');
  const authFee = raw('auth_fee');
  const shipping = raw('shipping');
  const leadMin = raw('lead_min') || 14;
  const leadMax = raw('lead_max') || 28;
  const status = ['active', 'withdrawn', 'reserved', 'sold'].includes(form.get('status')) ? form.get('status') : 'active';

  await env.DB.prepare(
    `UPDATE offers SET seller_id = ?, sourced_by = ?, size_label = ?, condition = ?, ships_from = ?,
       seller_price = ?, duty = ?, auth_fee = ?, shipping = ?, landed_price = ?, lead_days_min = ?, lead_days_max = ?, status = ?, stock_label = ?
     WHERE id = ?`
  )
    .bind(
      sellerId,
      inhouse ? 'inhouse' : 'seller',
      String(form.get('size_label') || 'One size').trim() || 'One size',
      String(form.get('condition') || 'Deadstock').trim(),
      String(form.get('ships_from') || '').trim(),
      sellerPrice,
      duty,
      authFee,
      shipping,
      sellerPrice + duty + authFee + shipping,
      leadMin,
      leadMax,
      status,
      normalizeStockLabel(form.get('stock_label')),
      offerId
    )
    .run();

  const landedAfter = sellerPrice + duty + authFee + shipping;
  await logAudit(env, currentUser, 'offer.updated', {
    entityType: 'offer',
    entityId: offerId,
    detail: `landed price ${before?.landed_price ?? '?'} -> ${landedAfter}, status ${before?.status ?? '?'} -> ${status}`,
    request,
  });

  return redirect('/admin/products');
}

async function deleteOffer(request, env, offerId, currentUser) {
  const orderCount = await env.DB.prepare('SELECT COUNT(*) AS n FROM orders WHERE offer_id = ?').bind(offerId).first();
  if ((orderCount?.n || 0) > 0) return redirect('/admin/products');
  await env.DB.prepare('DELETE FROM offers WHERE id = ?').bind(offerId).run();
  await logAudit(env, currentUser, 'offer.deleted', { entityType: 'offer', entityId: offerId, request });
  return redirect('/admin/products');
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

<div class="notice" style="margin-bottom:24px; max-width:760px;">
  <strong>Duty only applies to what's actually imported.</strong> A source city whose country
  below is exactly "India" is treated as domestic &mdash; offers shipping from it are charged
  no import duty at all, regardless of the category rate. Everything sourced abroad (Japan,
  Korea, or anywhere else) uses the category's duty % as normal. Spell the country "India" for
  domestic cities so this kicks in correctly.
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

async function saveCategoryRates(request, env, currentUser) {
  const form = await request.formData();
  const categories = await db.getCategories(env.DB);

  const writes = [];
  const changes = [];
  for (const c of categories) {
    const duty = Number(String(form.get(`duty_${c.id}`) || '').replace(/[^\d.]/g, ''));
    const auth = Number(String(form.get(`auth_${c.id}`) || '').split('.')[0].replace(/[^\d]/g, ''));
    const dutyVal = Number.isFinite(duty) ? duty : 0;
    const authVal = Number.isFinite(auth) ? auth : 0;
    changes.push(`${c.name}: ${dutyVal}% / ₹${authVal}`);
    writes.push(
      env.DB.prepare(
        `INSERT INTO category_rates (category_id, duty_pct, auth_fee, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(category_id) DO UPDATE SET
           duty_pct = excluded.duty_pct, auth_fee = excluded.auth_fee, updated_at = datetime('now')`
      ).bind(c.id, dutyVal, authVal)
    );
  }
  await env.DB.batch(writes);
  await logAudit(env, currentUser, 'rates.category_updated', { entityType: 'rate', detail: changes.join('; '), request });

  return redirect('/admin/rates?saved=' + encodeURIComponent('Category rates saved.'));
}

async function saveCity(request, env, currentUser) {
  const form = await request.formData();
  const city = String(form.get('city') || '').trim().slice(0, 60);
  if (!city) return redirect('/admin/rates');

  const num = (k, fallback) => {
    const n = Number(String(form.get(k) || '').split('.')[0].replace(/[^\d]/g, ''));
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
  await logAudit(env, currentUser, 'rates.city_updated', {
    entityType: 'rate',
    entityId: city,
    detail: `shipping ${num('shipping_cost', 0)}`,
    request,
  });

  return redirect('/admin/rates?saved=' + encodeURIComponent(`Saved ${city}.`));
}

async function uploadImage(request, env) {
  const form = await request.formData();
  const productId = Number(form.get('product_id'));
  if (!Number.isInteger(productId)) return redirect('/admin/products');

  // The file input allows selecting several photos at once (multiple attribute), so every
  // one under the "file" field name is stored and added in the order the browser sent them.
  const files = form.getAll('file').filter((f) => f && typeof f.arrayBuffer === 'function' && f.size > 0);
  if (!files.length) return redirect('/admin/products?error=' + encodeURIComponent('No file was uploaded.'));

  const product = await env.DB.prepare('SELECT title FROM products WHERE id = ?')
    .bind(productId)
    .first();
  let next = await env.DB.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM product_images WHERE product_id = ?'
  )
    .bind(productId)
    .first();
  let sortOrder = next?.n || 0;

  const errors = [];
  for (const file of files) {
    const result = await storeImage(env, file);
    if (!result.ok) {
      errors.push(result.error);
      continue;
    }
    await env.DB.prepare(
      'INSERT INTO product_images (product_id, url, alt, sort_order) VALUES (?, ?, ?, ?)'
    )
      .bind(productId, `/img/${result.key}`, product?.title || null, sortOrder)
      .run();
    sortOrder += 1;
  }

  if (errors.length) {
    return redirect('/admin/products?error=' + encodeURIComponent(errors.join(' ')));
  }
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

async function decideApplication(request, env, currentUser) {
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

  await logAudit(env, currentUser, 'seller_application.decided', {
    entityType: 'seller_application',
    entityId: id,
    detail: `${app.business_name}: ${decision}`,
    request,
  });

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

// Employee accounts -----------------------------------------------------------------
// Owner-only: create accounts, disable/re-enable them, and reset a forgotten password.
// Deleting an account is deliberately not offered -- disabling keeps the row (and its
// last_login_at / created_at history) intact, the same soft-deletion principle used
// everywhere else business records live.

function randomTempPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return [...bytes].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
}

async function adminUsersPage(env, currentUser, errorMessage, notice) {
  const { results: users } = await env.DB.prepare(
    'SELECT id, name, email, role, status, created_at, last_login_at FROM admin_users ORDER BY created_at'
  ).all();

  return adminHtml(`
<h2 class="serif" style="font-size:32px; margin:0 0 8px;">Employees</h2>
<p class="muted" style="margin:0 0 22px; font-size:13.5px; max-width:640px;">
  Each person signs in with their own email and password instead of a shared one. Their role
  decides which admin pages they can reach -- see the note on each role below.
</p>
${notice ? `<div class="notice notice-good" style="margin-bottom:20px;">${escapeHtml(notice)}</div>` : ''}
${errorMessage ? `<div class="notice notice-bad" style="margin-bottom:20px;">${escapeHtml(errorMessage)}</div>` : ''}

<table class="table" style="margin-bottom:32px;">
  <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last signed in</th><th></th></tr></thead>
  <tbody>
    ${(users || [])
      .map(
        (u) => `<tr>
          <td data-label="Name">${escapeHtml(u.name)}${u.id === currentUser.id ? ' <span class="tag muted">you</span>' : ''}</td>
          <td data-label="Email">${escapeHtml(u.email)}</td>
          <td data-label="Role">${escapeHtml(ROLE_LABELS[u.role] || u.role)}</td>
          <td data-label="Status"><span class="tag" style="color:${u.status === 'active' ? 'var(--green)' : 'var(--oxblood)'};">${escapeHtml(u.status)}</span></td>
          <td data-label="Last signed in">${u.last_login_at ? escapeHtml(String(u.last_login_at).slice(0, 16).replace('T', ' ')) : 'Never'}</td>
          <td style="white-space:nowrap; font-size:12.5px;">
            ${
              u.id === currentUser.id
                ? ''
                : `<form method="post" action="/admin/users/${u.id}/status" style="display:inline;">
                     <input type="hidden" name="status" value="${u.status === 'active' ? 'disabled' : 'active'}">
                     <button class="chip" type="submit" style="cursor:pointer;">${u.status === 'active' ? 'Disable' : 'Re-enable'}</button>
                   </form>`
            }
            <form method="post" action="/admin/users/${u.id}/reset-password" style="display:inline;" onsubmit="return confirm('Set a new temporary password for ${escapeHtml(u.name)}? Tell them the new password directly -- it will not be emailed.');">
              <button class="chip" type="submit" style="cursor:pointer;">Reset password</button>
            </form>
          </td>
        </tr>`
      )
      .join('')}
  </tbody>
</table>

<div class="panel" style="padding:22px; max-width:480px;">
  <h3 class="serif" style="font-size:20px; margin:0 0 6px;">Add an employee</h3>
  <p class="muted" style="font-size:12.5px; margin:0 0 16px;">
    Set a temporary password here and tell them directly -- it is not emailed. They can change
    it from "My account" once signed in.
  </p>
  <form method="post" action="/admin/users/create">
    <div class="field"><label for="u_name">Name</label><input id="u_name" name="name" required maxlength="120"></div>
    <div class="field"><label for="u_email">Email</label><input id="u_email" name="email" type="email" required maxlength="200"></div>
    <div class="field"><label for="u_role">Role</label>
      <select id="u_role" name="role">
        ${ROLES.filter((r) => r !== 'owner')
          .map((r) => `<option value="${r}">${ROLE_LABELS[r]}</option>`)
          .join('')}
        <option value="owner">Owner (full access, including managing other employees)</option>
      </select>
    </div>
    <div class="field"><label for="u_password">Temporary password</label><input id="u_password" name="password" required minlength="8" maxlength="72">
      <span class="hint">At least 8 characters. Tell it to them yourself.</span>
    </div>
    <button class="btn btn-block" type="submit">Add employee</button>
  </form>
</div>

<div class="notice" style="margin-top:28px; max-width:640px; font-size:12.5px; line-height:1.7;">
  <strong>What each role can reach:</strong><br>
  <strong>Owner</strong> — everything, including pricing, rates, the catalogue, and managing employees.<br>
  <strong>Authenticator</strong> — orders (view and advance) and certificates.<br>
  <strong>Warehouse</strong> — orders (view and advance) and listings, for packing and dispatch.<br>
  <strong>Support</strong> — orders (view only), seller applications, and sourcing requests.
</div>`);
}

async function createAdminUser(request, env, currentUser) {
  const form = await request.formData();
  const name = String(form.get('name') || '').trim();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  const role = ROLES.includes(form.get('role')) ? form.get('role') : 'support';

  if (!name || !email || password.length < 8) {
    return redirect('/admin/users?error=' + encodeURIComponent('Name, email and an at-least-8-character password are all required.'));
  }

  const existing = await env.DB.prepare('SELECT id FROM admin_users WHERE email = ? COLLATE NOCASE').bind(email).first();
  if (existing) {
    return redirect('/admin/users?error=' + encodeURIComponent(`${email} already has an account.`));
  }

  const hash = await hashPassword(password);
  const result = await env.DB.prepare('INSERT INTO admin_users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .bind(name, email, hash, role)
    .run();
  await logAudit(env, currentUser, 'admin_user.created', {
    entityType: 'admin_user',
    entityId: result.meta.last_row_id,
    detail: `${name} <${email}>, role ${role}`,
    request,
  });

  return redirect('/admin/users');
}

async function setAdminUserStatus(request, env, userId, currentUser) {
  if (userId === currentUser.id) return redirect('/admin/users'); // never let someone lock themselves out
  const form = await request.formData();
  const status = form.get('status') === 'disabled' ? 'disabled' : 'active';
  await env.DB.prepare('UPDATE admin_users SET status = ? WHERE id = ?').bind(status, userId).run();
  await logAudit(env, currentUser, 'admin_user.status_changed', { entityType: 'admin_user', entityId: userId, detail: `status -> ${status}`, request });
  return redirect('/admin/users');
}

async function resetAdminUserPassword(request, env, userId, currentUser) {
  const temp = randomTempPassword();
  const hash = await hashPassword(temp);
  await env.DB.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').bind(hash, userId).run();
  await logAudit(env, currentUser, 'admin_user.password_reset', { entityType: 'admin_user', entityId: userId, request });
  // Rendered directly rather than redirected with the password in the URL -- a redirect would
  // put it in the browser's address bar and history for a page that gets shared and revisited.
  return adminUsersPage(env, currentUser, null, `New temporary password: ${temp} — tell them directly, it will not be shown again.`);
}

function changePasswordForm(error, notice) {
  return `
<h2 class="serif" style="font-size:32px; margin:0 0 20px;">My account</h2>
<div class="panel" style="padding:22px; max-width:420px;">
  <h3 class="serif" style="font-size:20px; margin:0 0 14px;">Change password</h3>
  ${notice ? `<div class="notice notice-good" style="margin-bottom:14px;">${escapeHtml(notice)}</div>` : ''}
  ${error ? `<div class="notice notice-bad" style="margin-bottom:14px;">${escapeHtml(error)}</div>` : ''}
  <form method="post" action="/admin/account/password">
    <div class="field"><label for="current_password">Current password</label><input id="current_password" name="current_password" type="password" required autocomplete="current-password"></div>
    <div class="field"><label for="new_password">New password</label><input id="new_password" name="new_password" type="password" required minlength="8" maxlength="72" autocomplete="new-password"></div>
    <button class="btn btn-block" type="submit">Update password</button>
  </form>
</div>`;
}

async function changeOwnPassword(request, env, currentUser) {
  const form = await request.formData();
  const current = String(form.get('current_password') || '');
  const next = String(form.get('new_password') || '');

  const ok = await verifyPassword(current, currentUser.password_hash);
  if (!ok) return adminHtml(changePasswordForm('Your current password is not right.'));
  if (next.length < 8) return adminHtml(changePasswordForm('The new password must be at least 8 characters.'));

  const hash = await hashPassword(next);
  await env.DB.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').bind(hash, currentUser.id).run();
  await logAudit(env, currentUser, 'admin_user.password_changed_self', { entityType: 'admin_user', entityId: currentUser.id, request });
  return adminHtml(changePasswordForm(null, 'Password updated.'));
}

// Audit log --------------------------------------------------------------------------
// Read-only, immutable (no update/delete route exists for this table), Owner-only.

async function auditLogPage(env, entityFilter) {
  const binds = [];
  let where = '';
  if (entityFilter) {
    where = 'WHERE entity_type = ?';
    binds.push(entityFilter);
  }
  const { results } = await env.DB.prepare(
    `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT 300`
  )
    .bind(...binds)
    .all();

  const entityTypes = ['product', 'offer', 'order', 'certificate', 'admin_user', 'rate', 'seller_application'];

  return adminHtml(`
<h2 class="serif" style="font-size:32px; margin:0 0 8px;">Audit log</h2>
<p class="muted" style="margin:0 0 20px; font-size:13.5px; max-width:640px;">
  Every price change, certificate, order stage, rate edit and employee-account change, with
  who did it and when. Nothing here is ever edited or deleted -- the most recent 300 entries
  are shown.
</p>

<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px;">
  <a class="chip${!entityFilter ? ' active' : ''}" href="/admin/audit">All</a>
  ${entityTypes
    .map((t) => `<a class="chip${entityFilter === t ? ' active' : ''}" href="/admin/audit?entity=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`)
    .join('')}
</div>

${
  results.length
    ? `<table class="table">
      <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
      <tbody>
        ${results
          .map(
            (r) => `<tr>
              <td data-label="When" style="white-space:nowrap; font-size:12px;">${escapeHtml(String(r.created_at).slice(0, 16).replace('T', ' '))}</td>
              <td data-label="Who">${escapeHtml(r.admin_name)}<div style="font-size:11px; color:var(--faint);">${escapeHtml(r.admin_email)}</div></td>
              <td data-label="Action"><code style="font-size:11.5px;">${escapeHtml(r.action)}</code></td>
              <td data-label="Entity">${r.entity_type ? `${escapeHtml(r.entity_type)}${r.entity_id ? ` #${escapeHtml(String(r.entity_id))}` : ''}` : '—'}</td>
              <td data-label="Detail" style="font-size:12.5px; max-width:340px;">${escapeHtml(r.detail || '')}</td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>`
    : '<div class="notice">Nothing logged yet.</div>'
}`);
}
