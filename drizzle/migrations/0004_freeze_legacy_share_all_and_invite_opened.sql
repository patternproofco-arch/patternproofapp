ALTER TABLE public.attorney_survivor_invites ADD COLUMN IF NOT EXISTS opened_at timestamptz;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['attorney_client_links','advocate_client_links'] LOOP
    EXECUTE format($f$
      UPDATE public.%1$I l SET
        scope_incidents = CASE WHEN l.include_all_incidents THEN ARRAY(
          SELECT DISTINCT x FROM (
            SELECT unnest(coalesce(l.scope_incidents,'{}'::uuid[])) x
            UNION SELECT i.id FROM public.incidents i
             WHERE i.user_id = l.client_user_id AND i.deleted_at IS NULL AND i.created_at <= l.created_at
          ) s) ELSE l.scope_incidents END,
        scope_evidence = CASE WHEN l.include_all_evidence THEN ARRAY(
          SELECT DISTINCT x FROM (
            SELECT unnest(coalesce(l.scope_evidence,'{}'::uuid[])) x
            UNION SELECT e.id FROM public.evidence e
             WHERE e.user_id = l.client_user_id AND e.deleted_at IS NULL AND e.created_at <= l.created_at
          ) s) ELSE l.scope_evidence END,
        include_all_incidents = false,
        include_all_evidence = false
      WHERE l.include_all_incidents OR l.include_all_evidence
    $f$, t);
  END LOOP;
END $$;