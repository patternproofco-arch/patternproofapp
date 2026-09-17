ALTER TABLE public.user_security_settings
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_salt text,
  ADD COLUMN IF NOT EXISTS pin_failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS biometric_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.attorney_invitations
  ADD COLUMN IF NOT EXISTS include_voice_notes boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_communications boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_legal_documents boolean NOT NULL DEFAULT false;

ALTER TABLE public.attorney_client_links
  ADD COLUMN IF NOT EXISTS include_voice_notes boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_communications boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_legal_documents boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.attorney_client_links l
SET expires_at = i.expires_at
FROM public.attorney_invitations i
WHERE l.invitation_id = i.id AND l.expires_at IS NULL;

ALTER TABLE public.advocate_client_links
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.advocate_client_links l
SET expires_at = i.expires_at
FROM public.advocate_invitations i
WHERE l.invitation_id = i.id AND l.expires_at IS NULL;

CREATE TABLE IF NOT EXISTS public.ai_chat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_chat_requests_user_created_idx
  ON public.ai_chat_requests (user_id, created_at DESC);
ALTER TABLE public.ai_chat_requests ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ai_chat_requests TO service_role;