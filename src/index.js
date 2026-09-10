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
import { computeOrderRisk } from './risk.js';
import {
  authenticationPage,
  shippingPage,
  returnsPage,
  termsPage,
  privacyPage,
  aboutPage,
  contactPage,
  cookiesPage,
  sellPage,
} from './views/pages.js';
import { readCart, writeCart, readCoupon, writeCoupon, clearCoupon, sameOrigin, publicRef } from './session.js';
import { findCoupon, evaluateCoupon } from './coupons.js';
import { getClerkAuth, getClerkUserProfile, verifyClerkWebhook, clerkConfigured } from './clerk.js';
import { sendWelcomeEmail } from './email.js';
import { handleChat } from './chatbot.js';
import { signInPage, signUpPage, accountPage, clerkNotConfiguredPage } from './views/account.js';

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
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#111111"/><path d="M43 168V95a57 57 0 0 1 114 0v73" fill="none" stroke="#b4935a" stroke-width="13"/><g stroke="#b4935a" stroke-width="16" fill="none" transform="translate(100 105) scale(.58) translate(-100.5 -100)"><path d="M37 60V140"/><path d="M37 60h31a16 16 0 0 1 0 32H37"/><path d="M56 92l32 48"/><path d="M116 60v80"/><path d="M164 60v80"/><path d="M116 100h48"/></g></svg>`;
    return new Response(svg, {
      headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' },
    });
  }

  if (path === '/robots.txt') {
    const site = env?.SITE_URL || 'https://rarehaus.in';
    return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /cart\nDisallow: /checkout\nDisallow: /account\n\nSitemap: ${site}/sitemap.xml\n`, {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' },
    });
  }

  if (path === '/sitemap.xml') {
    return sitemapRoute(env);
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

  if (path === '/webhooks/clerk' && method === 'POST') return clerkWebhook(request, env, ctx);
  if (path === '/chat' && method === 'POST') return handleChat(request, env);

  if (path.startsWith('/admin')) {
    return adminRouter(request, env, path);
  }

  const cart = readCart(request);
  const user = await getSessionUser(request, env);

  if (path === '/account/sign-in') {
    return clerkConfigured(env)
      ? html(layout({ title: 'Sign in', env, user, cartCount: cart.length, body: signInPage({ publishableKey: env.CLERK_PUBLISHABLE_KEY }) }))
      : html(layout({ title: 'Sign in', env, user, cartCount: cart.length, body: clerkNotConfiguredPage() }));
  }
  if (path === '/account/sign-up') {
    return clerkConfigured(env)
      ? html(layout({ title: 'Create an account', env, user, cartCount: cart.length, body: signUpPage({ publishableKey: env.CLERK_PUBLISHABLE_KEY }) }))
      : html(layout({ title: 'Create an account', env, user, cartCount: cart.length, body: clerkNotConfiguredPage() }));
  }
  if (path === '/account') return accountRoute(request, env, cart, user);

  if (path === '/') return homeRoute(request, env, cart, user);
  if (path === '/search') return searchRoute(request, env, url, cart, user);
  if (path.startsWith('/c/')) return categoryRoute(request, env, url, path.slice(3), cart, user);
  if (path.startsWith('/p/')) return productRoute(request, env, url, path.slice(3), cart, user);

  if (path === '/cart') return cartRoute(request, env, cart, user);
  if (path === '/cart/add' && method === 'POST') return cartAdd(request, env, cart, user);
  if (path === '/cart/remove' && method === 'POST') return cartRemove(request, env, cart, user);
  if (path === '/cart/coupon' && method === 'POST') return cartApplyCoupon(request, env, cart, user);
  if (path === '/cart/coupon/remove' && method === 'POST') return cartRemoveCoupon(request, env, cart, user);

  if (path === '/checkout' && method === 'GET') return checkoutRoute(request, env, cart, user);
  if (path === '/checkout' && method === 'POST') return checkoutSubmit(request, env, cart, user);

  if (path === '/track') return trackRoute(request, env, url, cart, user);
  if (path.startsWith('/order/')) return orderRoute(request, env, decodeURIComponent(path.slice(7)), cart, user);

  if (path === '/verify') return verifyRoute(request, env, url, cart, user);
  if (path.startsWith('/certificate/'))
    return certificateRoute(request, env, decodeURIComponent(path.slice(13)), cart, user);

  if (path === '/sourcing-requests' && method === 'POST') return sourcingSubmit(request, env);

  if (path === '/sell' && method === 'POST') return sellerApply(request, env, cart, user);

  const staticPage = STATIC_PAGES[path];
  if (staticPage) {
    return html(
      layout({ title: staticPage.title, env, user, cartCount: cart.length, body: staticPage.body(env, url) })
    );
  }

  return html(
    layout({
      title: 'Not found',
      env,
      user,
      cartCount: cart.length,
      body: `<section class="section"><h2 class="serif" style="font-size:34px;">Page not found</h2>
             <p class="muted">That page does not exist. <a href="/c/all">Browse listings</a>.</p></section>`,
    }),
    404
  );
}

// Buyer accounts --------------------------------------------------------------
// Sign-in itself (password, Google, whatever the Clerk dashboard has enabled) is entirely
// Clerk's -- this file only asks "is this request's Clerk session valid, and if so whose",
// then mirrors the minimum locally so orders can be linked without an extra API round trip
// on every page.

async function getSessionUser(request, env) {
  const auth = await getClerkAuth(request, env);
  if (!auth) return null;
  const local = await db.getUserByClerkId(env.DB, auth.userId);
  if (local) return local;
  // The user.created webhook may not have landed yet (or, rarely, may never land) -- fetch
  // the profile directly rather than leaving a signed-in buyer without a local row.
  const profile = await getClerkUserProfile(env, auth.userId);
  return db.upsertUserFromClerk(env.DB, { clerkUserId: auth.userId, ...profile });
}

async function accountRoute(request, env, cart, user) {
  if (!user) return redirect('/account/sign-in');
  const orders = await db.listOrdersForUser(env.DB, user.id);
  return html(
    layout({
      title: 'Your account',
      env,
      user,
      cartCount: cart.length,
      body: accountPage({ user, orders, publishableKey: env.CLERK_PUBLISHABLE_KEY }),
    })
  );
}

// Clerk's user.created webhook: the reliable path for the welcome email and for having the
// local row ready before the buyer's first page load after signing up. Signature verified
// via Svix HMAC (see clerk.js) before the payload is trusted.
async function clerkWebhook(request, env, ctx) {
  const event = await verifyClerkWebhook(request, env.CLERK_WEBHOOK_SECRET);
  if (!event) return new Response('Invalid signature', { status: 400 });

  if (event.type === 'user.created') {
    const d = event.data;
    const email =
      d.email_addresses?.find((e) => e.id === d.primary_email_address_id)?.email_address ||
      d.email_addresses?.[0]?.email_address ||
      '';
    const name = [d.first_name, d.last_name].filter(Boolean).join(' ') || email;
    if (email) {
      await db.upsertUserFromClerk(env.DB, { clerkUserId: d.id, email, name });
      ctx.waitUntil(sendWelcomeEmail(env, { to: email, name }).catch((err) => console.error('Welcome email failed:', err)));
    }
  }

  return new Response('ok');
}

// Routes ---------------------------------------------------------------------

// Lists every crawlable URL for search engines: the static pages, every category, and every
// published product. Regenerated on each request rather than cached, so a newly listed piece
// is discoverable immediately rather than waiting on a stale cache.
async function sitemapRoute(env) {
  const site = env?.SITE_URL || 'https://rarehaus.in';
  const staticPaths = [
    '/', '/c/all', '/about', '/authentication', '/shipping', '/returns',
    '/terms', '/privacy', '/cookies', '/sell', '/contact', '/track', '/verify',
  ];

  const [categories, { results: products }] = await Promise.all([
    db.getCategories(env.DB),
    env.DB.prepare("SELECT slug FROM products WHERE is_published = 1").all(),
  ]);

  const urls = [
    ...staticPaths.map((p) => `${site}${p}`),
    ...categories.map((c) => `${site}/c/${c.slug}`),
    ...(products || []).map((p) => `${site}/p/${p.slug}`),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${escapeHtml(u)}</loc></url>`)
    .join('\n')}\n</urlset>\n`;

  return new Response(body, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}

async function homeRoute(request, env, cart, user) {
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

  // A category tile shows the cover photo of its most recently listed piece instead of
  // sitting on a bare placeholder -- picks the newest published product in that category
  // with a live offer, falling back to an older one if the newest has no photo yet.
  const { results: tileImages } = await env.DB.prepare(
    `SELECT c.slug,
       (SELECT pi.url
          FROM products p
          JOIN product_images pi ON pi.product_id = p.id
         WHERE p.category_id = c.id AND p.is_published = 1
           AND EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id AND o.status = 'active')
         ORDER BY p.created_at DESC, pi.sort_order ASC
         LIMIT 1) AS image_url
       FROM categories c`
  ).all();
  const imageMap = new Map((tileImages || []).map((r) => [r.slug, r.image_url]));

  for (const c of categories) {
    const row = countMap.get(c.slug);
    c.listing_count = row?.listing_count || 0;
    c.from_price = row?.from_price || null;
    c.tile_image = imageMap.get(c.slug) || null;
  }

  return html(
    layout({
      env,
      user,
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
  const gender = url.searchParams.get('gender');
  if (['men', 'women', 'unisex'].includes(gender)) f.gender = gender;
  const sort = url.searchParams.get('sort');
  if (['price_asc', 'price_desc', 'new', 'fastest'].includes(sort)) f.sort = sort;
  return f;
}

async function categoryRoute(request, env, url, slug, cart, user) {
  const category = slug === 'all' ? null : await db.getCategoryBySlug(env.DB, slug);
  if (slug !== 'all' && !category) {
    return html(
      layout({
        title: 'Not found',
        env,
        user,
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
    gender: f.gender,
    sort: f.sort,
    limit: 48,
  });

  return html(
    layout({
      title: category ? category.name : 'All listings',
      env,
      user,
      cartCount: cart.length,
      body: categoryPage({ category, products, filters: f, total: products.length }),
    })
  );
}

async function searchRoute(request, env, url, cart, user) {
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const products = q ? await db.listProducts(env.DB, { search: q, limit: 48 }) : [];
  return html(
    layout({
      title: q ? `Search: ${q}` : 'Search',
      env,
      user,
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

async function productRoute(request, env, url, slug, cart, user) {
  const product = await db.getProductBySlug(env.DB, slug);
  if (!product) {
    return html(
      layout({
        title: 'Not found',
        env,
        user,
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
      user,
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

// Re-evaluates whatever coupon code is in the cookie against the live cart. Never trusts a
// stored discount amount -- only the code itself survives between requests.
async function loadCartCoupon(env, request, items) {
  const code = readCoupon(request);
  if (!code || !items.length) return null;
  const coupon = await findCoupon(env.DB, code);
  const result = evaluateCoupon(coupon, items);
  return { code, ...result };
}

async function cartRoute(request, env, cart, user) {
  const items = await loadCartItems(env, cart);
  const total = items.reduce((s, i) => s + i.landed_price, 0);
  const couponResult = await loadCartCoupon(env, request, items);
  const discount = couponResult?.ok ? couponResult.totalDiscount : 0;
  const couponError = new URL(request.url).searchParams.get('coupon_error');
  return html(
    layout({
      title: 'Your bag',
      env,
      user,
      cartCount: items.length,
      body: cartPage({ items, total, discount, couponResult, couponError }),
    })
  );
}

async function cartAdd(request, env, cart, user) {
  const form = await request.formData();
  const offerId = Number(form.get('offer_id'));
  const offer = Number.isInteger(offerId) ? await db.getOfferById(env.DB, offerId) : null;
  if (!offer || offer.status !== 'active') return redirect('/cart');
  const next = [...new Set([...cart, offerId])];
  return redirect('/cart', { 'set-cookie': writeCart(next) });
}

async function cartRemove(request, env, cart, user) {
  const form = await request.formData();
  const offerId = Number(form.get('offer_id'));
  const next = cart.filter((id) => id !== offerId);
  return redirect('/cart', { 'set-cookie': writeCart(next) });
}

async function cartApplyCoupon(request, env, cart, user) {
  const form = await request.formData();
  const code = String(form.get('code') || '');
  const items = await loadCartItems(env, cart);
  const coupon = await findCoupon(env.DB, code);
  const result = evaluateCoupon(coupon, items);
  if (!result.ok) {
    return redirect('/cart?coupon_error=' + encodeURIComponent(result.error));
  }
  return redirect('/cart', { 'set-cookie': writeCoupon(code) });
}

async function cartRemoveCoupon(request, env, cart, user) {
  return redirect('/cart', { 'set-cookie': clearCoupon() });
}

async function checkoutRoute(request, env, cart, user) {
  const items = await loadCartItems(env, cart);
  if (!items.length) return redirect('/cart');
  const total = items.reduce((s, i) => s + i.landed_price, 0);
  const couponResult = await loadCartCoupon(env, request, items);
  const discount = couponResult?.ok ? couponResult.totalDiscount : 0;
  return html(
    layout({
      title: 'Checkout',
      env,
      user,
      cartCount: items.length,
      body: checkoutPage({ items, total, discount, couponResult }),
    })
  );
}

async function checkoutSubmit(request, env, cart, user) {
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
        user,
        cartCount: items.length,
        body: checkoutPage({ items, total, error: `Please enter ${errors.join(', ')}.` }),
      }),
      400
    );
  }

  // Re-checked here rather than trusted from the cookie or the cart page's render -- the
  // coupon must still be valid, in date, under its use limit and applicable to this exact
  // cart at the moment of payment, not just when it was typed in.
  const couponResult = await loadCartCoupon(env, request, items);
  const appliedCoupon = couponResult?.ok ? couponResult : null;

  // One order per offer. Prices come from the database row, never the form.
  let firstRef = null;
  for (const offer of items) {
    const eta = etaDates(offer.lead_days_min, offer.lead_days_max);
    const ref = publicRef();
    if (!firstRef) firstRef = ref;
    const itemDiscount = appliedCoupon?.perItem.get(offer.id) || 0;
    const orderId = await db.createOrder(env.DB, {
      publicRef: ref,
      userId: user?.id,
      offerId: offer.id,
      productId: offer.product_id,
      sizeLabel: offer.size_label,
      amount: offer.landed_price - itemDiscount,
      sellerPrice: offer.seller_price,
      duty: offer.duty,
      authFee: offer.auth_fee,
      shipping: offer.shipping,
      discountAmount: itemDiscount,
      couponCode: appliedCoupon ? appliedCoupon.coupon.code : null,
      etaMin: eta.from,
      etaMax: eta.to,
      ...data,
    });

    // A flag here never blocks the order -- it is something for a human to glance at before
    // dispatch, not an automatic decline. See risk.js for exactly what it checks and why.
    const risk = await computeOrderRisk(env, {
      orderId,
      amount: offer.landed_price - itemDiscount,
      userId: user?.id,
      buyerEmail: data.buyerEmail,
      buyerPhone: data.buyerPhone,
      request,
    });
    if (risk.flags.length) {
      await env.DB.prepare('UPDATE orders SET risk_score = ?, risk_flags = ? WHERE id = ?')
        .bind(risk.score, risk.flags.join(','), orderId)
        .run();
    }
  }

  // Counted once per checkout, not once per item -- a 3-item order using one code is one use
  // of it, not three.
  if (appliedCoupon) {
    await env.DB.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?')
      .bind(appliedCoupon.coupon.id)
      .run();
  }

  const order = await db.getOrderByRef(env.DB, firstRef);
  return html(
    layout({
      title: 'Order placed',
      env,
      user,
      cartCount: 0,
      body: orderPlacedPage({ order }),
    }),
    200,
    { 'set-cookie': [writeCart([]), clearCoupon()] }
  );
}

async function trackRoute(request, env, url, cart, user) {
  const ref = (url.searchParams.get('ref') || '').trim();
  if (!ref) {
    return html(layout({ title: 'Track order', env, user, cartCount: cart.length, body: trackPage({}) }));
  }
  const order = await db.getOrderByRef(env.DB, ref);
  if (!order) {
    return html(
      layout({
        title: 'Track order',
        env,
        user,
        cartCount: cart.length,
        body: trackPage({ error: `No order found with reference ${escapeHtml(ref)}.` }),
      }),
      404
    );
  }
  return redirect(`/order/${encodeURIComponent(order.public_ref)}`);
}

async function orderRoute(request, env, ref, cart, user) {
  const order = await db.getOrderByRef(env.DB, ref);
  if (!order) {
    return html(
      layout({
        title: 'Track order',
        env,
        user,
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
      user,
      cartCount: cart.length,
      body: orderPage({ order, events, certificate }),
    })
  );
}

async function verifyRoute(request, env, url, cart, user) {
  const no = (url.searchParams.get('no') || '').trim();
  const code = (url.searchParams.get('code') || '').trim();
  const result = no ? await verifyCertificate(env.DB, no, code) : null;
  return html(
    layout({
      title: 'Verify a certificate',
      env,
      user,
      cartCount: cart.length,
      body: verifyPage({ query: no, code, result }),
    })
  );
}

async function certificateRoute(request, env, certNo, cart, user) {
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
        user,
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
      user,
      cartCount: cart.length,
      body: certificatePage({ cert, siteName: env.SITE_NAME || 'Rarehaus' }),
    })
  );
}

async function sourcingSubmit(request, env) {
  const form = await request.formData();
  const item = String(form.get('item') || '').trim().slice(0, 200);
  const contact = String(form.get('contact') || '').trim().slice(0, 120);
  if (!item || !contact) return redirect('/?sourcing=invalid');

  const budgetRaw = String(form.get('budget') || '').split('.')[0].replace(/[^\d]/g, '');
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
  '/authentication': { title: 'Authentication', body: (env) => authenticationPage(env) },
  '/shipping': { title: 'Shipping & import', body: (env) => shippingPage(env) },
  '/returns': { title: 'Returns', body: (env) => returnsPage(env) },
  '/terms': { title: 'Terms', body: (env) => termsPage(env) },
  '/privacy': { title: 'Privacy', body: (env) => privacyPage(env) },
  '/cookies': { title: 'Cookies', body: (env) => cookiesPage(env) },
  '/about': { title: 'About', body: (env) => aboutPage(env) },
  '/contact': { title: 'Contact', body: (env) => contactPage(env) },
  '/sell': {
    title: 'Sell with us',
    body: (env, url) => sellPage({ submitted: url?.searchParams.get('applied') === '1', env }),
  },
};

async function sellerApply(request, env, cart, user) {
  const form = await request.formData();
  const get = (k, max) => String(form.get(k) || '').trim().slice(0, max);

  const data = {
    business: get('business', 140),
    contact: get('contact', 120),
    email: get('email', 160),
    phone: get('phone', 30),
    city: get('city', 80),
    country: get('country', 80),
    categories: get('categories', 200),
    volume: get('volume', 40),
    authentication: get('authentication', 200),
    website: get('website', 200),
    notes: get('notes', 1000),
  };

  const valid =
    data.business &&
    data.contact &&
    data.city &&
    data.country &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email);

  if (!valid) {
    return html(
      layout({
        title: 'Sell with us',
        env,
        user,
        cartCount: cart.length,
        body: sellPage({
          error: 'Please fill in the business name, your name, a valid email, city and country.',
          env,
        }),
      }),
      400
    );
  }

  await env.DB.prepare(
    `INSERT INTO seller_applications
       (business_name, contact_name, email, phone, city, country, categories, volume, authentication, website, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      data.business,
      data.contact,
      data.email,
      data.phone || null,
      data.city,
      data.country,
      data.categories || null,
      data.volume || null,
      data.authentication || null,
      data.website || null,
      data.notes || null
    )
    .run();

  return redirect('/sell?applied=1#apply');
}
