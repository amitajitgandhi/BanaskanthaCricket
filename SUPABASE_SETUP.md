# CLBPL Season 12 — Supabase Setup

**This Supabase project is shared with RPL.** If you're setting both apps up together, use [`../SUPABASE_SETUP.md`](../SUPABASE_SETUP.md) at the Cricket-Tournament root instead — it creates both tournaments' tables and buckets in one pass. This file is CLBPL's half on its own, useful if CLBPL ever needs to move to its own separate project.

Run this once in your Supabase project: **Project → SQL Editor → New query**, paste the SQL below, and click **Run**. Every statement is idempotent, so it's safe to re-run if needed — including if you already ran an earlier version of this script with the old field set.

After running it, go to **Project Settings → API** and copy these three values into your Vercel project's Environment Variables — **the same three values also go into RPL's Vercel project**, since it's the same Supabase project:

- **Project URL** → `SUPABASE_URL`
- **anon public key** → `SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this one secret — server-side only)

Tables and buckets are prefixed `clbpl_` / `clbpl-` so they never collide with RPL's `rpl_` / `rpl-` ones in the same project. `clbpl-photos` is a public bucket (player photos show on the public roster); `clbpl-screenshots` stays private (payment screenshots, admin-only).

## SQL

```sql
-- ============================================================
-- CLBPL Season 12 — Supabase setup script
-- This Supabase project is SHARED with RPL — table and bucket
-- names are prefixed so both tournaments can coexist in one DB.
-- Run this once in Supabase: Project → SQL Editor → New query → Run.
-- Safe to re-run — every statement is idempotent, including for
-- anyone who already ran an earlier version of this script.
-- ============================================================

-- 1. Table ------------------------------------------------------

create table if not exists clbpl_registrations (
  id uuid primary key default gen_random_uuid(),
  registered_at timestamptz not null default now(),
  full_name text not null,
  mobile_number text not null,
  dob date not null,
  skillset text not null,
  bowling_arm text not null,
  batting_style text not null,
  photo_path text not null,
  cricheroes_link text not null,
  jersey_name text not null,
  jersey_number text not null,
  jersey_size text not null,
  payment_id text not null,
  fee_paid numeric not null,
  screenshot_path text not null,
  -- Administrator manually sets this to 'Confirmed' once they've verified
  -- the player's payment. Everyone starts out 'Pending'.
  status text not null default 'Pending' check (status in ('Pending', 'Confirmed'))
);

-- Migration for anyone who already ran an earlier version of this table
-- with the old field set (gender/phone/email/address/tshirt_size/
-- playing_role/previous_team/emergency contact/upi_ref):
alter table clbpl_registrations add column if not exists mobile_number text;
alter table clbpl_registrations add column if not exists skillset text;
alter table clbpl_registrations add column if not exists bowling_arm text;
alter table clbpl_registrations add column if not exists batting_style text;
alter table clbpl_registrations add column if not exists photo_path text;
alter table clbpl_registrations add column if not exists cricheroes_link text;
alter table clbpl_registrations add column if not exists jersey_name text;
alter table clbpl_registrations add column if not exists jersey_number text;
alter table clbpl_registrations add column if not exists jersey_size text;
alter table clbpl_registrations add column if not exists payment_id text;
alter table clbpl_registrations drop column if exists gender;
alter table clbpl_registrations drop column if exists phone;
alter table clbpl_registrations drop column if exists email;
alter table clbpl_registrations drop column if exists address;
alter table clbpl_registrations drop column if exists tshirt_size;
alter table clbpl_registrations drop column if exists playing_role;
alter table clbpl_registrations drop column if exists previous_team;
alter table clbpl_registrations drop column if exists emergency_name;
alter table clbpl_registrations drop column if exists emergency_phone;
alter table clbpl_registrations drop column if exists upi_ref;

create table if not exists clbpl_qr_codes (
  id uuid primary key default gen_random_uuid(),
  label text default '',
  storage_path text not null,
  -- Controls which QR codes (and how many) show on the registration page.
  active boolean not null default false,
  uploaded_at timestamptz not null default now()
);

alter table clbpl_registrations enable row level security;
alter table clbpl_qr_codes enable row level security;
-- Intentionally no policies for anon/authenticated on these two tables —
-- every read/write goes through the serverless API using the service-role
-- key (which bypasses RLS). The browser never talks to these tables directly.

-- 2. Storage buckets --------------------------------------------

insert into storage.buckets (id, name, public)
values ('clbpl-screenshots', 'clbpl-screenshots', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('clbpl-qr-codes', 'clbpl-qr-codes', true)
on conflict (id) do nothing;

-- Player photos are shown publicly on the /players roster, so this bucket
-- is public (unlike the private screenshots bucket).
insert into storage.buckets (id, name, public)
values ('clbpl-photos', 'clbpl-photos', true)
on conflict (id) do nothing;

-- 3. Storage policies ---------------------------------------------

-- Players' browsers upload their own payment screenshot directly to this
-- bucket, but can never read, list, or delete anything in it.
drop policy if exists "clbpl anon can upload screenshots" on storage.objects;
create policy "clbpl anon can upload screenshots"
on storage.objects for insert
to anon
with check (bucket_id = 'clbpl-screenshots');

-- Anyone can view the QR codes an admin has published — needed so the
-- public registration page can display them. Uploading/deleting QR codes
-- only ever happens through the authenticated admin API (service-role key).
drop policy if exists "clbpl anon can view qr codes" on storage.objects;
create policy "clbpl anon can view qr codes"
on storage.objects for select
to anon
using (bucket_id = 'clbpl-qr-codes');

-- Players' browsers upload their own photo directly to this bucket, and
-- anyone can view photos (needed for the public /players roster).
drop policy if exists "clbpl anon can upload photos" on storage.objects;
create policy "clbpl anon can upload photos"
on storage.objects for insert
to anon
with check (bucket_id = 'clbpl-photos');

drop policy if exists "clbpl anon can view photos" on storage.objects;
create policy "clbpl anon can view photos"
on storage.objects for select
to anon
using (bucket_id = 'clbpl-photos');

-- ============================================================
-- Done. If this is the first tournament set up in this Supabase
-- project, also go to Project Settings → API and copy:
--   - Project URL            -> SUPABASE_URL
--   - anon public key        -> SUPABASE_ANON_KEY
--   - service_role key       -> SUPABASE_SERVICE_ROLE_KEY (server-side only!)
-- into this app's Vercel project's Environment Variables — RPL's Vercel
-- project uses the SAME three values, since it's the same Supabase project.
-- ============================================================
```
