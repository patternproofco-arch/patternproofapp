CREATE TABLE IF NOT EXISTS public.entry_drafts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);
REVOKE ALL ON public.entry_drafts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entry_drafts TO authenticated;
GRANT ALL ON public.entry_drafts TO service_role;
ALTER TABLE public.entry_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "entry_drafts_owner_select" ON public.entry_drafts;
DROP POLICY IF EXISTS "entry_drafts_owner_insert" ON public.entry_drafts;
DROP POLICY IF EXISTS "entry_drafts_owner_update" ON public.entry_drafts;
DROP POLICY IF EXISTS "entry_drafts_owner_delete" ON public.entry_drafts;
CREATE POLICY "entry_drafts_owner_select" ON public.entry_drafts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "entry_drafts_owner_insert" ON public.entry_drafts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entry_drafts_owner_update" ON public.entry_drafts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entry_drafts_owner_delete" ON public.entry_drafts FOR DELETE TO authenticated USING (auth.uid() = user_id);