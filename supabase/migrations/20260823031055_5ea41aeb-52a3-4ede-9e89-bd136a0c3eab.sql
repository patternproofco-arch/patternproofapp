-- Lock down SECURITY DEFINER helpers that no RLS policy, DB function, or app
-- code path uses; signed-in users should not be able to execute them directly.
REVOKE EXECUTE ON FUNCTION public.is_firm_owner(uuid) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_owner(uuid) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION private.has_active_subscription(uuid, text) FROM authenticated, anon;

-- consent_grants are created and removed exclusively by server-side
-- (service-role) flows after verification. Enforce that at the privilege
-- level so no direct API write is possible alongside the row-level policies.
-- (An owner-scoped insert policy would instead let any signed-in user
-- fabricate grant rows visible to recipients — service-role-only is the
-- intended, safer design.)
REVOKE INSERT, DELETE ON public.consent_grants FROM authenticated, anon;