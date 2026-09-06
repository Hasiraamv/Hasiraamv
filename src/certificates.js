// Mintmark in-house certification.
//
// Number format:  MM-26-TYO-SNK-04821-K
//   MM     issuer prefix
//   26     two-digit year of issue
//   TYO    source city code
//   SNK    category code
//   04821  sequence, unique within the year
//   K      check character (Luhn mod 36)
//
// The check character means a mistyped or invented number is rejected before it ever
// reaches the database. It is not a secret — anyone can compute it — so it stops typos
// and casual fakes, not a determined forger. What stops a forger is verify_code, the
// short code printed inside the sealed package and required for full detail.

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = ALPHABET.length;

export const SOURCE_CODES = {
  Tokyo: 'TYO',
  Seoul: 'ICN',
  Milan: 'MIL',
  Geneva: 'GVA',
  Paris: 'PAR',
  London: 'LON',
  Florence: 'FLR',
};

export const CATEGORY_CODES = {
  sneakers: 'SNK',
  streetwear: 'STW',
  watches: 'WCH',
  bags: 'BAG',
  jewelry: 'JWL',
  collectibles: 'COL',
};

export function sourceCode(city) {
  return SOURCE_CODES[city] || (city || 'XXX').slice(0, 3).toUpperCase();
}

export function categoryCode(slug) {
  return CATEGORY_CODES[slug] || (slug || 'GEN').slice(0, 3).toUpperCase();
}

// Luhn mod N over the alphanumeric payload.
function checkCharacter(payload) {
  const chars = payload.toUpperCase().replace(/[^0-9A-Z]/g, '');
  let factor = 2;
  let sum = 0;
  for (let i = chars.length - 1; i >= 0; i--) {
    const code = ALPHABET.indexOf(chars[i]);
    if (code < 0) continue;
    let addend = factor * code;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / BASE) + (addend % BASE);
    sum += addend;
  }
  return ALPHABET[(BASE - (sum % BASE)) % BASE];
}

export function buildCertificateNumber({ year, sequence, source, category }) {
  const yy = String(year % 100).padStart(2, '0');
  const seq = String(sequence).padStart(5, '0');
  const body = `MM-${yy}-${source}-${category}-${seq}`;
  return `${body}-${checkCharacter(body)}`;
}

// Returns the parsed parts, or null when the number is malformed or fails its checksum.
export function parseCertificateNumber(input) {
  if (!input) return null;
  const normalised = String(input).trim().toUpperCase().replace(/\s+/g, '');
  const match = /^MM-(\d{2})-([A-Z]{3})-([A-Z]{3})-(\d{5})-([0-9A-Z])$/.exec(normalised);
  if (!match) return null;

  const [, yy, source, category, seq, check] = match;
  const body = `MM-${yy}-${source}-${category}-${seq}`;
  if (checkCharacter(body) !== check) return null;

  return {
    certificateNo: normalised,
    year: 2000 + Number(yy),
    source,
    category,
    sequence: Number(seq),
  };
}

// Short code printed inside the sealed package. Ambiguous characters are left out so it
// can be read off a card without confusing 0/O or 1/I.
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateVerifyCode(length = 6) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

// Issues the next certificate for an order. Sequence is per-year and allocated inside a
// single INSERT..SELECT so two concurrent issues cannot claim the same number.
export async function issueCertificate(db, { order, product, offer, seller, categorySlug, authenticatorId, sellerReportRef, notes }) {
  const year = new Date().getFullYear();
  const source = sourceCode(offer.ships_from);
  const category = categoryCode(categorySlug);
  const verifyCode = generateVerifyCode();

  const row = await db
    .prepare('SELECT COALESCE(MAX(sequence_no), 0) + 1 AS next FROM certificates WHERE year = ?')
    .bind(year)
    .first();
  const sequence = row?.next || 1;

  const certificateNo = buildCertificateNumber({ year, sequence, source, category });

  await db
    .prepare(
      `INSERT INTO certificates
         (certificate_no, verify_code, year, sequence_no, source_code, category_code,
          product_id, offer_id, order_id, product_title, size_label, condition,
          sourced_from, seller_name, seller_report_ref, authenticator_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      certificateNo,
      verifyCode,
      year,
      sequence,
      source,
      category,
      product.id,
      offer.id,
      order.id,
      product.title,
      offer.size_label,
      offer.condition,
      offer.ships_from,
      seller?.name || null,
      sellerReportRef || null,
      authenticatorId || null,
      notes || null
    )
    .run();

  await db
    .prepare('UPDATE orders SET certificate_no = ? WHERE id = ?')
    .bind(certificateNo, order.id)
    .run();

  return { certificateNo, verifyCode, sequence, year };
}

// Public lookup. Without the paired verify code this confirms what the certificate
// covers and nothing about the buyer.
export async function verifyCertificate(db, input, suppliedCode) {
  const parsed = parseCertificateNumber(input);
  if (!parsed) {
    await logVerification(db, String(input || '').slice(0, 40), 'bad_checksum', false);
    return { ok: false, reason: 'bad_checksum' };
  }

  const cert = await db
    .prepare(
      `SELECT c.*, a.initials AS authenticator_initials, a.full_name AS authenticator_name
         FROM certificates c
         LEFT JOIN authenticators a ON a.id = c.authenticator_id
        WHERE c.certificate_no = ?`
    )
    .bind(parsed.certificateNo)
    .first();

  if (!cert) {
    await logVerification(db, parsed.certificateNo, 'not_found', false);
    return { ok: false, reason: 'not_found', parsed };
  }

  const codeMatches =
    !!suppliedCode && String(suppliedCode).trim().toUpperCase() === cert.verify_code;

  if (cert.status === 'revoked') {
    await logVerification(db, cert.certificate_no, 'revoked', codeMatches);
    return { ok: false, reason: 'revoked', cert, parsed };
  }

  await logVerification(db, cert.certificate_no, 'valid', codeMatches);

  const lookups = await db
    .prepare('SELECT COUNT(*) AS n FROM verification_log WHERE certificate_no = ? AND result = ?')
    .bind(cert.certificate_no, 'valid')
    .first();

  return { ok: true, cert, parsed, fullDetail: codeMatches, lookupCount: lookups?.n || 0 };
}

async function logVerification(db, certificateNo, result, fullDetail) {
  try {
    await db
      .prepare('INSERT INTO verification_log (certificate_no, result, full_detail) VALUES (?, ?, ?)')
      .bind(certificateNo, result, fullDetail ? 1 : 0)
      .run();
  } catch {
    // Logging must never break a lookup.
  }
}
