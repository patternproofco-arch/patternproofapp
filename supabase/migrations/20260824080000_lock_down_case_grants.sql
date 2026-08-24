-- Close a live access-control gap on public.case_grants (the table that
-- gates cross-attorney access to a survivor's case). Its RLS "owner
-- attorney manages grants" policy (20260731002707) let any authenticated
-- user grant a colleague access to a case they own, as long as the granter
-- and grantee's attorney_profiles.firm_id values matched. That field is
-- self-editable by any user directly (attorney_profiles "Attorneys manage
-- own profile" policy, WITH CHECK (auth.uid() = user_id), no column
-- restriction) and was never meant to authorize access.
--
-- Concrete exploit: an attorney with one real active attorney_client_links
-- row could (1) INSERT INTO firms directly (the "create firms" policy has
-- no seat/subscription check), (2) UPDATE attorney_profiles.firm_id for
-- themself and an accomplice account to that new firm id, then (3) INSERT
-- INTO case_grants granting the accomplice access to their real client's
-- case — the RLS check passes because the two firm_id values match, with
-- no real firm relationship required. The accomplice could then read the
-- survivor's incident dates, locations, abuse types, and descriptions via
-- any of the several functions that trust an un-revoked case_grants row.
--
-- Every application code path that reads or writes case_grants already
-- goes through the service-role client (verified across
-- firm-grants.functions.ts, attorney-portal.functions.ts,
-- time-entries.functions.ts, cross-references.functions.ts, and
-- conflict-check.server.ts) — nothing in the browser bundle talks to this
-- table directly. So, matching the lockdown already applied to
-- firm_members/org_members/firm_member_invitations/org_member_invitations,
-- remove browser access entirely rather than trying to patch the RLS
-- condition itself.

DROP POLICY IF EXISTS "owner attorney manages grants" ON public.case_grants;
DROP POLICY IF EXISTS "granter manages" ON public.case_grants;
DROP POLICY IF EXISTS "grantee reads own" ON public.case_grants;

REVOKE ALL ON public.case_grants FROM anon, authenticated;
GRANT ALL ON public.case_grants TO service_role;

-- The "create firms" INSERT policy (20260630185944) has no seat/subscription
-- check at the RLS layer — that check only lives in the setMyFirm server
-- function. Every firm-creation call site already uses the service-role
-- client, so remove the direct-INSERT path entirely rather than duplicate
-- the seat check in SQL.
DROP POLICY IF EXISTS "create firms" ON public.firms;
REVOKE INSERT ON public.firms FROM authenticated;
