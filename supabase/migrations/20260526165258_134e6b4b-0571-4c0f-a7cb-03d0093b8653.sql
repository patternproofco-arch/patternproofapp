-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('survivor', 'attorney', 'admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own roles" ON public.user_roles
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 2. Attorney profile
CREATE TABLE public.attorney_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  firm_name TEXT,
  bar_number TEXT,
  jurisdiction TEXT,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.attorney_profiles TO authenticated;
GRANT ALL ON public.attorney_profiles TO service_role;

ALTER TABLE public.attorney_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attorneys manage own profile" ON public.attorney_profiles
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER attorney_profiles_touch_updated_at
BEFORE UPDATE ON public.attorney_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Invitations
CREATE TABLE public.attorney_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL,
  attorney_email TEXT NOT NULL,
  attorney_name TEXT,
  invite_token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  scope_incidents UUID[] NOT NULL DEFAULT '{}',
  scope_evidence UUID[] NOT NULL DEFAULT '{}',
  include_all_incidents BOOLEAN NOT NULL DEFAULT true,
  include_all_evidence BOOLEAN NOT NULL DEFAULT true,
  include_patterns BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX attorney_invitations_token_idx ON public.attorney_invitations(invite_token);
CREATE INDEX attorney_invitations_client_idx ON public.attorney_invitations(client_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attorney_invitations TO authenticated;
GRANT ALL ON public.attorney_invitations TO service_role;

ALTER TABLE public.attorney_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients manage own invitations" ON public.attorney_invitations
FOR ALL TO authenticated
USING (auth.uid() = client_user_id)
WITH CHECK (auth.uid() = client_user_id);

-- 4. Active links
CREATE TABLE public.attorney_client_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_user_id UUID NOT NULL,
  client_user_id UUID NOT NULL,
  invitation_id UUID REFERENCES public.attorney_invitations(id) ON DELETE SET NULL,
  scope_incidents UUID[] NOT NULL DEFAULT '{}',
  scope_evidence UUID[] NOT NULL DEFAULT '{}',
  include_all_incidents BOOLEAN NOT NULL DEFAULT true,
  include_all_evidence BOOLEAN NOT NULL DEFAULT true,
  include_patterns BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active',
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(attorney_user_id, client_user_id)
);

CREATE INDEX attorney_client_links_attorney_idx ON public.attorney_client_links(attorney_user_id);
CREATE INDEX attorney_client_links_client_idx ON public.attorney_client_links(client_user_id);

GRANT SELECT, INSERT, UPDATE ON public.attorney_client_links TO authenticated;
GRANT ALL ON public.attorney_client_links TO service_role;

ALTER TABLE public.attorney_client_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read links" ON public.attorney_client_links
FOR SELECT TO authenticated
USING (auth.uid() = attorney_user_id OR auth.uid() = client_user_id);

CREATE POLICY "Clients revoke own links" ON public.attorney_client_links
FOR UPDATE TO authenticated
USING (auth.uid() = client_user_id);

CREATE OR REPLACE FUNCTION public.has_attorney_access(_attorney_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.attorney_client_links
    WHERE attorney_user_id = _attorney_id
      AND client_user_id = _client_id
      AND status = 'active'
  )
$$;

-- 5. Secure messages
CREATE TABLE public.attorney_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.attorney_client_links(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL,
  sender_role public.app_role NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX attorney_messages_link_idx ON public.attorney_messages(link_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.attorney_messages TO authenticated;
GRANT ALL ON public.attorney_messages TO service_role;

ALTER TABLE public.attorney_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read messages" ON public.attorney_messages
FOR SELECT TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = attorney_messages.link_id
      AND (l.attorney_user_id = auth.uid() OR l.client_user_id = auth.uid())
  )
);

CREATE POLICY "Participants send messages" ON public.attorney_messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_user_id AND
  EXISTS(
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = attorney_messages.link_id
      AND (l.attorney_user_id = auth.uid() OR l.client_user_id = auth.uid())
      AND l.status = 'active'
  )
);

CREATE POLICY "Recipients mark read" ON public.attorney_messages
FOR UPDATE TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = attorney_messages.link_id
      AND (l.attorney_user_id = auth.uid() OR l.client_user_id = auth.uid())
  )
);

-- 6. Document requests
CREATE TABLE public.attorney_document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.attorney_client_links(id) ON DELETE CASCADE,
  attorney_user_id UUID NOT NULL,
  client_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX attorney_doc_requests_link_idx ON public.attorney_document_requests(link_id);

GRANT SELECT, INSERT, UPDATE ON public.attorney_document_requests TO authenticated;
GRANT ALL ON public.attorney_document_requests TO service_role;

ALTER TABLE public.attorney_document_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read doc requests" ON public.attorney_document_requests
FOR SELECT TO authenticated
USING (auth.uid() = attorney_user_id OR auth.uid() = client_user_id);

CREATE POLICY "Attorneys create doc requests" ON public.attorney_document_requests
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = attorney_user_id);

CREATE POLICY "Participants update doc requests" ON public.attorney_document_requests
FOR UPDATE TO authenticated
USING (auth.uid() = attorney_user_id OR auth.uid() = client_user_id);

-- 7. Time logs
CREATE TABLE public.attorney_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_user_id UUID NOT NULL,
  client_user_id UUID NOT NULL,
  link_id UUID REFERENCES public.attorney_client_links(id) ON DELETE SET NULL,
  page_path TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX attorney_time_logs_attorney_idx ON public.attorney_time_logs(attorney_user_id, started_at);
CREATE INDEX attorney_time_logs_client_idx ON public.attorney_time_logs(client_user_id);

GRANT SELECT, INSERT, UPDATE ON public.attorney_time_logs TO authenticated;
GRANT ALL ON public.attorney_time_logs TO service_role;

ALTER TABLE public.attorney_time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attorneys manage own time logs" ON public.attorney_time_logs
FOR ALL TO authenticated
USING (auth.uid() = attorney_user_id)
WITH CHECK (auth.uid() = attorney_user_id);

CREATE POLICY "Clients view their time logs" ON public.attorney_time_logs
FOR SELECT TO authenticated
USING (auth.uid() = client_user_id);