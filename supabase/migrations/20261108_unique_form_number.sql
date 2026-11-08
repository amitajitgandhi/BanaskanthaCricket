-- Prevent duplicate Form Numbers, ignoring leading/trailing spaces and letter case.
-- If this migration reports duplicates, resolve those existing records before rerunning.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.sbkym_registrations
    GROUP BY lower(btrim(form_number))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate Form Numbers already exist in sbkym_registrations. Resolve them before adding the unique index.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS sbkym_registrations_form_number_unique
ON public.sbkym_registrations (lower(btrim(form_number)));
