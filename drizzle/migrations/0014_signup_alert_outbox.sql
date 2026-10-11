-- A role write and its founder alert become durable in the same transaction.
-- No historical backfill: existing accounts are not treated as new signups.
CREATE TABLE IF NOT EXISTS public.signup_alert_outbox (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('survivor','attorney','advocate','organization')),
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz, outcome text,
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,role)
);
ALTER TABLE public.signup_alert_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.signup_alert_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.signup_alert_outbox TO service_role;

CREATE OR REPLACE FUNCTION private.enqueue_signup_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.role::text IN ('survivor','attorney','advocate') THEN
  INSERT INTO public.signup_alert_outbox(user_id,role) VALUES(NEW.user_id,NEW.role::text)
   ON CONFLICT(user_id,role) DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enqueue_signup_alert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enqueue_signup_alert ON public.user_roles;
CREATE TRIGGER enqueue_signup_alert AFTER INSERT ON public.user_roles
 FOR EACH ROW EXECUTE FUNCTION private.enqueue_signup_alert();

CREATE OR REPLACE FUNCTION public.claim_signup_alert(_user_id uuid,_role text,_enqueue boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE claimed uuid;
BEGIN
 IF _enqueue THEN
  INSERT INTO public.signup_alert_outbox(user_id,role) VALUES(_user_id,_role)
   ON CONFLICT(user_id,role) DO NOTHING;
 END IF;
 UPDATE public.signup_alert_outbox SET attempts=attempts+1,next_attempt_at=now()+interval '5 minutes'
 WHERE user_id=_user_id AND role=_role AND completed_at IS NULL AND next_attempt_at <= now()
 RETURNING user_id INTO claimed;
 RETURN claimed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_signup_alert(uuid,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_signup_alert(uuid,text,boolean) TO service_role;
