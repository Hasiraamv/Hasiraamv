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

// The token identifies which admin_users row is signed in; it does not carry the role, so a
// role change or a disabled account takes effect on the very next request rather than waiting
// out an up-to-8-hour-old token -- adminRouter re-reads the row every time.
export async function createAdminToken(secret, userId, ttlSeconds = 60 * 60 * 8) {
  const expires = Date.now() + ttlSeconds * 1000;
  const payload = `admin.${userId}.${expires}`;
  return `${payload}.${await sign(secret, payload)}`;
}

// Returns the signed-in admin_users id, or null if the token is missing, malformed, expired,
// or its signature does not match.
export async function verifyAdminToken(secret, token) {
  if (!token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 4 || parts[0] !== 'admin') return null;
  const userId = Number(parts[1]);
  const expires = Number(parts[2]);
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isFinite(expires) || Date.now() > expires) {
    return null;
  }
  const expected = await sign(secret, `admin.${parts[1]}.${parts[2]}`);
  return timingSafeEqual(expected, parts[3]) ? userId : null;
}

// Password hashing for employee admin accounts. The Workers runtime has no native bcrypt or
// argon2 without a WASM dependency; PBKDF2-HMAC-SHA256 at a high iteration count via the
// standard Web Crypto API is a well-established, dependency-free alternative and is what this
// uses. Never compare or store a password in plain text.
const PBKDF2_ITERATIONS = 100000;

function toHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  const bytes = hex.match(/.{2}/g) || [];
  return new Uint8Array(bytes.map((b) => parseInt(b, 16)));
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256
  );
  return toHex(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toHex(salt)}:${hash}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;
  const hash = await pbkdf2(password, fromHex(parts[2]), iterations);
  return timingSafeEqual(hash, parts[3]);
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
  return `RH-${hex}`;
}
