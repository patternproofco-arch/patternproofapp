\set ON_ERROR_STOP on
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
SET ROLE authenticated;
UPDATE public.incidents SET description = 'Corrected account' WHERE id = '10000000-0000-4000-8000-000000000001';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.incident_revisions) <> 1 OR
    (SELECT prior_record->>'description' FROM public.incident_revisions LIMIT 1) <> 'Earlier account' THEN
    RAISE EXCEPTION 'Prior account was not preserved'; END IF;
  BEGIN
    DELETE FROM public.incident_revisions;
    RAISE EXCEPTION 'History was mutable';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE public.incidents SET share_readiness = 'private';
DO $$ BEGIN IF (SELECT count(*) FROM public.incident_revisions) <> 1 THEN
  RAISE EXCEPTION 'Metadata-only change created a correction'; END IF; END $$;

SELECT public.respond_to_evidence_request('40000000-0000-4000-8000-000000000001', 'submit', 'My answer',
  ARRAY['30000000-0000-4000-8000-000000000001']::uuid[]);
DO $$ BEGIN
  IF (SELECT status FROM public.attorney_document_requests WHERE id = '40000000-0000-4000-8000-000000000001') <> 'submitted' THEN
    RAISE EXCEPTION 'Answer was not submitted'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.attorney_client_links WHERE scope_evidence @> ARRAY['30000000-0000-4000-8000-000000000001']::uuid[]) THEN
    RAISE EXCEPTION 'Chosen file was not shared'; END IF;
END $$;

-- Foreign, deleted, nonexistent and null file ids must all fail atomically.
DO $$ DECLARE bad uuid; BEGIN
  FOREACH bad IN ARRAY ARRAY['30000000-0000-4000-8000-000000000002'::uuid,
    '30000000-0000-4000-8000-000000000003'::uuid, '30000000-0000-4000-8000-000000000099'::uuid, null] LOOP
    BEGIN
      PERFORM public.respond_to_evidence_request('40000000-0000-4000-8000-000000000002', 'submit', 'note', ARRAY[bad]);
      RAISE EXCEPTION 'INVALID_SELECTION_WAS_ACCEPTED';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM = 'INVALID_SELECTION_WAS_ACCEPTED' THEN RAISE; END IF;
    END;
  END LOOP;
  IF (SELECT status FROM public.attorney_document_requests WHERE id = '40000000-0000-4000-8000-000000000002') <> 'open' THEN
    RAISE EXCEPTION 'Failed response changed the request'; END IF;
  IF (SELECT cardinality(scope_evidence) FROM public.attorney_client_links LIMIT 1) <> 1 THEN
    RAISE EXCEPTION 'Failed response disclosed files'; END IF;
END $$;

-- Simulate a failure AFTER scope expansion: the statement must roll back both.
CREATE FUNCTION public.fail_submission() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.response_note = 'force failure' THEN RAISE EXCEPTION 'Fictional storage failure'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fail_submission BEFORE UPDATE ON public.attorney_document_requests FOR EACH ROW EXECUTE FUNCTION public.fail_submission();
DO $$ BEGIN
  BEGIN
    PERFORM public.respond_to_evidence_request('40000000-0000-4000-8000-000000000002', 'submit', 'force failure', ARRAY['30000000-0000-4000-8000-000000000004']::uuid[]);
    RAISE EXCEPTION 'EXPECTED_FAILURE_DID_NOT_OCCUR';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Fictional storage failure' THEN RAISE; END IF;
  END;
  IF (SELECT cardinality(scope_evidence) FROM public.attorney_client_links LIMIT 1) <> 1 THEN
    RAISE EXCEPTION 'Partial scope expansion survived a failed answer'; END IF;
END $$;
DROP TRIGGER fail_submission ON public.attorney_document_requests;
DROP FUNCTION public.fail_submission();

-- Lifecycle checks on an open request.
UPDATE public.attorney_client_links SET expires_at = now() - interval '1 second';
DO $$ BEGIN
  BEGIN
    PERFORM public.respond_to_evidence_request('40000000-0000-4000-8000-000000000002', 'submit', 'note');
    RAISE EXCEPTION 'EXPIRED_LINK_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'EXPIRED_LINK_WAS_ACCEPTED' THEN RAISE; END IF;
  END;
END $$;
UPDATE public.attorney_client_links SET expires_at = null, revoked_at = now();
DO $$ BEGIN
  BEGIN
    PERFORM public.respond_to_evidence_request('40000000-0000-4000-8000-000000000002', 'help_requested');
    RAISE EXCEPTION 'REVOKED_LINK_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'REVOKED_LINK_WAS_ACCEPTED' THEN RAISE; END IF;
  END;
END $$;
UPDATE public.attorney_client_links SET revoked_at = null;

UPDATE public.attorney_document_requests SET response_note = 'Private unfinished answer', response_evidence_ids = ARRAY['30000000-0000-4000-8000-000000000004']::uuid[]
 WHERE id = '40000000-0000-4000-8000-000000000003';
SELECT public.respond_to_evidence_request('40000000-0000-4000-8000-000000000003', 'help_requested');
SELECT public.respond_to_evidence_request('40000000-0000-4000-8000-000000000004', 'unavailable');
DO $$ BEGIN
  IF (SELECT response_note FROM public.attorney_document_requests WHERE id = '40000000-0000-4000-8000-000000000003') <> 'Private unfinished answer' THEN
    RAISE EXCEPTION 'Help discarded the private draft'; END IF;
  IF (SELECT cardinality(scope_evidence) FROM public.attorney_client_links LIMIT 1) <> 1 THEN
    RAISE EXCEPTION 'Help or unavailable disclosed draft files'; END IF;
  IF (SELECT response_outcome FROM public.attorney_document_requests WHERE id = '40000000-0000-4000-8000-000000000004') <> 'unavailable' THEN
    RAISE EXCEPTION 'Unavailable outcome missing'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
SET ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.incident_revisions) OR EXISTS (SELECT 1 FROM public.attorney_document_requests) THEN
    RAISE EXCEPTION 'Another survivor can read private records'; END IF;
  BEGIN
    PERFORM public.respond_to_evidence_request('40000000-0000-4000-8000-000000000002', 'submit', 'foreign answer');
    RAISE EXCEPTION 'FOREIGN_REQUEST_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'FOREIGN_REQUEST_WAS_ACCEPTED' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', false);
SET ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.incident_revisions) OR EXISTS (SELECT 1 FROM public.attorney_document_requests) THEN
    RAISE EXCEPTION 'Professional can read private drafts/history directly'; END IF;
END $$;
RESET ROLE;
SELECT 'Foundation transaction, ownership, history, and RLS checks passed' AS result;
