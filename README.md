# Mintmark

An authenticated import marketplace: many verified sellers list the same piece, buyers see
every offer side by side, and nothing ships without being authenticated twice and certified.

Built as a single Cloudflare Worker with a D1 database. No build step — the Worker serves
server-rendered HTML directly.

## What is here

| Area | Route | Notes |
| --- | --- | --- |
| Homepage | `/` | Categories, new arrivals, sourcing regions, sourcing request form |
| Category / all listings | `/c/:slug` | Price bands, under-retail and lead-time filters, sorting |
| Search | `/search?q=` | Title and description |
| Product | `/p/:slug` | Size grid priced per size, competing seller offers, delivery timeline, landed-price breakdown |
| Cart / checkout | `/cart`, `/checkout` | Cookie cart; prices always recomputed from the database |
| Order tracking | `/track`, `/order/:ref` | Seven-stage import timeline |
| Certificate verification | `/verify` | Public lookup, plus full detail with the sealed code |
| Printable certificate | `/certificate/:no` | Prints cleanly |
| Admin | `/admin` | Orders, certificates, products, offers, sourcing requests |

## Certification

Certificate numbers look like `MM-26-TYO-SNK-00248-M`:

| Part | Meaning |
| --- | --- |
| `MM` | Issuer |
| `26` | Year of issue |
| `TYO` | Source city (Tokyo, Seoul, Milan, Geneva, Paris, London, Florence) |
| `SNK` | Category (SNK, STW, WCH, BAG, JWL, COL) |
| `00248` | Sequence within the year |
| `M` | Check character (Luhn mod 36) |

The check character rejects every single-character typo and every adjacent transposition
before a lookup ever hits the database, so invented numbers fail immediately.

Sequence numbers are guessable by design — that is why the public lookup shows only what the
certificate covers. The authenticator, the seller and the inspection notes require the
`verify_code`, a six-character code shown **once** when the certificate is issued. Print it and
seal it inside the package; never email it or put it on the outside.

Every lookup is written to `verification_log`. Repeated hits on one number are how you find out
a certificate has been copied onto counterfeits.

Certificates can be revoked from the admin panel. A revoked number tells the buyer plainly that
it is not proof of authenticity.

## Setup

```bash
npm install

# 1. Create the database, then paste the returned database_id into wrangler.toml
npx wrangler d1 create mintmark

# 2. Apply schema and sample data
npm run db:schema
npm run db:seed

# 3. Set secrets (never commit these)
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET   # any long random string

# 4. Deploy
npm run deploy
```

Local development:

```bash
npm run db:schema:local
npm run db:seed:local
printf 'ADMIN_PASSWORD=localpassword\nSESSION_SECRET=localsecret\n' > .dev.vars
npm run dev
```

`.dev.vars` is gitignored. Restart `wrangler dev` after creating it, or admin returns 503.

## Before taking real money

1. **Payments are not connected.** Checkout records an order and reserves the offer, then tells
   the buyer they will be contacted. Wire a gateway (Razorpay for India) in `checkoutSubmit` in
   `src/index.js`: create the payment order before writing the order row, and set
   `payment_status` from the gateway webhook rather than trusting the browser.
2. **Replace the sample catalogue.** `db/seed.sql` is placeholder stock, sellers and prices.
3. **Fill in the placeholders.** Search for `[YOUR` across the repo — registered address, phone,
   returns policy, privacy policy, terms.
4. **Replace the sample authenticators** in `db/seed.sql` with your real ones; their initials are
   printed on every certificate they sign.
5. Legal pages at `/privacy`, `/terms` and `/returns` are placeholders.

## Notes on the data model

`landed_price = seller_price + duty + auth_fee + shipping`, and that invariant is what the
product page breakdown displays. The admin offer form computes it for you; anything writing
offers directly must maintain it.

Buying an offer sets it to `reserved` so the same physical item cannot be sold twice; marking an
order `delivered` sets it to `sold`.
