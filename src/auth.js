// Buyer accounts: password hashing, session tokens, and Google sign-in. Separate from the
// admin auth in session.js on purpose -- a bug in one must not be able to touch the other.

const encoder = new TextEncoder();

// PBKDF2-SHA256, 100k iterations, random salt. Cloudflare Workers expose Web Crypto but not
// bcrypt/scrypt, so PBKDF2 via subtle.crypto is the standard choice here.
const PBKDF2_ITERATIONS = 100000;

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(bits)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored) return false;
  const parts = String(stored).split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = fromHex(parts[2]);
  const expectedHex = parts[3];
  if (!Number.isFinite(iterations) || salt.length === 0) return false;

  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  );
  const gotHex = toHex(bits);

  // Timing-safe compare.
  if (gotHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < gotHex.length; i++) diff |= gotHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  return diff === 0;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
}

async function sign(secret, payload) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toHex(sig);
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Buyer session cookie. Signed, not encrypted -- it only carries a user id and an expiry,
// nothing sensitive, the same shape as the admin token in session.js.
export async function createUserToken(secret, userId, ttlSeconds = 60 * 60 * 24 * 90) {
  const expires = Date.now() + ttlSeconds * 1000;
  const payload = `user.${userId}.${expires}`;
  return `${payload}.${await sign(secret, payload)}`;
}

export async function verifyUserToken(secret, token) {
  if (!token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 4 || parts[0] !== 'user') return null;
  const userId = Number(parts[1]);
  const expires = Number(parts[2]);
  if (!Number.isInteger(userId) || !Number.isFinite(expires) || Date.now() > expires) return null;
  const expected = await sign(secret, `user.${parts[1]}.${parts[2]}`);
  if (!timingSafeEqual(expected, parts[3])) return null;
  return userId;
}

// Google sign-in (OAuth 2.0 authorization code flow). Requires GOOGLE_CLIENT_ID (public,
// a var) and GOOGLE_CLIENT_SECRET (a secret) to be set -- see wrangler.toml.
export function googleAuthUrl(env, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(env, code, redirectUri) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.access_token) return null;

  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { authorization: `Bearer ${data.access_token}` },
  });
  if (!userRes.ok) return null;
  const profile = await userRes.json();
  if (!profile.sub || !profile.email) return null;
  return { googleId: profile.sub, email: profile.email, name: profile.name || profile.email };
}

export function randomState() {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}
