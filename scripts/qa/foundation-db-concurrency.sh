#!/usr/bin/env bash
# Called by foundation-db.sh with its isolated container name.
set -euo pipefail
db_name="$1"
run_sql() { docker exec -i "$db_name" psql -U postgres -v ON_ERROR_STOP=1; }
run_sql <<'SQL'
UPDATE public.attorney_client_links SET status = 'active', revoked_at = null, expires_at = null, scope_evidence = '{}', scope_incidents = '{}';
SQL
# Hold the first response's link lock while the second response starts.
run_sql <<'SQL' >/tmp/patternproof-response-first.log 2>&1 &
BEGIN;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT public.respond_to_evidence_request('40000000-0000-4000-8000-000000000011', 'submit', '', ARRAY['30000000-0000-4000-8000-000000000001']::uuid[]);
SELECT pg_sleep(2);
COMMIT;
SQL
first_pid=$!
# Observe the real sleeping transaction, rather than assume shell scheduling.
for attempt in $(seq 1 50); do
  sleeping=$(docker exec "$db_name" psql -U postgres -Atc "SELECT count(*) FROM pg_stat_activity WHERE wait_event = 'PgSleep'")
  if [[ "$sleeping" != "0" ]]; then break; fi
  sleep 0.1
done
[[ "$sleeping" != "0" ]]
run_sql <<'SQL'
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
SET ROLE authenticated;
SELECT public.respond_to_evidence_request('40000000-0000-4000-8000-000000000012', 'submit', '', ARRAY['30000000-0000-4000-8000-000000000004']::uuid[]);
SQL
wait "$first_pid"
run_sql <<'SQL'
DO $$ BEGIN
  IF (SELECT cardinality(scope_evidence) FROM public.attorney_client_links) <> 2 THEN
    RAISE EXCEPTION 'Concurrent responses lost a deliberate selection'; END IF;
END $$;
SQL
# A correction waiting behind a new grant must see the committed grant.
run_sql <<'SQL' >/tmp/patternproof-grant-first.log 2>&1 &
BEGIN;
UPDATE public.attorney_client_links SET scope_incidents = ARRAY['10000000-0000-4000-8000-000000000001']::uuid[];
SELECT pg_sleep(2);
COMMIT;
SQL
first_pid=$!
for attempt in $(seq 1 50); do
  sleeping=$(docker exec "$db_name" psql -U postgres -Atc "SELECT count(*) FROM pg_stat_activity WHERE wait_event = 'PgSleep'")
  if [[ "$sleeping" != "0" ]]; then break; fi
  sleep 0.1
done
[[ "$sleeping" != "0" ]]
run_sql <<'SQL'
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    UPDATE public.incidents SET description = 'Concurrent undisclosed rewrite';
    RAISE EXCEPTION 'CONCURRENT_EDIT_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'This entry is shared.%' THEN RAISE; END IF;
  END;
END $$;
SQL
wait "$first_pid"
printf '%s\n' 'Concurrent scope merging and disclosure/correction checks passed'
