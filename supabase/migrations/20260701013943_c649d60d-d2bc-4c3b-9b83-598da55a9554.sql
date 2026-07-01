-- time_entries: manual billable/non-billable time logging per case
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_link_id UUID NOT NULL REFERENCES public.attorney_client_links(id) ON DELETE CASCADE,
  attorney_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  minutes INTEGER NOT NULL CHECK (minutes > 0 AND minutes <= 24*60),
  billable BOOLEAN NOT NULL DEFAULT true,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX time_entries_link_idx ON public.time_entries(case_link_id, entry_date DESC);
CREATE INDEX time_entries_attorney_idx ON public.time_entries(attorney_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Author manages their own entries; case owner can see all entries on the case.
CREATE POLICY "time_entries author full access"
  ON public.time_entries
  FOR ALL
  TO authenticated
  USING (attorney_user_id = auth.uid())
  WITH CHECK (attorney_user_id = auth.uid());

CREATE POLICY "time_entries case owner read"
  ON public.time_entries
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = time_entries.case_link_id
      AND l.attorney_user_id = auth.uid()
  ));

CREATE TRIGGER time_entries_touch
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- clio_connections: placeholder for pending Clio Manage OAuth integration
CREATE TABLE public.clio_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  clio_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clio_connections TO authenticated;
GRANT ALL ON public.clio_connections TO service_role;

ALTER TABLE public.clio_connections ENABLE ROW LEVEL SECURITY;

-- Only the owning attorney may read/manage their connection row.
-- Tokens themselves will be read from service_role paths in server functions.
CREATE POLICY "clio_connections owner only"
  ON public.clio_connections
  FOR ALL
  TO authenticated
  USING (attorney_user_id = auth.uid())
  WITH CHECK (attorney_user_id = auth.uid());

CREATE TRIGGER clio_connections_touch
  BEFORE UPDATE ON public.clio_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();