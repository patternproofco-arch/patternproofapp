CREATE TABLE public.email_relay_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  ip_hash text,
  template_name text NOT NULL,
  outcome text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.email_relay_attempts TO service_role;

ALTER TABLE public.email_relay_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX email_relay_attempts_user_time_idx ON public.email_relay_attempts (user_id, created_at DESC);
CREATE INDEX email_relay_attempts_ip_time_idx ON public.email_relay_attempts (ip_hash, created_at DESC);