/*  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    공간 / GONGGAN — Supabase Configuration
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    SETUP (one-time, ~5 minutes):
    1. Go to https://supabase.com → "New Project"
    2. Copy your project URL and anon key from
       Settings → API and paste them below.
    3. In the SQL Editor, run the schema at the
       bottom of this file.
    4. Create your admin account:
       Authentication → Users → "Invite user"
       (or use the signup email confirmation flow).

    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const SUPABASE_URL      = 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

/* ──────────────────────────────────────────────
   SQL SCHEMA  (run once in Supabase SQL Editor)
────────────────────────────────────────────── */
/*

-- 1. Site-wide editable configuration
create table if not exists site_config (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);

insert into site_config (key, value) values
  ('hero_h1_ko',       '당신의 공간을,'),
  ('hero_h2_ko',       '온라인에'),
  ('hero_h1_en',       'Your Space,'),
  ('hero_h2_en',       'Online.'),
  ('slogan_ko',        '당신의 공간을, 온라인에'),
  ('slogan_en',        'Your Space, Online.'),
  ('contact_phone',    '010-4856-5543'),
  ('contact_email',    'seonju5543@gmail.com')
on conflict (key) do nothing;

alter table site_config enable row level security;
create policy "public_read"   on site_config for select using (true);
create policy "auth_write"    on site_config for all    using (auth.role() = 'authenticated');

-- 2. Portfolio items
create table if not exists portfolio_items (
  id           uuid default gen_random_uuid() primary key,
  title_ko     text not null,
  title_en     text,
  desc_ko      text,
  desc_en      text,
  image_url    text,
  cat_ko       text,
  cat_en       text,
  features_ko  text,
  features_en  text,
  sort_order   int default 0,
  created_at   timestamptz default now()
);

alter table portfolio_items enable row level security;
create policy "public_read"  on portfolio_items for select using (true);
create policy "auth_write"   on portfolio_items for all    using (auth.role() = 'authenticated');

-- 3. Contact form inquiries
create table if not exists inquiries (
  id           uuid default gen_random_uuid() primary key,
  name         text not null,
  phone        text not null,
  business     text,
  message      text,
  is_read      boolean default false,
  submitted_at timestamptz default now()
);

alter table inquiries enable row level security;
-- Anyone can submit (anonymous insert)
create policy "anon_insert"  on inquiries for insert with check (true);
-- Only authenticated users can read / delete
create policy "auth_manage"  on inquiries for all using (auth.role() = 'authenticated');

*/
