/**
 * Verifies a Google Identity Services ID token (JWT) without any third-party
 * auth vendor — just Google's public JWKS + Web Crypto. No client secret
 * needed; this is the standard "verify on the backend" flow for GIS.
 * https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
 */

type GooglePayload = {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  aud: string;
  iss: string;
  exp: number;
};

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function base64UrlToJson<T>(b64url: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(b64url)));
}

let cachedJwks: { keys: JsonWebKey[]; fetchedAt: number } | null = null;

async function getGoogleJwks(): Promise<JsonWebKey[]> {
  const ONE_HOUR = 60 * 60 * 1000;
  if (cachedJwks && Date.now() - cachedJwks.fetchedAt < ONE_HOUR) {
    return cachedJwks.keys;
  }
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  const data = await res.json<{ keys: JsonWebKey[] }>();
  cachedJwks = { keys: data.keys, fetchedAt: Date.now() };
  return data.keys;
}

export async function verifyGoogleIdToken(idToken: string, expectedAudience: string): Promise<GooglePayload> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed Google ID token");
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = base64UrlToJson<{ kid: string; alg: string }>(headerB64);
  const payload = base64UrlToJson<GooglePayload>(payloadB64);

  const keys = await getGoogleJwks();
  const jwk = keys.find((k) => (k as { kid?: string }).kid === header.kid);
  if (!jwk) throw new Error("No matching Google signing key found");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToBytes(signatureB64);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signedData);
  if (!valid) throw new Error("Invalid Google ID token signature");

  if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
    throw new Error("Unexpected token issuer");
  }
  if (payload.aud !== expectedAudience) {
    throw new Error("Token audience does not match this app");
  }
  if (payload.exp * 1000 < Date.now()) {
    throw new Error("Google ID token has expired");
  }

  return payload;
}
