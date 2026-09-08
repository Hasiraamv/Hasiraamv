import { escapeHtml, formatINR, icon } from '../render.js';

const NARROW = 'max-width:440px;';

function authShell({ title, error, body }) {
  return `
<section class="section" style="${NARROW}">
  <h1 class="serif" style="font-size:32px; margin:0 0 22px; font-weight:400;">${title}</h1>
  ${error ? `<div class="notice notice-bad" style="margin-bottom:18px;">${escapeHtml(error)}</div>` : ''}
  ${body}
</section>`;
}

export function signupPage({ error } = {}) {
  return authShell({
    title: 'Create an account',
    error,
    body: `
      <a class="btn btn-outline btn-block" href="/auth/google/start" style="margin-bottom:18px; display:flex; align-items:center; justify-content:center; gap:10px;">
        Continue with Google
      </a>
      <div style="display:flex; align-items:center; gap:12px; margin:18px 0; color:var(--muted); font-size:12px;">
        <span style="flex:1; height:1px; background:var(--line);"></span>or<span style="flex:1; height:1px; background:var(--line);"></span>
      </div>
      <form method="post" action="/account/signup">
        <div class="field"><label for="name">Name</label><input id="name" name="name" required maxlength="120"></div>
        <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required maxlength="160"></div>
        <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" required minlength="8" maxlength="200"></div>
        <div class="field .hint" style="margin-top:-8px;"><span class="hint">At least 8 characters.</span></div>
        <button class="btn btn-block" type="submit">Create account</button>
      </form>
      <p style="font-size:13px; color:var(--muted); margin-top:18px;">
        Already have an account? <a href="/account/login">Sign in</a>
      </p>`,
  });
}

export function loginPage({ error } = {}) {
  return authShell({
    title: 'Sign in',
    error,
    body: `
      <a class="btn btn-outline btn-block" href="/auth/google/start" style="margin-bottom:18px; display:flex; align-items:center; justify-content:center; gap:10px;">
        Continue with Google
      </a>
      <div style="display:flex; align-items:center; gap:12px; margin:18px 0; color:var(--muted); font-size:12px;">
        <span style="flex:1; height:1px; background:var(--line);"></span>or<span style="flex:1; height:1px; background:var(--line);"></span>
      </div>
      <form method="post" action="/account/login">
        <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required maxlength="160"></div>
        <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" required maxlength="200"></div>
        <button class="btn btn-block" type="submit">Sign in</button>
      </form>
      <p style="font-size:13px; color:var(--muted); margin-top:18px;">
        New here? <a href="/account/signup">Create an account</a>
      </p>`,
  });
}

export function accountPage({ user, orders }) {
  return `
<section class="section">
  <div class="section-head">
    <div>
      <span class="tag gold">Account</span>
      <h1 class="serif" style="font-size:34px; margin:10px 0 0; font-weight:400;">${escapeHtml(user.name)}</h1>
      <p class="muted" style="margin:6px 0 0; font-size:13.5px;">${escapeHtml(user.email)}</p>
    </div>
    <form method="post" action="/account/logout"><button class="btn btn-outline" type="submit">Sign out</button></form>
  </div>

  <h2 class="serif" style="font-size:22px; margin:0 0 16px; font-weight:400;">Your orders</h2>
  ${
    orders.length
      ? `<table class="table">
          <thead><tr><th>Order</th><th>Item</th><th>Status</th><th class="num">Amount</th></tr></thead>
          <tbody>
            ${orders
              .map(
                (o) => `
              <tr>
                <td data-label="Order"><a href="/order/${encodeURIComponent(o.public_ref)}">${escapeHtml(o.public_ref)}</a></td>
                <td data-label="Item">${escapeHtml(o.product_title)}${o.size_label && o.size_label !== 'One size' ? ` &middot; ${escapeHtml(o.size_label)}` : ''}</td>
                <td data-label="Status">${escapeHtml(o.status)}</td>
                <td data-label="Amount" class="num">${formatINR(o.amount)}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>`
      : `<div class="notice">No orders on this account yet. <a href="/c/all">Browse listings</a> — you don't need an account to check out, but signing in first will link the order here.</div>`
  }
</section>`;
}
