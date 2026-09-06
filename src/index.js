import { STYLES, layout, html, redirect, escapeHtml, etaDates } from './render.js';
import * as db from './db.js';
import { homePage } from './views/home.js';
import { categoryPage } from './views/category.js';
import { productPage } from './views/product.js';
import { cartPage, checkoutPage, orderPage, trackPage, orderPlacedPage } from './views/checkout.js';
import { verifyPage, certificatePage } from './views/verify.js';
import { adminRouter } from './admin.js';
import { verifyCertificate } from './certificates.js';
import { serveImage } from './images.js';
import { readCart, writeCart, sameOrigin, publicRef } from './session.js';

export default {
  async fetch(request, env, ctx) {
    try {
      return await route(request, env, ctx);
    } catch (err) {
      console.error('Unhandled error:', err && err.stack ? err.stack : err);
      return html(
        layout({
          title: 'Something went wrong',
          env,
          body: `<section class="section"><h2 class="serif" style="font-size:34px;">Something went wrong</h2>
                 <p class="muted">We have logged it. Try again, or <a href="/">start from the homepage</a>.</p></section>`,
        }),
        500
      );
    }
  },
};

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();

  if (path.startsWith('/img/')) {
    return serveImage(env, decodeURIComponent(path.slice(5)));
  }

  if (path === '/favicon.svg' || path === '/favicon.ico') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#16130f"/><text x="16" y="22" font-family="Georgia,serif" font-size="17" fill="#cba25a" text-anchor="middle">M</text></svg>`;
    return new Response(svg, {
      headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' },
    });
  }

  if (path === '/styles.css') {
    return new Response(STYLES, {
      headers: {
        'content-type': 'text/css; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    });
  }

  if (method === 'POST' && !sameOrigin(request)) {
    return new Response('Bad origin', { status: 403 });
  }

  if (path.startsWith('/admin')) {
    return adminRouter(request, env, path);
  }

  const cart = readCart(request);

  if (path === '/') return homeRoute(request, env, cart);
  if (path === '/search') return searchRoute(request, env, url, cart);
  if (path.startsWith('/c/')) return categoryRoute(request, env, url, path.slice(3), cart);
  if (path.startsWith('/p/')) return productRoute(request, env, url, path.slice(3), cart);

  if (path === '/cart') return cartRoute(request, env, cart);
  if (path === '/cart/add' && method === 'POST') return cartAdd(request, env, cart);
  if (path === '/cart/remove' && method === 'POST') return cartRemove(request, env, cart);

  if (path === '/checkout' && method === 'GET') return checkoutRoute(request, env, cart);
  if (path === '/checkout' && method === 'POST') return checkoutSubmit(request, env, cart);

  if (path === '/track') return trackRoute(request, env, url, cart);
  if (path.startsWith('/order/')) return orderRoute(request, env, decodeURIComponent(path.slice(7)), cart);

  if (path === '/verify') return verifyRoute(request, env, url, cart);
  if (path.startsWith('/certificate/'))
    return certificateRoute(request, env, decodeURIComponent(path.slice(13)), cart);

  if (path === '/sourcing-requests' && method === 'POST') return sourcingSubmit(request, env);

  const staticPage = STATIC_PAGES[path];
  if (staticPage) {
    return html(
      layout({ title: staticPage.title, env, cartCount: cart.length, body: staticPage.body(env) })
    );
  }

  return html(
    layout({
      title: 'Not found',
      env,
      cartCount: cart.length,
      body: `<section class="section"><h2 class="serif" style="font-size:34px;">Page not found</h2>
             <p class="muted">That page does not exist. <a href="/c/all">Browse listings</a>.</p></section>`,
    }),
    404
  );
}

// Routes ---------------------------------------------------------------------

async function homeRoute(request, env, cart) {
  const [categories, newArrivals, regions, stats] = await Promise.all([
    db.getCategories(env.DB),
    db.listProducts(env.DB, { sort: 'new', limit: 8 }),
    db.getSourcingRegions(env.DB),
    db.getStats(env.DB),
  ]);

  // Listing counts per category, for the category tiles.
  const { results: counts } = await env.DB.prepare(
    `SELECT c.slug, COUNT(o.id) AS listing_count, MIN(o.landed_price) AS from_price
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_published = 1
       LEFT JOIN offers o ON o.product_id = p.id AND o.status = 'active'
      GROUP BY c.slug`
  ).all();
  const countMap = new Map((counts || []).map((r) => [r.slug, r]));
  for (const c of categories) {
    const row = countMap.get(c.slug);
    c.listing_count = row?.listing_count || 0;
    c.from_price = row?.from_price || null;
  }

  return html(
    layout({
      env,
      cartCount: cart.length,
      description:
        'Authenticated imports. Every verified seller compared, every piece checked twice, delivery windows shown upfront.',
      body: homePage({ categories, newArrivals, regions, stats, env }),
    })
  );
}

function parseFilters(url) {
  const f = {};
  const max = Number(url.searchParams.get('max'));
  const min = Number(url.searchParams.get('min'));
  const lead = Number(url.searchParams.get('lead'));
  if (Number.isFinite(max) && max > 0) f.max = max;
  if (Number.isFinite(min) && min > 0) f.min = min;
  if (Number.isFinite(lead) && lead > 0) f.lead = lead;
  if (url.searchParams.get('under_retail') === '1') f.under_retail = 1;
  const sort = url.searchParams.get('sort');
  if (['price_asc', 'price_desc', 'new', 'fastest'].includes(sort)) f.sort = sort;
  return f;
}

async function categoryRoute(request, env, url, slug, cart) {
  const category = slug === 'all' ? null : await db.getCategoryBySlug(env.DB, slug);
  if (slug !== 'all' && !category) {
    return html(
      layout({
        title: 'Not found',
        env,
        cartCount: cart.length,
        body: `<section class="section"><h2 class="serif" style="font-size:34px;">No such category</h2>
               <p class="muted"><a href="/c/all">See everything</a>.</p></section>`,
      }),
      404
    );
  }

  const f = parseFilters(url);
  const products = await db.listProducts(env.DB, {
    categorySlug: slug,
    maxPrice: f.max,
    minPrice: f.min,
    underRetail: !!f.under_retail,
    maxLead: f.lead,
    sort: f.sort,
    limit: 48,
  });

  return html(
    layout({
      title: category ? category.name : 'All listings',
      env,
      cartCount: cart.length,
      body: categoryPage({ category, products, filters: f, total: products.length }),
    })
  );
}

async function searchRoute(request, env, url, cart) {
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const products = q ? await db.listProducts(env.DB, { search: q, limit: 48 }) : [];
  return html(
    layout({
      title: q ? `Search: ${q}` : 'Search',
      env,
      cartCount: cart.length,
      body: categoryPage({
        category: { name: q ? `Results for “${q}”` : 'Search', blurb: null },
        products,
        filters: {},
        total: products.length,
      }),
    })
  );
}

async function productRoute(request, env, url, slug, cart) {
  const product = await db.getProductBySlug(env.DB, slug);
  if (!product) {
    return html(
      layout({
        title: 'Not found',
        env,
        cartCount: cart.length,
        body: `<section class="section"><h2 class="serif" style="font-size:34px;">Listing not found</h2>
               <p class="muted">It may have sold. <a href="/c/all">Browse what is live</a>.</p></section>`,
      }),
      404
    );
  }

  const [offers, images, related] = await Promise.all([
    db.getOffersForProduct(env.DB, product.id),
    db.getProductImages(env.DB, product.id),
    db.getRelatedProducts(env.DB, product),
  ]);

  return html(
    layout({
      title: product.title,
      description: product.description,
      env,
      cartCount: cart.length,
      body: productPage({
        product,
        offers,
        images,
        related,
        selectedSize: url.searchParams.get('size'),
        env,
      }),
    })
  );
}

// Cart items are always rebuilt from the database.
async function loadCartItems(env, cart) {
  const items = [];
  for (const id of cart) {
    const offer = await db.getOfferById(env.DB, id);
    if (offer && offer.status === 'active') items.push(offer);
  }
  return items;
}

async function cartRoute(request, env, cart) {
  const items = await loadCartItems(env, cart);
  const total = items.reduce((s, i) => s + i.landed_price, 0);
  return html(
    layout({ title: 'Your bag', env, cartCount: items.length, body: cartPage({ items, total }) })
  );
}

async function cartAdd(request, env, cart) {
  const form = await request.formData();
  const offerId = Number(form.get('offer_id'));
  const offer = Number.isInteger(offerId) ? await db.getOfferById(env.DB, offerId) : null;
  if (!offer || offer.status !== 'active') return redirect('/cart');
  const next = [...new Set([...cart, offerId])];
  return redirect('/cart', { 'set-cookie': writeCart(next) });
}

async function cartRemove(request, env, cart) {
  const form = await request.formData();
  const offerId = Number(form.get('offer_id'));
  const next = cart.filter((id) => id !== offerId);
  return redirect('/cart', { 'set-cookie': writeCart(next) });
}

async function checkoutRoute(request, env, cart) {
  const items = await loadCartItems(env, cart);
  if (!items.length) return redirect('/cart');
  const total = items.reduce((s, i) => s + i.landed_price, 0);
  return html(
    layout({ title: 'Checkout', env, cartCount: items.length, body: checkoutPage({ items, total }) })
  );
}

async function checkoutSubmit(request, env, cart) {
  const items = await loadCartItems(env, cart);
  if (!items.length) return redirect('/cart');

  const form = await request.formData();
  const get = (k) => String(form.get(k) || '').trim();

  const data = {
    buyerName: get('name'),
    buyerEmail: get('email'),
    buyerPhone: get('phone'),
    addressLine1: get('address1'),
    addressLine2: get('address2'),
    city: get('city'),
    state: get('state'),
    pincode: get('pincode'),
  };

  const total = items.reduce((s, i) => s + i.landed_price, 0);
  const errors = [];
  if (!data.buyerName) errors.push('a name');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.buyerEmail)) errors.push('a valid email');
  if (data.buyerPhone.replace(/\D/g, '').length < 8) errors.push('a valid phone number');
  if (!data.addressLine1) errors.push('an address');
  if (!data.city) errors.push('a city');
  if (!data.state) errors.push('a state');
  if (!/^\d{6}$/.test(data.pincode)) errors.push('a six-digit PIN code');

  if (errors.length) {
    return html(
      layout({
        title: 'Checkout',
        env,
        cartCount: items.length,
        body: checkoutPage({ items, total, error: `Please enter ${errors.join(', ')}.` }),
      }),
      400
    );
  }

  // One order per offer. Prices come from the database row, never the form.
  let firstRef = null;
  for (const offer of items) {
    const eta = etaDates(offer.lead_days_min, offer.lead_days_max);
    const ref = publicRef();
    if (!firstRef) firstRef = ref;
    await db.createOrder(env.DB, {
      publicRef: ref,
      offerId: offer.id,
      productId: offer.product_id,
      sizeLabel: offer.size_label,
      amount: offer.landed_price,
      sellerPrice: offer.seller_price,
      duty: offer.duty,
      authFee: offer.auth_fee,
      shipping: offer.shipping,
      etaMin: eta.from,
      etaMax: eta.to,
      ...data,
    });
  }

  const order = await db.getOrderByRef(env.DB, firstRef);
  return html(
    layout({
      title: 'Order placed',
      env,
      cartCount: 0,
      body: orderPlacedPage({ order }),
    }),
    200,
    { 'set-cookie': writeCart([]) }
  );
}

async function trackRoute(request, env, url, cart) {
  const ref = (url.searchParams.get('ref') || '').trim();
  if (!ref) {
    return html(layout({ title: 'Track order', env, cartCount: cart.length, body: trackPage({}) }));
  }
  const order = await db.getOrderByRef(env.DB, ref);
  if (!order) {
    return html(
      layout({
        title: 'Track order',
        env,
        cartCount: cart.length,
        body: trackPage({ error: `No order found with reference ${escapeHtml(ref)}.` }),
      }),
      404
    );
  }
  return redirect(`/order/${encodeURIComponent(order.public_ref)}`);
}

async function orderRoute(request, env, ref, cart) {
  const order = await db.getOrderByRef(env.DB, ref);
  if (!order) {
    return html(
      layout({
        title: 'Track order',
        env,
        cartCount: cart.length,
        body: trackPage({ error: 'No order with that reference.' }),
      }),
      404
    );
  }
  const events = await db.getOrderEvents(env.DB, order.id);
  const certificate = order.certificate_no
    ? await env.DB.prepare(
        `SELECT c.*, a.initials AS authenticator_initials
           FROM certificates c LEFT JOIN authenticators a ON a.id = c.authenticator_id
          WHERE c.certificate_no = ?`
      )
        .bind(order.certificate_no)
        .first()
    : null;

  return html(
    layout({
      title: `Order ${order.public_ref}`,
      env,
      cartCount: cart.length,
      body: orderPage({ order, events, certificate }),
    })
  );
}

async function verifyRoute(request, env, url, cart) {
  const no = (url.searchParams.get('no') || '').trim();
  const code = (url.searchParams.get('code') || '').trim();
  const result = no ? await verifyCertificate(env.DB, no, code) : null;
  return html(
    layout({
      title: 'Verify a certificate',
      env,
      cartCount: cart.length,
      body: verifyPage({ query: no, code, result }),
    })
  );
}

async function certificateRoute(request, env, certNo, cart) {
  const cert = await env.DB.prepare(
    `SELECT c.*, a.initials AS authenticator_initials
       FROM certificates c LEFT JOIN authenticators a ON a.id = c.authenticator_id
      WHERE c.certificate_no = ? AND c.status = 'valid'`
  )
    .bind(String(certNo).toUpperCase())
    .first();

  if (!cert) {
    return html(
      layout({
        title: 'Certificate',
        env,
        cartCount: cart.length,
        body: `<section class="section"><h2 class="serif" style="font-size:34px;">No such certificate</h2>
               <p class="muted"><a href="/verify">Try the verifier</a>.</p></section>`,
      }),
      404
    );
  }

  return html(
    layout({
      title: `Certificate ${cert.certificate_no}`,
      env,
      cartCount: cart.length,
      body: certificatePage({ cert, siteName: env.SITE_NAME || 'Mintmark' }),
    })
  );
}

async function sourcingSubmit(request, env) {
  const form = await request.formData();
  const item = String(form.get('item') || '').trim().slice(0, 200);
  const contact = String(form.get('contact') || '').trim().slice(0, 120);
  if (!item || !contact) return redirect('/?sourcing=invalid');

  const budgetRaw = String(form.get('budget') || '').replace(/[^\d]/g, '');
  await db.createSourcingRequest(env.DB, {
    item,
    sizeLabel: String(form.get('size') || '').trim().slice(0, 40) || null,
    budgetMax: budgetRaw ? Number(budgetRaw) : null,
    name: String(form.get('name') || '').trim().slice(0, 120) || null,
    contact,
    notes: String(form.get('notes') || '').trim().slice(0, 1000) || null,
  });
  return redirect('/?sourcing=ok');
}

// Simple content pages ------------------------------------------------------

const STATIC_PAGES = {
  '/authentication': {
    title: 'Authentication',
    body: () => `
<section class="section" style="max-width:820px;">
  <span class="tag gold">Our guarantee</span>
  <h2 class="serif" style="font-size:38px; margin:10px 0 16px;">Two checks, one seal, full traceability.</h2>
  <p style="font-size:16px; line-height:1.75; color:#4a463c;">
    Nothing is listed until it has been inspected in hand overseas, and nothing ships until it has
    been re-checked here. Each piece travels in a tamper-evident seal with a numbered certificate
    you can verify online.
  </p>
  <ol style="font-size:15px; line-height:1.8; color:#4a463c; padding-left:20px;">
    <li><strong>Seller legit check.</strong> Every KYC-verified seller authenticates a piece and uploads the report before we let it go live.</li>
    <li><strong>In-house inspection.</strong> On arrival at our facility an authenticator runs an independent 30-point check.</li>
    <li><strong>Certificate and seal.</strong> We issue a numbered certificate and seal the package. The number encodes the year, the source city and the category.</li>
    <li><strong>Refund if it fails.</strong> If a piece ever fails an independent check, we refund it in full.</li>
  </ol>
  <a class="btn" href="/verify">Verify a certificate</a>
</section>`,
  },
  '/shipping': {
    title: 'Shipping & import',
    body: () => `
<section class="section" style="max-width:820px;">
  <span class="tag gold">Shipping &amp; import</span>
  <h2 class="serif" style="font-size:38px; margin:10px 0 16px;">Why it takes two to four weeks.</h2>
  <p style="font-size:16px; line-height:1.75; color:#4a463c;">
    Everything here is sourced abroad. A typical order spends 1–2 days with the seller, 2–3 days in
    authentication, 6–8 days in transit and customs, and 2–3 days with the local courier. We show
    the window on every listing before you buy, not after.
  </p>
  <p style="font-size:16px; line-height:1.75; color:#4a463c;">
    <strong>Duties are included in the price you see.</strong> We pay them before the parcel enters
    the country, so nothing further is payable on delivery. Shipments are insured door to door and
    tracked at every stage.
  </p>
</section>`,
  },
  '/returns': {
    title: 'Returns',
    body: () => `
<section class="section" style="max-width:820px;">
  <span class="tag gold">Returns</span>
  <h2 class="serif" style="font-size:38px; margin:10px 0 16px;">Returns policy</h2>
  <div class="notice">This page still needs your real policy before launch. The text below is a placeholder.</div>
  <p style="font-size:16px; line-height:1.75; color:#4a463c; margin-top:18px;">
    If a piece fails an independent authentication check, we refund it in full, including shipping.
    [YOUR RETURNS WINDOW AND CONDITIONS GO HERE.]
  </p>
</section>`,
  },
  '/sell': {
    title: 'Sell with us',
    body: () => `
<section class="section" style="max-width:820px;">
  <span class="tag gold">Sellers</span>
  <h2 class="serif" style="font-size:38px; margin:10px 0 16px;">Sell with us</h2>
  <p style="font-size:16px; line-height:1.75; color:#4a463c;">
    We work with a vetted network of dealers and boutiques. Sellers are KYC-verified, must upload an
    authentication report for every listing, and are paid out after the piece clears our in-house check.
  </p>
  <h3 class="serif" id="requirements" style="font-size:24px; margin:28px 0 10px;">Requirements</h3>
  <ul style="font-size:15px; line-height:1.8; color:#4a463c; padding-left:20px;">
    <li>Business or trader KYC documentation</li>
    <li>An authentication report per listing</li>
    <li>Dispatch within two business days of a sale</li>
  </ul>
  <h3 class="serif" id="payouts" style="font-size:24px; margin:28px 0 10px;">Payouts</h3>
  <p style="font-size:15px; line-height:1.8; color:#4a463c;">
    Paid after the piece passes our inspection. [YOUR COMMISSION AND PAYOUT TERMS GO HERE.]
  </p>
</section>`,
  },
  '/about': {
    title: 'About',
    body: (env) => `
<section class="section" style="max-width:820px;">
  <span class="tag gold">About</span>
  <h2 class="serif" style="font-size:38px; margin:10px 0 16px;">${escapeHtml(env?.SITE_NAME || 'Mintmark')}</h2>
  <p style="font-size:16px; line-height:1.75; color:#4a463c;">
    A mint mark is the stamp struck into a coin that says which mint made it — the mark that proves
    where something genuinely came from. That is the whole business: rare pieces, sourced abroad,
    proven before they ship.
  </p>
  <div class="notice" style="margin-top:18px;">Add your real story, team and registered business details before launch.</div>
</section>`,
  },
  '/contact': {
    title: 'Contact',
    body: (env) => `
<section class="section" style="max-width:820px;">
  <span class="tag gold">Contact</span>
  <h2 class="serif" style="font-size:38px; margin:10px 0 16px;">Talk to us</h2>
  <p style="font-size:16px; line-height:1.75; color:#4a463c;">
    WhatsApp ${escapeHtml(env?.SUPPORT_WHATSAPP || '[YOUR NUMBER]')} · Monday to Saturday, 10:30am–7:00pm.
  </p>
  <p style="font-size:16px; line-height:1.75; color:#4a463c;">[YOUR EMAIL] · [YOUR REGISTERED ADDRESS]</p>
</section>`,
  },
  '/privacy': {
    title: 'Privacy',
    body: () => `
<section class="section" style="max-width:820px;">
  <h2 class="serif" style="font-size:38px; margin:0 0 16px;">Privacy</h2>
  <div class="notice">Placeholder. You need a real privacy policy before launch — you are collecting names, addresses and phone numbers.</div>
</section>`,
  },
  '/terms': {
    title: 'Terms',
    body: () => `
<section class="section" style="max-width:820px;">
  <h2 class="serif" style="font-size:38px; margin:0 0 16px;">Terms</h2>
  <div class="notice">Placeholder. Have these drafted before you take money.</div>
</section>`,
  },
};
