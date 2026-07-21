
REVOKE EXECUTE ON FUNCTION public.record_audit_event(uuid, text, text, uuid, text, uuid, jsonb) FROM authenticated;
-- service_role retains EXECUTE from the previous grant.
