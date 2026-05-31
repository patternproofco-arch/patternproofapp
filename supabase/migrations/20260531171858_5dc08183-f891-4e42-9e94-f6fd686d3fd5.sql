-- Richer invitation fields for the redesigned share flow
ALTER TABLE public.attorney_invitations
  ADD COLUMN IF NOT EXISTS firm_name text,
  ADD COLUMN IF NOT EXISTS personal_note text,
  ADD COLUMN IF NOT EXISTS date_range_start date,
  ADD COLUMN IF NOT EXISTS date_range_end date;

-- Attorney-private notes per incident (survivor never sees these)
CREATE TABLE IF NOT EXISTS public.attorney_incident_notes (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null,
  attorney_user_id uuid not null,
  client_user_id uuid not null,
  incident_id uuid not null,
  note text,
  flagged boolean not null default false,
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (link_id, incident_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attorney_incident_notes TO authenticated;
GRANT ALL ON public.attorney_incident_notes TO service_role;

ALTER TABLE public.attorney_incident_notes ENABLE ROW LEVEL SECURITY;

-- Only the attorney on an active link can read/write their own private notes.
-- Survivor (client) is intentionally NOT given access — these are work-product.
CREATE POLICY "Attorney reads own notes"
  ON public.attorney_incident_notes
  FOR SELECT TO authenticated
  USING (
    auth.uid() = attorney_user_id
    AND EXISTS (
      SELECT 1 FROM public.attorney_client_links l
      WHERE l.id = attorney_incident_notes.link_id
        AND l.attorney_user_id = auth.uid()
        AND l.status = 'active'
    )
  );

CREATE POLICY "Attorney writes own notes"
  ON public.attorney_incident_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = attorney_user_id
    AND EXISTS (
      SELECT 1 FROM public.attorney_client_links l
      WHERE l.id = attorney_incident_notes.link_id
        AND l.attorney_user_id = auth.uid()
        AND l.client_user_id = attorney_incident_notes.client_user_id
        AND l.status = 'active'
    )
  );

CREATE POLICY "Attorney updates own notes"
  ON public.attorney_incident_notes
  FOR UPDATE TO authenticated
  USING (auth.uid() = attorney_user_id)
  WITH CHECK (auth.uid() = attorney_user_id);

CREATE POLICY "Attorney deletes own notes"
  ON public.attorney_incident_notes
  FOR DELETE TO authenticated
  USING (auth.uid() = attorney_user_id);

CREATE TRIGGER attorney_incident_notes_touch
  BEFORE UPDATE ON public.attorney_incident_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();