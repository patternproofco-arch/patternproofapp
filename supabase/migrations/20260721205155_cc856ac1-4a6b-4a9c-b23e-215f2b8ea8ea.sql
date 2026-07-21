
-- Date precision on incidents
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS date_precision text NOT NULL DEFAULT 'exact',
  ADD COLUMN IF NOT EXISTS date_range_start date,
  ADD COLUMN IF NOT EXISTS date_range_end date,
  ADD COLUMN IF NOT EXISTS anchor_incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS anchor_label text;

ALTER TABLE public.incidents
  ADD CONSTRAINT incidents_date_precision_check
    CHECK (date_precision IN ('exact','approximate_month','range','before_anchor','after_anchor','unknown'));

-- Existing rows default to 'exact' already via DEFAULT; ensure NULLs (if any) get set
UPDATE public.incidents SET date_precision = 'exact' WHERE date_precision IS NULL;

-- Allow date to be null (for date_precision = 'unknown' or anchor-only records)
ALTER TABLE public.incidents ALTER COLUMN date DROP NOT NULL;

-- Future-proofing: attorney_client_links.org_id (no FK yet — organizations table doesn't exist)
ALTER TABLE public.attorney_client_links
  ADD COLUMN IF NOT EXISTS org_id uuid;
