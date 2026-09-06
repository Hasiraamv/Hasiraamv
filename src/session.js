// Cookie, signing and admin-auth helpers.

const encoder = new TextEncoder();

export function parseCookies(request) {
  const header = request.headers.get('cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function cookieHeader(name, value, { maxAge = 60 * 60 * 24 * 30, httpOnly = true } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax',
    'Secure',
    `Max-Age=${maxAge}`,
  ];
  if (httpOnly) parts.push('HttpOnly');
  return parts.join('; ');
}

export function clearCookie(name) {
  return `${name}=; Path=/; SameSite=Lax; Secure; HttpOnly; Max-Age=0`;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function sign(secret, payload) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createAdminToken(secret, ttlSeconds = 60 * 60 * 8) {
  const expires = Date.now() + ttlSeconds * 1000;
  const payload = `admin.${expires}`;
  return `${payload}.${await sign(secret, payload)}`;
}

export async function verifyAdminToken(secret, token) {
  if (!token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 3 || parts[0] !== 'admin') return false;
  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;
  const expected = await sign(secret, `admin.${parts[1]}`);
  return timingSafeEqual(expected, parts[2]);
}

export function checkPassword(supplied, actual) {
  if (!actual) return false;
  return timingSafeEqual(String(supplied || ''), String(actual));
}

// A cart is a list of offer ids. Prices are always recomputed from the database, never
// read from the cookie, so a tampered cookie cannot change what anything costs.
export function readCart(request) {
  const raw = parseCookies(request).cart;
  if (!raw) return [];
  return raw
    .split(',')
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 20);
}

export function writeCart(ids) {
  return cookieHeader('cart', [...new Set(ids)].join(','));
}

// Rejects cross-site form posts. Same-origin only.
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // some browsers omit Origin on same-origin form posts
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function publicRef() {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `MM-${hex}`;
}
