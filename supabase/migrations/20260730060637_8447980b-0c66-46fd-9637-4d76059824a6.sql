DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='advocate') THEN
    ALTER TYPE public.app_role ADD VALUE 'advocate';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.advocate_profiles (
  user_id uuid PRIMARY KEY,
  full_name text NOT NULL,
  org_name text,
  email text NOT NULL,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.advocate_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL,
  advocate_email text NOT NULL,
  advocate_name text,
  org_name text,
  personal_note text,
  invite_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  include_all_incidents boolean NOT NULL DEFAULT true,
  include_all_evidence boolean NOT NULL DEFAULT true,
  include_patterns boolean NOT NULL DEFAULT true,
  scope_incidents uuid[] NOT NULL DEFAULT '{}',
  scope_evidence uuid[] NOT NULL DEFAULT '{}',
  date_range_start date,
  date_range_end date,
  case_id uuid,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.advocate_client_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advocate_user_id uuid NOT NULL,
  client_user_id uuid NOT NULL,
  invitation_id uuid REFERENCES public.advocate_invitations(id) ON DELETE SET NULL,
  include_all_incidents boolean NOT NULL DEFAULT true,
  include_all_evidence boolean NOT NULL DEFAULT true,
  include_patterns boolean NOT NULL DEFAULT true,
  scope_incidents uuid[] NOT NULL DEFAULT '{}',
  scope_evidence uuid[] NOT NULL DEFAULT '{}',
  case_id uuid,
  status text NOT NULL DEFAULT 'active',
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advocate_invitations_client_idx ON public.advocate_invitations(client_user_id);
CREATE INDEX IF NOT EXISTS advocate_links_client_idx ON public.advocate_client_links(client_user_id);
CREATE INDEX IF NOT EXISTS advocate_links_advocate_idx ON public.advocate_client_links(advocate_user_id);

GRANT SELECT ON public.advocate_profiles TO authenticated;
GRANT SELECT ON public.advocate_invitations TO authenticated;
GRANT SELECT ON public.advocate_client_links TO authenticated;
GRANT ALL ON public.advocate_profiles TO service_role;
GRANT ALL ON public.advocate_invitations TO service_role;
GRANT ALL ON public.advocate_client_links TO service_role;

ALTER TABLE public.advocate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advocate_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advocate_client_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advocates read own profile" ON public.advocate_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Survivor reads own advocate invitations" ON public.advocate_invitations
  FOR SELECT TO authenticated USING (auth.uid() = client_user_id);

CREATE POLICY "Survivor reads own advocate links" ON public.advocate_client_links
  FOR SELECT TO authenticated USING (auth.uid() = client_user_id);

CREATE POLICY "Advocate reads own links" ON public.advocate_client_links
  FOR SELECT TO authenticated USING (auth.uid() = advocate_user_id);

CREATE TRIGGER advocate_profiles_touch BEFORE UPDATE ON public.advocate_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();