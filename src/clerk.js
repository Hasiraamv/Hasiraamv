// Buyer sign-in via Clerk. Clerk hosts the actual sign-in/sign-up UI and issues its own
// session cookie; this file only verifies that cookie on each request (via @clerk/backend,
// which is edge/Workers-compatible -- Fetch API and Web Crypto only, no Node APIs) and
// verifies the signature on Clerk's user.created webhook.

import { createClerkClient } from '@clerk/backend';

let cachedClient = null;
let cachedForKey = null;

function client(env) {
  if (cachedClient && cachedForKey === env.CLERK_SECRET_KEY) return cachedClient;
  cachedClient = createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
  });
  cachedForKey = env.CLERK_SECRET_KEY;
  return cachedClient;
}

export function clerkConfigured(env) {
  return Boolean(env.CLERK_SECRET_KEY && env.CLERK_PUBLISHABLE_KEY);
}

// A Clerk publishable key encodes the instance's Frontend API host: pk_<env>_<base64>,
// where the base64 part decodes to "<frontend-api-host>$". clerk-js is loaded from that
// host, not a generic CDN, because the bundle is served per-instance.
export function clerkFrontendApi(publishableKey) {
  const b64 = publishableKey.replace(/^pk_(test|live)_/, '');
  const decoded = atob(b64);
  return decoded.replace(/\$$/, '');
}

// Returns { userId } if the request carries a valid Clerk session, otherwise null.
// Never throws -- an auth check failing must not break the page it's guarding.
export async function getClerkAuth(request, env) {
  if (!clerkConfigured(env)) return null;
  try {
    const result = await client(env).authenticateRequest(request, {
      authorizedParties: [new URL(request.url).origin],
    });
    if (!result.isSignedIn) return null;
    const auth = result.toAuth();
    return { userId: auth.userId };
  } catch (err) {
    console.error('Clerk auth check failed:', err);
    return null;
  }
}

export async function getClerkUserProfile(env, userId) {
  const user = await client(env).users.getUser(userId);
  const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress
    || user.emailAddresses[0]?.emailAddress
    || '';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || email;
  return { email, name };
}

// Svix webhook signature verification (Clerk webhooks are signed by Svix), done manually
// with Web Crypto rather than the svix npm package, which pulls in Node's crypto module
// and would need the nodejs_compat flag turned on just for this one check.
export async function verifyClerkWebhook(request, secret) {
  if (!secret) return null;
  const body = await request.text();
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signatureHeader = request.headers.get('svix-signature');
  if (!id || !timestamp || !signatureHeader) return null;

  // Reject requests older than 5 minutes to limit replay risk.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return null;

  const secretBytes = base64Decode(secret.replace(/^whsec_/, ''));
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signedContent = `${id}.${timestamp}.${body}`;
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
  const expected = base64Encode(new Uint8Array(sig));

  const candidates = signatureHeader.split(' ').map((s) => s.split(',')[1]).filter(Boolean);
  if (!candidates.some((c) => timingSafeEqual(c, expected))) return null;

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function base64Decode(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function base64Encode(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
