CREATE TABLE IF NOT EXISTS public.attorney_exhibit_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.attorney_client_links(id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id, version)
);
CREATE TABLE IF NOT EXISTS public.attorney_declaration_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.attorney_client_links(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  attorney_notes text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id, user_id)
);
REVOKE ALL ON public.attorney_exhibit_packages FROM anon, authenticated;
REVOKE ALL ON public.attorney_declaration_drafts FROM anon, authenticated;
GRANT ALL ON public.attorney_exhibit_packages TO service_role;
GRANT ALL ON public.attorney_declaration_drafts TO service_role;
ALTER TABLE public.attorney_exhibit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attorney_declaration_drafts ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.attorney_exhibit_packages IS 'Frozen exhibit numbers per link. Opaque keys, numbers and change markers only; no readable content.';
COMMENT ON TABLE public.attorney_declaration_drafts IS 'Attorney working drafts. Unsigned, unsworn. attorney_notes are private and never exported.';