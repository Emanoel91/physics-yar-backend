-- Physics Yar database schema
-- Run this once against your ArvanCloud PostgreSQL database.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS majors (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,       -- e.g. 'tajrobi', 'riazi'
  title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grades (
  id SERIAL PRIMARY KEY,
  major_id INT NOT NULL REFERENCES majors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,             -- e.g. 'دهم', 'یازدهم', 'کنکوری'
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chapters (
  id SERIAL PRIMARY KEY,
  grade_id INT NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sections (
  id SERIAL PRIMARY KEY,
  chapter_id INT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS clips (
  id SERIAL PRIMARY KEY,
  section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration TEXT,                   -- display string like '12:30'
  price INT NOT NULL DEFAULT 0,    -- in Toman; 0 means free
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  preview_object_key TEXT NOT NULL,   -- path inside the bucket for the preview file
  full_object_key TEXT NOT NULL,      -- path inside the bucket for the full file
  pdf_object_key TEXT,                -- optional path for the pdf
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clip_id INT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, clip_id)
);

CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clip_id INT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  price_paid INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, clip_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  authority TEXT,                  -- Zarinpal authority token
  ref_id TEXT,                     -- Zarinpal reference id after successful payment
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  clip_id INT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  price INT NOT NULL
);

-- seed the two majors so the app has something to show immediately
INSERT INTO majors (slug, title) VALUES
  ('tajrobi', 'علوم تجربی'),
  ('riazi', 'ریاضی و فیزیک')
ON CONFLICT (slug) DO NOTHING;
