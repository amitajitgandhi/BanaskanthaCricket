-- Add wicket-keeper selection to SBKYM Premier League registrations.
-- Existing registrations are retained; older records default to No in the admin UI.
ALTER TABLE public.sbkym_registrations
  ADD COLUMN IF NOT EXISTS wicket_keeper text;

-- Keep values constrained to the registration form's Yes/No options.
ALTER TABLE public.sbkym_registrations
  DROP CONSTRAINT IF EXISTS sbkym_registrations_wicket_keeper_check;

ALTER TABLE public.sbkym_registrations
  ADD CONSTRAINT sbkym_registrations_wicket_keeper_check
  CHECK (wicket_keeper IS NULL OR wicket_keeper IN ('Yes', 'No'));
