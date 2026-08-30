-- Security audit fixes (Aug 2026 pass 4).
--
-- 1. Server-verifiable app-lock (PIN) state, replacing a client-only hash +
--    sessionStorage flag that could be bypassed by writing directly to
--    sessionStorage from devtools.
-- 2. Per-category consent + real expiry on attorney/advocate case-sharing
--    links, so "what they can see" and "access expires on X" are enforced,
--    not just displayed.
-- 3. Server-enforced storage bucket size/mime caps (client-side checks only
--    today).

/* ---------------------------------------------------------------------- */
/* 1. Server-verifiable app lock                                           */
/* ---------------------------------------------------------------------- */

ALTER TABLE public.user_security_settings
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_salt text,
  ADD COLUMN IF NOT EXISTS pin_failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS biometric_enabled boolean NOT NULL DEFAULT false;

-- Existing PIN hashes lived only in the browser's localStorage and cannot be
-- migrated server-side; every account with a lock previously set up will be
-- asked to re-enter a PIN (or re-enroll biometric) once, the same recovery
-- flow already shown today when site data is cleared.

/* ---------------------------------------------------------------------- */
/* 2a. Attorney sharing: per-category consent + denormalized expiry        */
/* ---------------------------------------------------------------------- */

ALTER TABLE public.attorney_invitations
  ADD COLUMN IF NOT EXISTS include_voice_notes boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_communications boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_legal_documents boolean NOT NULL DEFAULT false;

ALTER TABLE public.attorney_client_links
  ADD COLUMN IF NOT EXISTS include_voice_notes boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_communications boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_legal_documents boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Backfill expiry only (a date the survivor already set and the UI already
-- displayed as if enforced). The three new consent categories default to
-- false for existing links too: the original consent screen never offered
-- them, so no prior grant actually covered them regardless of what the
-- code was returning.
UPDATE public.attorney_client_links l
SET expires_at = i.expires_at
FROM public.attorney_invitations i
WHERE l.invitation_id = i.id AND l.expires_at IS NULL;

/* ---------------------------------------------------------------------- */
/* 2b. Advocate sharing: denormalized expiry                               */
/* ---------------------------------------------------------------------- */

ALTER TABLE public.advocate_client_links
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.advocate_client_links l
SET expires_at = i.expires_at
FROM public.advocate_invitations i
WHERE l.invitation_id = i.id AND l.expires_at IS NULL;

/* ---------------------------------------------------------------------- */
/* 3. Storage bucket server-side limits                                    */
/* ---------------------------------------------------------------------- */

UPDATE storage.buckets
SET file_size_limit = 209715200, -- 200 MB, matches UPLOAD_LIMITS.video (the app's own stated max)
    allowed_mime_types = ARRAY[
      'image/jpeg','image/png','image/webp','image/heic','image/gif',
      'application/pdf',
      'audio/mpeg','audio/mp4','audio/wav','audio/x-m4a','audio/webm','audio/aac',
      'video/mp4','video/webm','video/quicktime'
    ]
WHERE id = 'evidence-files';

UPDATE storage.buckets
SET file_size_limit = 104857600, -- 100 MB, matches UPLOAD_LIMITS.audio
    allowed_mime_types = ARRAY[
      'audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/x-m4a','audio/aac'
    ]
WHERE id = 'voice-notes';

UPDATE storage.buckets
SET file_size_limit = 209715200, -- 200 MB, matches UPLOAD_LIMITS.video
    allowed_mime_types = ARRAY['audio/webm','video/webm','video/mp4']
WHERE id = 'conversation-recordings';

-- The message-exports bucket itself was never created — migration
-- 20260623213804 added storage.objects RLS policies referencing
-- bucket_id = 'message-exports' but never inserted the bucket row. Verified
-- against production: zero rows in storage.objects for that bucket_id ever,
-- meaning every message-thread import upload has been failing silently
-- since the feature shipped (Supabase Storage rejects uploads to a
-- bucket_id with no corresponding storage.buckets row). This is a separate,
-- pre-existing functional bug turned up while applying this migration, not
-- part of the original audit findings — fixed here since it blocks the same
-- code path this migration is already touching.
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-exports', 'message-exports', false)
ON CONFLICT (id) DO NOTHING;

-- message-exports accepts a wider, less predictable set of import formats;
-- cap size only (closes the unbounded-upload / storage-cost risk) without
-- risking a legitimate import format being silently rejected.
UPDATE storage.buckets
SET file_size_limit = 209715200 -- 200 MB
WHERE id = 'message-exports';

/* ---------------------------------------------------------------------- */
/* 4. AI chat rate limiting                                                */
/* ---------------------------------------------------------------------- */

-- sidekickChat (src/lib/ai-chat.functions.ts) had no per-user throttle at
-- all against the shared AI-gateway key. Internal counter table only —
-- service-role access exclusively, same pattern as clio_oauth_states /
-- email_relay_attempts (RLS enabled, no policies = deny-all to
-- anon/authenticated, service role bypasses RLS).
CREATE TABLE IF NOT EXISTS public.ai_chat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_chat_requests_user_created_idx
  ON public.ai_chat_requests (user_id, created_at DESC);
ALTER TABLE public.ai_chat_requests ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ai_chat_requests TO service_role;
-- Rows only need to answer "how many in the last minute" and this table has
-- no scheduled cleanup job in this codebase today — if it's added to a
-- pg_cron schedule later, `DELETE FROM ai_chat_requests WHERE created_at <
-- now() - interval '1 day'` is all it needs.
