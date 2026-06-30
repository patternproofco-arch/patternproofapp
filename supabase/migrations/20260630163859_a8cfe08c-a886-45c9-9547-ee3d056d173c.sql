CREATE TABLE public.case_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.attorney_client_links(id) ON DELETE CASCADE,
  owner_attorney_user_id UUID NOT NULL,
  collaborator_user_id UUID,
  collaborator_email TEXT NOT NULL,
  collaborator_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('paralegal','associate','attorney')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  invite_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex') UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX case_collaborators_link_idx ON public.case_collaborators(link_id);
CREATE INDEX case_collaborators_collab_user_idx ON public.case_collaborators(collaborator_user_id);
CREATE INDEX case_collaborators_email_idx ON public.case_collaborators(lower(collaborator_email));
CREATE UNIQUE INDEX case_collaborators_link_email_uq ON public.case_collaborators(link_id, lower(collaborator_email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_collaborators TO authenticated;
GRANT ALL ON public.case_collaborators TO service_role;

ALTER TABLE public.case_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner attorney manages collaborators"
  ON public.case_collaborators
  FOR ALL TO authenticated
  USING (auth.uid() = owner_attorney_user_id)
  WITH CHECK (auth.uid() = owner_attorney_user_id);

CREATE POLICY "Collaborator reads own accepted row"
  ON public.case_collaborators
  FOR SELECT TO authenticated
  USING (auth.uid() = collaborator_user_id AND status = 'active');