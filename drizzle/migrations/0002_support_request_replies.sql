ALTER TABLE public.support_requests ADD COLUMN IF NOT EXISTS reply_body text;
ALTER TABLE public.support_requests ADD COLUMN IF NOT EXISTS replied_at timestamptz;
ALTER TABLE public.support_requests ADD COLUMN IF NOT EXISTS replied_by uuid;