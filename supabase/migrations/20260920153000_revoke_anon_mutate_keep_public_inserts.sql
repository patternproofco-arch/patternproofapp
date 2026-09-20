-- ============================================================================
-- LEAST-PRIVILEGE (anon) — PR ONLY — DO NOT APPLY TO PRODUCTION WITHOUT
-- @Guardian CLEAR.
-- ============================================================================
-- Intent:
--   REVOKE anon DELETE / UPDATE / TRUNCATE on sensitive public tables.
--   KEEP anon INSERT only where browser public forms need it.
--   Authenticated + service_role privileges are intentionally untouched.
--
-- Companion / prior art:
--   20260915004705_restrict_anon_table_privileges.sql already revoked ALL
--   from anon and re-granted INSERT on feedback_submissions,
--   org_access_requests, waitlist_signups. This migration is a fail-closed
--   hardening pass that (1) explicitly documents every table, (2) restores
--   marketing_leads INSERT (missed by the Sept 15 grant list), and (3)
--   re-asserts DELETE/UPDATE/TRUNCATE are not available to anon even if
--   a later migration re-grants broader privileges by mistake.
--
-- Public-form INSERT tables (remain allowed for anon):
--   - public.feedback_submissions
--   - public.org_access_requests
--   - public.waitlist_signups
--   - public.marketing_leads
--
-- Everything else listed below: anon may NOT DELETE / UPDATE / TRUNCATE.
-- Anon SELECT is also not granted here (fail closed).
-- ============================================================================

-- Explicit revoke of mutating privileges on sensitive tables.
do $$
declare
  sensitive text[] := array[
    'advocate_client_links',
    'advocate_invitations',
    'advocate_profiles',
    'advocate_survivor_invites',
    'agent_messages',
    'agent_threads',
    'ai_chat_requests',
    'attorney_access',
    'attorney_client_links',
    'attorney_document_requests',
    'attorney_evidence_reviews',
    'attorney_incident_notes',
    'attorney_invitations',
    'attorney_messages',
    'attorney_missing_evidence_checklist',
    'attorney_profiles',
    'attorney_survivor_invites',
    'attorney_time_logs',
    'audit_events',
    'audit_log',
    'case_collaborators',
    'case_grants',
    'cases',
    'clio_connections',
    'clio_matter_links',
    'clio_oauth_states',
    'communications',
    'court_dates',
    'dv_organizations',
    'email_relay_attempts',
    'email_send_log',
    'email_send_state',
    'email_unsubscribe_tokens',
    'entitlements',
    'escalation_flags',
    'evidence',
    'evidence_classification_suggestions',
    'evidence_families',
    'feedback_submissions',
    'firm_member_invitations',
    'firm_members',
    'firms',
    'import_batches',
    'incident_evidence_links',
    'incidents',
    'intake_batches',
    'legal_documents',
    'marketing_leads',
    'matter_advocate_invitations',
    'matter_advocates',
    'matters',
    'message_threads',
    'notifications',
    'opra_requests',
    'org_access_requests',
    'org_member_invitations',
    'org_members',
    'pattern_analyses',
    'proposed_incidents',
    'recordings',
    'referral_links',
    'share_link_access_log',
    'subscriptions',
    'support_requests',
    'suppressed_emails',
    'thread_message_corrections',
    'thread_messages',
    'thread_source_documents',
    'time_entries',
    'user_referrals',
    'user_roles',
    'user_security_settings',
    'user_terms_acceptance',
    'voice_notes',
    'waitlist_signups'
  ];
  t text;
begin
  foreach t in array sensitive loop
    if to_regclass('public.' || t) is null then
      raise notice 'skip missing table public.%', t;
      continue;
    end if;
    execute format(
      'revoke delete, update, truncate on table public.%I from anon',
      t
    );
  end loop;
end $$;

-- Re-assert the only anon table writes intended for public browser forms.
grant insert on table public.feedback_submissions to anon;
grant insert on table public.org_access_requests to anon;
grant insert on table public.waitlist_signups to anon;
grant insert on table public.marketing_leads to anon;

-- Default privileges: future tables created by postgres in public should not
-- silently hand anon DELETE/UPDATE/TRUNCATE.
alter default privileges for role postgres in schema public
  revoke delete, update, truncate on tables from anon;

-- Remains allowed after this migration (anon):
--   INSERT on feedback_submissions, org_access_requests, waitlist_signups, marketing_leads
-- Remains denied (anon) on every listed sensitive table:
--   DELETE, UPDATE, TRUNCATE (and no new SELECT/UPDATE/DELETE grants)
-- Not changed:
--   authenticated role, service_role, RLS policies
