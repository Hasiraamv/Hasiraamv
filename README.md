# Rarehaus

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

Certificate numbers look like `RH-26-SNK-00248-M`:

| Part | Meaning |
| --- | --- |
| `RH` | Issuer |
| `26` | Year of issue |
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
npx wrangler d1 create mintmark  # infra name kept as-is deliberately -- see wrangler.toml

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

## What is automatic

Adding a listing means typing a title and a seller price. Everything below is derived.

| Automatic | How |
| --- | --- |
| URL slug | From the product title, with a suffix if it collides |
| Duty | Seller price × the category's duty rate, set under Admin → Rates |
| Authentication fee | Flat per category, from the same rates |
| Shipping and lead time | From the source city's row in Rates |
| Landed price | The four parts added up — never typed, so it cannot disagree with them |
| Internal stock code | `RH-SNK-00042`, assigned per offer. Sequence comes from the highest existing code, so deleting an offer never reissues a number already printed on a label |
| Certificate number | `RH-26-SNK-00248-M` on authentication — year, category, sequence, check character |
| Verification code | Random six characters at issue, shown once |
| Order reference | `RH-7A6413` at checkout |
| Delivery dates | From the offer's lead days |
| "Under retail" badge | Whenever a retail price is set and the landed price is lower |
| Category counts, "from ₹X" | Counted from live offers |
| Seller sales counts | Counted from delivered orders |
| Stock state | Bought reserves the offer, delivered marks it sold |

Any of the calculated values can be overridden per offer for a one-off shipment. If a category
has no duty rate, or a city is not in the list, the offer still saves but admin warns you rather
than quietly charging zero.

## Sourcing is not published

The public site never names a source city, country or seller. Sellers appear as "Verified
seller A/B/C" on the offers table, the certificate does not name the dealer, and the certificate
number does not encode the source. All of it is still recorded internally and visible in admin —
it just is not handed to competitors.

The buyer-facing tracker has four stages: **Order placed → Shipped → Out for delivery →
Delivered.** Internally there are seven. Nothing reads as "Shipped" until the piece has passed
authentication, so the status can never run ahead of the guarantee, and the customer never sees
the seller-dispatch or customs steps that would reveal where it came from.

## Compliance and accessibility status

Audited with axe-core (WCAG 2.1 A and AA) across 15 public pages, 5 admin pages and mobile:
**0 violations**. Colour contrast was measured rather than eyeballed — `--faint` and `--gold`
were darkened from the original design because they measured 3.2–3.8:1 against the paper
backgrounds and needed 4.5:1.

| Item | State |
| --- | --- |
| Colour contrast | Fixed. All text pairings ≥ 4.5:1, verified by measurement |
| Keyboard navigation | Skip link, visible 3px focus ring on every control, labelled fields |
| Alt text | Product images use the product title; icons are `aria-hidden` (decorative) |
| Button labels | Icon-only and repeated buttons carry `aria-label` naming what they act on |
| Fake reviews | **Removed.** Seller sales counts now derive from delivered orders. A seller with none shows "New to the marketplace" rather than an invented rating |
| Unsupported claims | Homepage stats now read from the database. A demo banner runs while the catalogue is sample data |
| Tracking | None. No analytics, pixels, session recording or social embeds |
| Third-party embeds | Google Fonts only, disclosed on `/cookies` |
| Cookie consent | Not required — only two strictly necessary cookies. Explained on `/cookies` rather than a pointless banner |
| Form consent | Checkout, sourcing and seller forms state what data is used for and link to the privacy policy |
| Data minimisation | Only what delivery and contact require |
| Policies | Terms, privacy, cookies, returns, shipping — drafted, **need legal review** |
| Business details | Set once in `wrangler.toml`; unset values render as visible `[SET ...]` markers |
| Image copyright | Warned at the point of upload |

### Still yours to do

1. **Fill in the business details** in `wrangler.toml` — legal name, address, GSTIN, CIN,
   grievance officer, support email and phone. Until you do, `[SET ...]` markers appear on the
   live policy pages. That is deliberate: a policy silently missing a legally required detail
   looks finished when it is not.
2. **Get the policies reviewed by an Indian lawyer.** They are honest, plain-language drafts
   covering what the Consumer Protection (E-Commerce) Rules 2020 and the DPDP Act 2023 expect,
   including the mandatory grievance officer. They are not legal advice and I am not a lawyer.
3. **Set the open policy decisions** — returns window, change-of-mind stance, refund timeframe,
   commission, payout terms. Search for `[YOUR` to find them.
4. **Make the claims true before you make them.** The site says every piece gets a 30-point
   in-house inspection, ships sealed with a certificate, and is insured door to door. Those are
   good promises; they become false advertising the day you take money without doing them.
5. **Turn off demo mode** (`DEMO_MODE = "false"`) only once the catalogue is real stock.

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
