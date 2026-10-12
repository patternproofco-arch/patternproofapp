-- Fictional isolated schema for exercising the new migration on PostgreSQL.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth, public TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon, service_role;

CREATE TABLE public.incidents (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users,
  description text, date date, date_precision text, updated_at timestamptz,
  confirmed_at timestamptz, deleted_at timestamptz, share_readiness text
);
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_incidents ON public.incidents TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, UPDATE ON public.incidents TO authenticated;
CREATE TABLE public.evidence (id uuid PRIMARY KEY, user_id uuid, deleted_at timestamptz,
  file_url text, sha256 text, description text);
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_evidence ON public.evidence TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, UPDATE ON public.evidence TO authenticated;
CREATE TABLE public.attorney_client_links (
  id uuid PRIMARY KEY, client_user_id uuid, attorney_user_id uuid,
  status text, expires_at timestamptz, revoked_at timestamptz,
  clio_share_consent boolean DEFAULT false, clio_share_consent_at timestamptz,
  scope_evidence uuid[] DEFAULT '{}', scope_incidents uuid[] DEFAULT '{}',
  include_all_incidents boolean DEFAULT false, include_all_evidence boolean DEFAULT false, case_id uuid
);
CREATE TABLE public.advocate_client_links (LIKE public.attorney_client_links INCLUDING ALL);
CREATE TABLE public.attorney_invitations (LIKE public.attorney_client_links INCLUDING ALL);
CREATE TABLE public.advocate_invitations (LIKE public.attorney_client_links INCLUDING ALL);
CREATE TABLE public.cases (id uuid PRIMARY KEY, user_id uuid, highlighted_incident_ids uuid[], attached_evidence_ids uuid[]);
CREATE TABLE public.attorney_access (id uuid PRIMARY KEY, user_id uuid, revoked_at timestamptz, expires_at timestamptz,
  shared_incident_ids uuid[], shared_evidence_ids uuid[]);
CREATE TABLE public.attorney_document_requests (
  id uuid PRIMARY KEY, link_id uuid REFERENCES public.attorney_client_links,
  attorney_user_id uuid, client_user_id uuid, title text, details text,
  status text DEFAULT 'open', completed_at timestamptz, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.attorney_document_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.attorney_document_requests TO authenticated;
GRANT SELECT ON public.attorney_client_links TO authenticated;
CREATE POLICY "Participants read doc requests" ON public.attorney_document_requests TO authenticated
  USING (auth.uid() IN (attorney_user_id, client_user_id));

INSERT INTO auth.users VALUES
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003');
INSERT INTO public.incidents (id, user_id, description, date_precision) VALUES
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Earlier account', 'unknown');
INSERT INTO public.attorney_client_links (id, client_user_id, attorney_user_id, status) VALUES
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'active');
INSERT INTO public.evidence (id, user_id, deleted_at) VALUES
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', null),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', null),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', now()),
  ('30000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', null);
INSERT INTO public.attorney_document_requests (id, link_id, attorney_user_id, client_user_id, title)
SELECT ('40000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001', 'Fictional request ' || n
FROM generate_series(1, 12) n;
