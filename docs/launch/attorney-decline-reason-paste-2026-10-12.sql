-- RUN ON muy ONLY, AFTER the #214 bring-up (Section 1). Safe to run twice. Adds two empty columns; changes no rows.
-- Decline reasons for attorney applications (nullable; nothing is backfilled).
-- Written only by server functions (service role). The applicant can already read their own row.
ALTER TABLE public.attorney_access_applications ADD COLUMN IF NOT EXISTS decline_reason text;
ALTER TABLE public.attorney_access_applications ADD COLUMN IF NOT EXISTS decline_reason_emailed_at timestamptz;
