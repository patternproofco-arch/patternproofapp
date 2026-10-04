-- Stable exhibit numbering + attorney declaration drafts.
--
-- exhibit_packages: an explicit, numbered package version per attorney link.
--   Stores ONLY opaque item keys, exhibit numbers and change markers. No titles,
--   dates or text, so nothing readable outlives the survivor's access.
-- declaration_drafts: the attorney's own working draft (item choices, edited
--   wording, private notes). The survivor's records are never modified by it.
--
-- Access: server functions only (service role) after the attorney-access checks.
-- RLS is on with no policies, so no signed-in user can read or write these tables directly.
-- Grace: apply on muy only. Do not apply from CI/agent.

CREATE TABLE IF NOT EXISTS public.attorney_exhibit_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.attorney_client_links(id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  -- [{ key, number, kind, marker }]
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
  -- Private to the author. Never part of any export.
  attorney_notes text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id, user_id)
);

ALTER TABLE public.attorney_exhibit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attorney_declaration_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attorney_exhibit_packages FROM anon, authenticated;
REVOKE ALL ON public.attorney_declaration_drafts FROM anon, authenticated;

COMMENT ON TABLE public.attorney_exhibit_packages IS
  'Frozen exhibit numbers per link. Opaque keys, numbers and change markers only; no readable content.';
COMMENT ON TABLE public.attorney_declaration_drafts IS
  'Attorney working drafts. Unsigned, unsworn. attorney_notes are private and never exported.';
