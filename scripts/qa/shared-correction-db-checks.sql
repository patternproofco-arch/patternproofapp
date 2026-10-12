\set ON_ERROR_STOP on
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
-- A recipient can see the incident: rewriting it must fail and leave both
-- the current account and revision history unchanged.
UPDATE public.attorney_client_links SET scope_incidents = ARRAY['10000000-0000-4000-8000-000000000001']::uuid[];
DO $$ BEGIN
  BEGIN
    UPDATE public.incidents SET description = 'Unapproved expansion';
    RAISE EXCEPTION 'SHARED_EDIT_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'This entry is shared.%' THEN RAISE; END IF;
  END;
  IF (SELECT description FROM public.incidents LIMIT 1) <> 'Corrected account' THEN
    RAISE EXCEPTION 'Failed correction changed current words'; END IF;
  IF (SELECT count(*) FROM public.incident_revisions) <> 1 THEN
    RAISE EXCEPTION 'Failed correction changed the history'; END IF;
END $$;
UPDATE public.attorney_client_links SET status = 'revoked', revoked_at = now();
UPDATE public.incidents SET description = 'Deliberate private correction';
DO $$ BEGIN IF (SELECT count(*) FROM public.incident_revisions) <> 2 THEN
  RAISE EXCEPTION 'Private correction was not preserved'; END IF; END $$;

-- Each remaining grant family independently blocks a correction.
INSERT INTO public.advocate_client_links(id,client_user_id,status,scope_incidents) VALUES
  ('50000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','active',ARRAY['10000000-0000-4000-8000-000000000001']::uuid[]);
DO $$ BEGIN
  BEGIN UPDATE public.incidents SET description = 'Advocate rewrite'; RAISE EXCEPTION 'ADVOCATE_EDIT_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This entry is shared.%' THEN RAISE; END IF; END;
END $$;
UPDATE public.advocate_client_links SET expires_at = now() - interval '1 second';
INSERT INTO public.attorney_invitations(id,client_user_id,status,scope_incidents) VALUES
  ('50000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','pending',ARRAY['10000000-0000-4000-8000-000000000001']::uuid[]);
DO $$ BEGIN
  BEGIN UPDATE public.incidents SET description = 'Pending invite rewrite'; RAISE EXCEPTION 'INVITE_EDIT_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This entry is shared.%' THEN RAISE; END IF; END;
END $$;
UPDATE public.attorney_invitations SET status = 'revoked';
INSERT INTO public.advocate_invitations(id,client_user_id,status,include_all_incidents) VALUES
  ('50000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','pending',true);
DO $$ BEGIN
  BEGIN UPDATE public.incidents SET description = 'Broad invite rewrite'; RAISE EXCEPTION 'BROAD_EDIT_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This entry is shared.%' THEN RAISE; END IF; END;
END $$;
UPDATE public.advocate_invitations SET status = 'revoked';
INSERT INTO public.attorney_access VALUES ('50000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000001',null,null,ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'{}');
DO $$ BEGIN
  BEGIN UPDATE public.incidents SET description = 'Legacy token rewrite'; RAISE EXCEPTION 'TOKEN_EDIT_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This entry is shared.%' THEN RAISE; END IF; END;
END $$;
UPDATE public.attorney_access SET revoked_at = now();
INSERT INTO public.cases VALUES ('60000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',ARRAY['10000000-0000-4000-8000-000000000001']::uuid[],'{}');
UPDATE public.advocate_client_links SET expires_at = null, scope_incidents = '{}', case_id = '60000000-0000-4000-8000-000000000001';
DO $$ BEGIN
  BEGIN UPDATE public.incidents SET description = 'Legacy case rewrite'; RAISE EXCEPTION 'CASE_EDIT_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This entry is shared.%' THEN RAISE; END IF; END;
END $$;
UPDATE public.advocate_client_links SET status = 'revoked';

-- Sources cannot be replaced, and disclosed source details cannot be rewritten.
UPDATE public.evidence SET description = 'Private source details' WHERE id = '30000000-0000-4000-8000-000000000004';
DO $$ BEGIN
  BEGIN UPDATE public.evidence SET file_url = 'replacement.wav' WHERE id = '30000000-0000-4000-8000-000000000004'; RAISE EXCEPTION 'SOURCE_REPLACEMENT_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The preserved upload cannot be replaced.%' THEN RAISE; END IF; END;
END $$;
UPDATE public.attorney_client_links SET status = 'active', revoked_at = null;
DO $$ BEGIN
  BEGIN UPDATE public.evidence SET description = 'Rewritten shared file' WHERE id = '30000000-0000-4000-8000-000000000001'; RAISE EXCEPTION 'SHARED_SOURCE_EDIT_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This file is shared.%' THEN RAISE; END IF; END;
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
SET ROLE authenticated;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.evidence_revisions) THEN
  RAISE EXCEPTION 'Source history crossed account boundary'; END IF; END $$;
RESET ROLE;
SELECT 'Shared correction, pending invitation, legacy token, case, and immutable upload checks passed' AS result;
