ALTER TABLE public.ai_chat_requests ADD COLUMN IF NOT EXISTS ip_hash text null;
CREATE INDEX IF NOT EXISTS ai_chat_requests_ip_hash_created_at_idx ON public.ai_chat_requests (ip_hash, created_at DESC);
ALTER TABLE public.support_requests ADD COLUMN IF NOT EXISTS ip_hash text null;
CREATE INDEX IF NOT EXISTS support_requests_ip_hash_created_at_idx ON public.support_requests (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS support_requests_reply_email_created_at_idx ON public.support_requests (reply_email, created_at DESC);
GRANT EXECUTE ON FUNCTION public.record_audit_event(uuid, text, text, uuid, text, uuid, jsonb) TO authenticated;