-- ONLY IF sign-in or a server flow breaks right after section 1
-- Undo for step 6 of 20261011200000_lovable_sync_reconcile.sql (SECURITY DEFINER EXECUTE).
-- Re-grants EXECUTE TO PUBLIC on exactly the public SECURITY DEFINER functions that had it
-- before the reconcile (read from public._reconcile_secdef_acl_snapshot, written by
-- section 1), and restores Postgres's default PUBLIC EXECUTE on new functions.
-- Changes nothing else. Safe to run twice. Do not run unless something broke.
BEGIN;
DO $do$
DECLARE
  r record;
BEGIN
  IF to_regclass('public._reconcile_secdef_acl_snapshot') IS NULL THEN
    RAISE EXCEPTION 'public._reconcile_secdef_acl_snapshot is missing: section 1 never ran, nothing to undo';
  END IF;
  FOR r IN SELECT fn FROM public._reconcile_secdef_acl_snapshot WHERE had_public ORDER BY fn LOOP
    IF to_regprocedure(r.fn) IS NULL THEN
      RAISE NOTICE 'skip %: function no longer exists', r.fn;
      CONTINUE;
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', r.fn);
    RAISE NOTICE 're-granted EXECUTE TO PUBLIC on %', r.fn;
  END LOOP;
END
$do$;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
COMMIT;
