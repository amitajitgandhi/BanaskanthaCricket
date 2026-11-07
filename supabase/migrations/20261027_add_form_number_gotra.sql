-- Add Form Number and Gotra to SBKYM Premier League registrations.
-- Existing registrations remain intact; these fields are nullable for older rows.
ALTER TABLE public.sbkym_registrations
  ADD COLUMN IF NOT EXISTS form_number text,
  ADD COLUMN IF NOT EXISTS gotra text;
