ALTER TABLE public.proposed_incidents
  ADD COLUMN IF NOT EXISTS created_incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL;