-- Sample catalogue. Replace with real stock before launch.
-- Every offer satisfies: landed_price = seller_price + duty + auth_fee + shipping.

DELETE FROM verification_log;
DELETE FROM certificates;
DELETE FROM authenticators;
DELETE FROM order_events;
DELETE FROM orders;
DELETE FROM offers;
DELETE FROM product_images;
DELETE FROM products;
DELETE FROM sellers;
DELETE FROM categories;
DELETE FROM sourcing_requests;

INSERT INTO categories (slug, name, blurb, sort_order) VALUES
  ('sneakers',    'Sneakers',        'Deadstock and worn-once pairs, sourced from Tokyo and Seoul.', 1),
  ('streetwear',  'Streetwear',      'Archive pieces and collaborations from six regions.', 2),
  ('watches',     'Watches',         'Vintage and modern references, inspected by a watchmaker.', 3),
  ('bags',        'Bags & Leather',  'Italian and French leather goods, condition graded in hand.', 4),
  ('jewelry',     'Jewelry',         'Gold, stones and signed pieces, assayed before dispatch.', 5),
  ('collectibles','Collectibles',    'Objects, print and rare ephemera.', 6);

-- Replace with your real authenticators. Initials appear on every certificate they sign.
INSERT INTO authenticators (initials, full_name) VALUES
  ('M.R.', '[AUTHENTICATOR ONE]'),
  ('S.K.', '[AUTHENTICATOR TWO]');

INSERT INTO sellers (name, city, country, rating, sales_count, kyc_verified, legit_check) VALUES
  ('Kaido Archive',        'Tokyo',    'Japan',       4.9,  812, 1, 1),
  ('Meridian Seoul',       'Seoul',    'South Korea', 4.8, 1204, 1, 1),
  ('Soho Reserve',         'London',   'UK',          5.0,  340, 1, 1),
  ('Via Montenapoleone',   'Milan',    'Italy',       4.7,  521, 1, 1),
  ('Rive Gauche Rare',     'Paris',    'France',      4.9,  288, 1, 1),
  ('Horologe Geneve',      'Geneva',   'Switzerland', 4.9,  164, 1, 1),
  ('Ponte Vecchio Pelle',  'Florence', 'Italy',       4.8,  409, 1, 1);

INSERT INTO products (slug, title, category_id, sku, release_year, description, condition_notes, retail_price, size_type) VALUES
  ('deadstock-runner-og', 'Deadstock Runner, OG Colorway', 1, 'SKU-100014', 2019,
   'An original-colourway runner in deadstock condition, sourced from a Tokyo archive dealer. Box and both sets of laces included.',
   'Deadstock, unworn. Original box with minor shelf wear.', 108000, 'uk'),

  ('vintage-chronograph-steel', 'Vintage Chronograph, Steel', 3, 'SKU-300042', 1978,
   'A manual-wind steel chronograph with a tropical dial, serviced by our watchmaker before listing.',
   'Excellent. Case unpolished, movement serviced 2026.', NULL, 'none'),

  ('full-grain-weekender-bag', 'Full-Grain Weekender Bag', 4, 'SKU-400008', 2023,
   'Vegetable-tanned full-grain leather weekender from a Florentine workshop, with brass hardware.',
   'As new. Patina beginning at the handles.', NULL, 'none'),

  ('hand-knit-cashmere-overcoat', 'Hand-Knit Cashmere Overcoat', 2, 'SKU-200019', 2024,
   'A hand-knit cashmere overcoat in charcoal, sourced from a Milanese boutique closing its archive.',
   'As new, tags attached.', NULL, 'apparel'),

  ('mesh-trainer-grey-suede', 'Mesh Trainer, Grey Suede', 1, 'SKU-100027', 2021,
   'A mesh and suede trainer in the grey colourway, lightly worn and fully cleaned.',
   'Worn twice. Soles clean, no creasing.', 52000, 'uk'),

  ('souvenir-jacket-reversible', 'Souvenir Jacket, Reversible', 2, 'SKU-200031', 2022,
   'A reversible embroidered souvenir jacket sourced in Tokyo, black to burgundy.',
   'Excellent. No pulls in the embroidery.', NULL, 'apparel'),

  ('selvedge-denim-raw', 'Selvedge Denim, Raw', 2, 'SKU-200044', 2025,
   'Raw selvedge denim, unwashed, from a Japanese mill run of 300 pairs.',
   'Deadstock, unwashed.', NULL, 'apparel'),

  ('field-watch-36mm', 'Field Watch, 36mm', 3, 'SKU-300055', 2020,
   'A 36mm automatic field watch on a sailcloth strap, sourced from a Tokyo dealer.',
   'Excellent. Light hairlines on the caseback.', NULL, 'none');

-- Deadstock Runner: eight competing offers across five sizes.
INSERT INTO offers (product_id, seller_id, size_label, condition, ships_from, seller_price, duty, auth_fee, shipping, landed_price, lead_days_min, lead_days_max) VALUES
  (1, 1, 'UK 7',  'Deadstock',           'Tokyo',  84900, 12200, 2400, 2500, 102000, 12, 16),
  (1, 1, 'UK 8',  'Deadstock',           'Tokyo',  81300, 11800, 2400, 2500,  98000, 12, 16),
  (1, 3, 'UK 8',  'Deadstock, OG box',   'London', 84200, 12100, 2400, 2500, 101200, 14, 20),
  (1, 1, 'UK 9',  'Deadstock',           'Tokyo',  78200, 11400, 2400, 2500,  94500, 12, 16),
  (1, 2, 'UK 9',  'Deadstock',           'Seoul',  79800, 11500, 2400, 2500,  96200, 14, 18),
  (1, 4, 'UK 9',  'Deadstock',           'Milan',  80800, 11700, 2400, 2500,  97400, 16, 22),
  (1, 3, 'UK 9',  'Deadstock, OG box',   'London', 82900, 12000, 2400, 2500,  99800, 14, 20),
  (1, 1, 'UK 10', 'Deadstock',           'Tokyo',  80000, 11600, 2400, 2500,  96500, 12, 16),
  (1, 2, 'UK 10', 'Deadstock',           'Seoul',  82100, 11900, 2400, 2500,  98900, 14, 18);

-- Vintage Chronograph: four offers, no sizing.
INSERT INTO offers (product_id, seller_id, size_label, condition, ships_from, seller_price, duty, auth_fee, shipping, landed_price, lead_days_min, lead_days_max) VALUES
  (2, 6, 'One size', 'Excellent, serviced', 'Geneva', 338000, 52100, 6900, 8000, 405000, 18, 24),
  (2, 3, 'One size', 'Excellent',           'London', 349500, 53600, 6900, 8500, 418500, 14, 20),
  (2, 4, 'One size', 'Very good',           'Milan',  354000, 54600, 6900, 8500, 424000, 16, 22),
  (2, 5, 'One size', 'Excellent, papers',   'Paris',  360000, 55600, 6900, 8500, 431000, 16, 22);

-- Weekender bag: a single seller holds this one.
INSERT INTO offers (product_id, seller_id, size_label, condition, ships_from, seller_price, duty, auth_fee, shipping, landed_price, lead_days_min, lead_days_max) VALUES
  (3, 7, 'One size', 'As new', 'Florence', 162000, 25400, 4100, 3500, 195000, 20, 28);

-- Cashmere overcoat: three offers across two sizes.
INSERT INTO offers (product_id, seller_id, size_label, condition, ships_from, seller_price, duty, auth_fee, shipping, landed_price, lead_days_min, lead_days_max) VALUES
  (4, 4, 'M', 'As new, tags',  'Milan',  137000, 21500, 3200, 3300, 165000, 16, 22),
  (4, 3, 'L', 'As new',        'London', 143300, 22500, 3200, 3500, 172500, 14, 20),
  (4, 5, 'M', 'Excellent',     'Paris',  147900, 23200, 3400, 3500, 178000, 16, 22);

INSERT INTO offers (product_id, seller_id, size_label, condition, ships_from, seller_price, duty, auth_fee, shipping, landed_price, lead_days_min, lead_days_max) VALUES
  (5, 1, 'UK 9',  'Worn twice',  'Tokyo',  34200,  5000, 1400, 1400,  42000, 12, 16),
  (5, 2, 'UK 10', 'Worn twice',  'Seoul',  35600,  5200, 1400, 1400,  43600, 14, 18),
  (6, 1, 'M',     'Excellent',   'Tokyo',  47600,  6900, 1800, 1700,  58000, 12, 16),
  (7, 1, 'W32',   'Deadstock',   'Tokyo',  19900,  2900,  900,  800,  24500, 12, 16),
  (8, 1, 'One size', 'Excellent', 'Tokyo', 110000, 16000, 3000, 3000, 132000, 14, 18);
