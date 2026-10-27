-- Run this once in the Supabase SQL Editor before accepting registrations with Form Number and Gotra.
-- Existing registrations remain intact; the new fields are nullable for older rows.
ALTER TABLE public.clbpl_registrations
  ADD COLUMN IF NOT EXISTS form_number text,
  ADD COLUMN IF NOT EXISTS gotra text;
