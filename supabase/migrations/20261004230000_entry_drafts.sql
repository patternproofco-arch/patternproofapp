-- Private unfinished entries.
--
-- Until now an entry being written lived only in the page. Locking the app, navigating
-- away, refreshing or a dropped connection lost it. This keeps one draft per account in
-- the database, behind row-level security, instead of in the browser's local storage
-- (where sensitive text would sit in plain form on the device).
--
-- Only the owner can read, write or delete their draft. The app removes it as soon as the
-- entry is saved or discarded. Rows not touched for 30 days are meant to be purged by a
-- scheduled job (not included here; see the PR notes).
-- Grace: apply on muy only. Do not apply from CI/agent.

CREATE TABLE IF NOT EXISTS public.entry_drafts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);

ALTER TABLE public.entry_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entry_drafts_owner_select" ON public.entry_drafts;
DROP POLICY IF EXISTS "entry_drafts_owner_insert" ON public.entry_drafts;
DROP POLICY IF EXISTS "entry_drafts_owner_update" ON public.entry_drafts;
DROP POLICY IF EXISTS "entry_drafts_owner_delete" ON public.entry_drafts;

CREATE POLICY "entry_drafts_owner_select" ON public.entry_drafts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "entry_drafts_owner_insert" ON public.entry_drafts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entry_drafts_owner_update" ON public.entry_drafts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entry_drafts_owner_delete" ON public.entry_drafts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.entry_drafts FROM anon;
