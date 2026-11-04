-- Add track-pant sizing to SBKYM Premier League registrations.
-- Existing registrations remain valid; this field is nullable for older rows.
ALTER TABLE public.sbkym_registrations ADD COLUMN IF NOT EXISTS track_pant_size text;
