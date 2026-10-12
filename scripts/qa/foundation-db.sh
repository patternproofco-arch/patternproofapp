#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
db_name="patternproof-foundation-check-${RANDOM}-${RANDOM}"
trap 'docker rm -f "$db_name" >/dev/null 2>&1 || true' EXIT
docker run --detach --network none --name "$db_name" --env POSTGRES_HOST_AUTH_METHOD=trust \
  postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24 >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$db_name" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$db_name" pg_isready -U postgres >/dev/null
docker exec -i "$db_name" psql -U postgres -v ON_ERROR_STOP=1 < scripts/qa/foundation-db-fixture.sql
docker exec -i "$db_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/20261010170000_record_foundation.sql
docker exec -i "$db_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/20261010171000_shared_record_corrections.sql
docker exec -i "$db_name" psql -U postgres -v ON_ERROR_STOP=1 < scripts/qa/foundation-staging-verify.sql
docker exec -i "$db_name" psql -U postgres -v ON_ERROR_STOP=1 < scripts/qa/foundation-db-checks.sql
docker exec -i "$db_name" psql -U postgres -v ON_ERROR_STOP=1 < scripts/qa/shared-correction-db-checks.sql
bash scripts/qa/foundation-db-concurrency.sh "$db_name"
