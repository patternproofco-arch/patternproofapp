-- Child-protection professional role. Added alone: a new enum value cannot be used in the
-- transaction that adds it, so every table and policy that needs it is in the next migration.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='cps_worker') THEN
  ALTER TYPE public.app_role ADD VALUE 'cps_worker';
 END IF;
END $$;
