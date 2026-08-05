CREATE TABLE public.share_link_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  ip_hash text,
  outcome text NOT NULL,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.share_link_access_log TO service_role;

ALTER TABLE public.share_link_access_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX share_link_access_log_token_time_idx ON public.share_link_access_log (token_hash, created_at DESC);
CREATE INDEX share_link_access_log_ip_time_idx ON public.share_link_access_log (ip_hash, created_at DESC);