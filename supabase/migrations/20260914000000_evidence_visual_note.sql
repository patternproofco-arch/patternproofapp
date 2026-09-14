-- Every upload should get an AI-written note describing what it shows, not
-- just audio/video with speech or documents with text. Photos and silent
-- video (property damage, muted footage) were falling through with nothing.
ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS ai_visual_note text,
  ADD COLUMN IF NOT EXISTS ai_visual_note_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS ai_visual_note_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_visual_note_verified_by uuid;

CREATE INDEX IF NOT EXISTS evidence_ai_visual_note_status_idx
  ON public.evidence (user_id, ai_visual_note_status);
