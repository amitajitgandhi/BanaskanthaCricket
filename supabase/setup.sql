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
  -- Payment ID and screenshot are only present for QR payments — a Cash
  -- payment has neither (verified by the organizer at the venue instead).
  payment_id text,
  fee_paid numeric not null,
  screenshot_path text,
  -- The payment method the registrant chose: a QR code's label (e.g.
  -- "HDFC Bank") or literally "Cash". QR codes get rotated during the
  -- registration window, so this is how a payment traces back to which one
  -- was active when it was made — no foreign key, just the label text, so
  -- it stays readable even after that QR code is later removed.
  qr_label text,
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

-- Migration: payment method tracking (Cash option + which QR was active).
-- Existing rows keep their current payment_id/screenshot_path; qr_label
-- will just be blank for registrations made before this was added.
alter table clbpl_registrations alter column payment_id drop not null;
alter table clbpl_registrations alter column screenshot_path drop not null;
alter table clbpl_registrations add column if not exists qr_label text;

create table if not exists clbpl_qr_codes (
  id uuid primary key default gen_random_uuid(),
  label text default '',
  storage_path text not null,
  -- Controls which QR codes (and how many) show on the registration page.
  active boolean not null default false,
  uploaded_at timestamptz not null default now()
);

-- Maps a placeholder team code used on the public schedule (A1..A16,
-- W1..W4) to the real team name the admin has entered. A row only exists
-- once an admin has actually named that placeholder; the schedule page
-- falls back to showing the placeholder itself when there's no row yet.
create table if not exists clbpl_team_names (
  placeholder text primary key,
  team_name text not null default '',
  updated_at timestamptz not null default now()
);

alter table clbpl_registrations enable row level security;
alter table clbpl_qr_codes enable row level security;
alter table clbpl_team_names enable row level security;
-- Intentionally no policies for anon/authenticated on these tables —
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

-- Track whether the payment/transaction ID was auto-detected via OCR
-- from the uploaded screenshot (true), entered manually (false), or not
-- applicable for a Cash payment (null).
alter table clbpl_registrations add column if not exists payment_id_auto_detected boolean;

-- Manually tracked by the admin: how the registration fee was actually
-- collected (Pending / Paid Online / Paid Cash to Amit / Paid Cash to
-- Bhavesh) -- independent of the QR/Cash method the registrant *selected*
-- on the form (qr_label), and independent of the Confirmed/Pending status.
alter table clbpl_registrations add column if not exists payment_collection_status text default 'Pending';

-- Single-row table of admin-controlled, app-wide on/off switches.
-- Currently just whether the /register page is accepting new
-- registrations -- flipped from the admin dashboard's "Registration
-- Control" panel (Insight tab), read publicly via /api/config, and
-- enforced server-side in /api/register so it can't be bypassed by
-- posting to the API directly once the public page is closed.
create table if not exists clbpl_app_settings (
  id int primary key default 1,
  registration_open boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into clbpl_app_settings (id, registration_open)
values (1, true)
on conflict (id) do nothing;
