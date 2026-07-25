
ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS exif_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS in_image_timestamp_text text,
  ADD COLUMN IF NOT EXISTS in_image_timestamp_at timestamptz,
  ADD COLUMN IF NOT EXISTS ingested_at timestamptz,
  ADD COLUMN IF NOT EXISTS gps_lat double precision,
  ADD COLUMN IF NOT EXISTS gps_lon double precision,
  ADD COLUMN IF NOT EXISTS gps_reveal_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS transcript_segments jsonb,
  ADD COLUMN IF NOT EXISTS transcript_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS transcript_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS transcript_verified_by uuid,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS suggested_incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_reason text;

-- Backfill ingested_at from created_at for existing rows.
UPDATE public.evidence SET ingested_at = created_at WHERE ingested_at IS NULL;

COMMENT ON COLUMN public.evidence.gps_lat IS 'QUARANTINED. Do not select in user-facing queries unless gps_reveal_opt_in=true. Safety: can reveal survivor location.';
COMMENT ON COLUMN public.evidence.gps_lon IS 'QUARANTINED. Do not select in user-facing queries unless gps_reveal_opt_in=true.';
COMMENT ON COLUMN public.evidence.review_status IS 'suggested | confirmed | skipped. Only confirmed rows appear in official timeline/exports/attorney portal.';
COMMENT ON COLUMN public.evidence.transcript IS 'AI-generated. Treat as unverified until transcript_verified_at is non-null.';

CREATE INDEX IF NOT EXISTS evidence_review_status_idx
  ON public.evidence(user_id, review_status)
  WHERE deleted_at IS NULL;
