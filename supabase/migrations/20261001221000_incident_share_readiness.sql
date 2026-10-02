-- Soft-claim share readiness on timeline entries (Marks).
-- Fail-closed: default private — not eligible for share pickers / "share all"
-- snapshots until the survivor explicitly chooses "OK to share later".
-- Does NOT grant access by itself. Does NOT widen existing grant scopes.
-- Grace: apply on muy only. Do not apply from CI/agent.

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS share_readiness text NOT NULL DEFAULT 'private';

ALTER TABLE public.incidents
  DROP CONSTRAINT IF EXISTS incidents_share_readiness_check;

ALTER TABLE public.incidents
  ADD CONSTRAINT incidents_share_readiness_check
  CHECK (share_readiness IN ('private', 'ok_to_share', 'undecided'));

COMMENT ON COLUMN public.incidents.share_readiness IS
  'Survivor sharing readiness: private (default, not share-eligible), ok_to_share (still private until invited into a grant), undecided (treated as private). Never widens access by itself.';

-- Evidence files: same fail-closed readiness for consistency with binder honesty.
ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS share_readiness text NOT NULL DEFAULT 'private';

ALTER TABLE public.evidence
  DROP CONSTRAINT IF EXISTS evidence_share_readiness_check;

ALTER TABLE public.evidence
  ADD CONSTRAINT evidence_share_readiness_check
  CHECK (share_readiness IN ('private', 'ok_to_share', 'undecided'));

COMMENT ON COLUMN public.evidence.share_readiness IS
  'Survivor sharing readiness for files. Default private. Never widens access by itself.';
