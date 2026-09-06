-- Mintmark schema. All money columns are whole rupees (INTEGER), never floats.

DROP TABLE IF EXISTS verification_log;
DROP TABLE IF EXISTS certificates;
DROP TABLE IF EXISTS authenticators;
DROP TABLE IF EXISTS order_events;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS offers;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS sellers;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS sourcing_requests;

CREATE TABLE categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  blurb      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sellers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  city           TEXT NOT NULL,
  country        TEXT NOT NULL,
  rating         REAL NOT NULL DEFAULT 0,
  sales_count    INTEGER NOT NULL DEFAULT 0,
  kyc_verified   INTEGER NOT NULL DEFAULT 0,
  legit_check    INTEGER NOT NULL DEFAULT 0,  -- seller uploads an authentication report before listing
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE products (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  category_id      INTEGER NOT NULL REFERENCES categories(id),
  sku              TEXT,
  release_year     INTEGER,
  description      TEXT,
  condition_notes  TEXT,
  retail_price     INTEGER,                   -- used to compute "under retail"
  size_type        TEXT NOT NULL DEFAULT 'none', -- none | uk | eu | apparel
  is_published     INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_products_category ON products(category_id);

CREATE TABLE product_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  alt        TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_images_product ON product_images(product_id);

-- The marketplace core: many sellers offer the same product, per size.
-- landed_price is what the buyer pays, and it is the sum of the four parts below it.
CREATE TABLE offers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id      INTEGER NOT NULL REFERENCES sellers(id),
  size_label     TEXT NOT NULL DEFAULT 'One size',
  condition      TEXT NOT NULL DEFAULT 'Deadstock',
  ships_from     TEXT NOT NULL,
  seller_price   INTEGER NOT NULL,
  duty           INTEGER NOT NULL DEFAULT 0,
  auth_fee       INTEGER NOT NULL DEFAULT 0,
  shipping       INTEGER NOT NULL DEFAULT 0,
  landed_price   INTEGER NOT NULL,
  lead_days_min  INTEGER NOT NULL DEFAULT 14,
  lead_days_max  INTEGER NOT NULL DEFAULT 28,
  status         TEXT NOT NULL DEFAULT 'active', -- active | reserved | sold | withdrawn
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_offers_product ON offers(product_id, status);
CREATE INDEX idx_offers_price ON offers(product_id, size_label, landed_price);

CREATE TABLE orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  public_ref      TEXT NOT NULL UNIQUE,   -- shown to the buyer, e.g. MM-4F2A19
  certificate_no  TEXT UNIQUE,            -- issued at authentication, e.g. MM-00248-TYO
  offer_id        INTEGER NOT NULL REFERENCES offers(id),
  product_id      INTEGER NOT NULL REFERENCES products(id),
  size_label      TEXT NOT NULL,
  amount          INTEGER NOT NULL,       -- landed price captured at purchase time
  seller_price    INTEGER NOT NULL,
  duty            INTEGER NOT NULL,
  auth_fee        INTEGER NOT NULL,
  shipping        INTEGER NOT NULL,
  buyer_name      TEXT NOT NULL,
  buyer_email     TEXT NOT NULL,
  buyer_phone     TEXT NOT NULL,
  address_line1   TEXT NOT NULL,
  address_line2   TEXT,
  city            TEXT NOT NULL,
  state           TEXT NOT NULL,
  pincode         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'placed',
  payment_status  TEXT NOT NULL DEFAULT 'pending',
  payment_ref     TEXT,
  eta_min         TEXT,
  eta_max         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- Drives the buyer-facing tracking timeline. One row per stage the order reaches.
CREATE TABLE order_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_order ON order_events(order_id, created_at);

-- In-house authentication programme -------------------------------------------------
-- People who sign off an inspection. Initials appear on the certificate.
CREATE TABLE authenticators (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  initials   TEXT NOT NULL UNIQUE,
  full_name  TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A certificate is its own record, not a flag on an order: it outlives the sale,
-- survives resale, and can be revoked without touching order history.
--
-- Number format: MM-26-TYO-SNK-04821-K
--   MM     issuer
--   26     year of issue
--   TYO    source city code
--   SNK    category code
--   04821  zero-padded sequence, unique within year
--   K      check character (Luhn mod 36) so typos and invented numbers fail instantly
--
-- verify_code is a short random code printed inside the sealed package. The public
-- lookup confirms a certificate exists and what it covers; the paired code is required
-- to see full detail. Sequence numbers are guessable by design, so never expose buyer
-- data on the public lookup.
CREATE TABLE certificates (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_no   TEXT NOT NULL UNIQUE,
  verify_code      TEXT NOT NULL,
  year             INTEGER NOT NULL,
  sequence_no      INTEGER NOT NULL,
  source_code      TEXT NOT NULL,
  category_code    TEXT NOT NULL,
  product_id       INTEGER REFERENCES products(id),
  offer_id         INTEGER REFERENCES offers(id),
  order_id         INTEGER REFERENCES orders(id),
  product_title    TEXT NOT NULL,      -- frozen at issue: the certificate must not change if the listing is edited
  size_label       TEXT,
  condition        TEXT,
  sourced_from     TEXT NOT NULL,
  seller_name      TEXT,
  seller_report_ref TEXT,              -- the seller's own legit-check report
  inspection_points INTEGER NOT NULL DEFAULT 30,
  authenticator_id INTEGER REFERENCES authenticators(id),
  issued_on        TEXT NOT NULL DEFAULT (date('now')),
  status           TEXT NOT NULL DEFAULT 'valid',  -- valid | revoked | superseded
  revoked_reason   TEXT,
  revoked_on       TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_cert_year_seq ON certificates(year, sequence_no);
CREATE INDEX idx_cert_order ON certificates(order_id);

-- Every lookup is recorded. Repeated hits on one certificate are the signal that a
-- number has been copied onto counterfeits and is circulating.
CREATE TABLE verification_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_no TEXT NOT NULL,
  result         TEXT NOT NULL,      -- valid | not_found | bad_checksum | revoked
  full_detail    INTEGER NOT NULL DEFAULT 0,
  ip_country     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_verlog_cert ON verification_log(certificate_no, created_at DESC);

CREATE TABLE sourcing_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item        TEXT NOT NULL,
  size_label  TEXT,
  budget_max  INTEGER,
  name        TEXT,
  contact     TEXT NOT NULL,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'new', -- new | hunting | quoted | closed
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sourcing_created ON sourcing_requests(created_at DESC);
