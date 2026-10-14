-- PR #214 follow-up (2026-10-13): trigger-only functions must not be callable by
-- API roles. Trigger execution does not check EXECUTE on the trigger function, so
-- revoking it does not affect the triggers. Matches the muy follow-up paste.
-- org_access_requests keeps NO anon grant: /partner-access submits via the
-- submitOrgAccessRequest server function (service role), not anon REST.
REVOKE EXECUTE ON FUNCTION private.audit_grant_mutation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.prevent_grant_resurrection() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.attorney_client_links_client_update_guard() FROM PUBLIC, anon, authenticated;
