import { escapeHtml, formatINR } from '../render.js';
import { clerkFrontendApi } from '../clerk.js';

// Loads clerk-js from the instance's own Frontend API host (derived from the publishable
// key) and mounts the given component into #clerk-mount. Used by both the sign-in and
// sign-up pages -- Clerk's <SignIn>/<SignUp> each carry their own "switch to the other" link,
// so one small wrapper covers both.
function clerkMountPage({ title, publishableKey, mount, afterSignOutUrl = '/' }) {
  const frontendApi = clerkFrontendApi(publishableKey);
  return `
<section class="section" style="max-width:440px;">
  <h1 class="serif" style="font-size:32px; margin:0 0 22px; font-weight:400;">${title}</h1>
  <div id="clerk-mount"></div>
  <div id="clerk-loading" class="muted" style="font-size:13px;">Loading sign-in…</div>
</section>
<script
  async
  crossorigin="anonymous"
  data-clerk-publishable-key="${escapeHtml(publishableKey)}"
  src="https://${escapeHtml(frontendApi)}/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
  type="text/javascript"
></script>
<script>
  window.addEventListener('load', async function () {
    await window.Clerk.load({ afterSignOutUrl: ${JSON.stringify(afterSignOutUrl)} });
    document.getElementById('clerk-loading').remove();
    if (window.Clerk.user) {
      window.location.href = '/account';
      return;
    }
    window.Clerk.${mount}(document.getElementById('clerk-mount'), {
      afterSignInUrl: '/account',
      afterSignUpUrl: '/account',
    });
  });
</script>`;
}

export function signInPage({ publishableKey }) {
  return clerkMountPage({ title: 'Sign in', publishableKey, mount: 'mountSignIn' });
}

export function signUpPage({ publishableKey }) {
  return clerkMountPage({ title: 'Create an account', publishableKey, mount: 'mountSignUp' });
}

export function clerkNotConfiguredPage() {
  return `
<section class="section" style="max-width:520px;">
  <h1 class="serif" style="font-size:32px; margin:0 0 16px; font-weight:400;">Sign-in isn't set up yet</h1>
  <p class="muted" style="font-size:14px; line-height:1.6;">
    Add <code>CLERK_PUBLISHABLE_KEY</code> and the <code>CLERK_SECRET_KEY</code> secret to
    turn this on. Checkout works as a guest in the meantime.
  </p>
  <a class="btn" href="/">Back home</a>
</section>`;
}

export function accountPage({ user, orders, publishableKey }) {
  const frontendApi = clerkFrontendApi(publishableKey);
  return `
<section class="section">
  <div class="section-head">
    <div>
      <span class="tag gold">Account</span>
      <h1 class="serif" style="font-size:34px; margin:10px 0 0; font-weight:400;">${escapeHtml(user.name)}</h1>
      <p class="muted" style="margin:6px 0 0; font-size:13.5px;">${escapeHtml(user.email)}</p>
    </div>
    <button class="btn btn-outline" id="clerk-sign-out" type="button">Sign out</button>
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
</section>
<script
  async
  crossorigin="anonymous"
  data-clerk-publishable-key="${escapeHtml(publishableKey)}"
  src="https://${escapeHtml(frontendApi)}/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
  type="text/javascript"
></script>
<script>
  window.addEventListener('load', async function () {
    await window.Clerk.load();
    document.getElementById('clerk-sign-out').addEventListener('click', function () {
      window.Clerk.signOut({ redirectUrl: '/' });
    });
  });
</script>`;
}
