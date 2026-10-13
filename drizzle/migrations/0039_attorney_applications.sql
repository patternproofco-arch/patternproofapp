-- Lovable sync 2026-10-11: renumbered from Lovable drizzle 0028 (already present on the
-- published database). Made re-runnable with IF NOT EXISTS; otherwise unchanged.
CREATE TABLE IF NOT EXISTS public.attorney_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  firm_name text,
  bar_number text,
  jurisdiction text,
  note text,
  source text NOT NULL DEFAULT 'apply' CHECK (source IN ('apply','founder_invite')),
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  invited_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $do$
BEGIN
  -- An older copy of this table may lack these columns; never fail the bring-up on it.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
             AND table_name = 'attorney_applications' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS attorney_applications_status_idx ON public.attorney_applications (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS attorney_applications_email_idx ON public.attorney_applications (lower(email), created_at DESC);
  ELSE
    RAISE NOTICE 'public.attorney_applications has no created_at column: indexes skipped';
  END IF;
END
$do$;
REVOKE ALL ON public.attorney_applications FROM anon, authenticated;
GRANT ALL ON public.attorney_applications TO service_role;
ALTER TABLE public.attorney_applications ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.attorney_applications IS 'Attorney access requests. Server-only; founder approves before any attorney role is granted.';
