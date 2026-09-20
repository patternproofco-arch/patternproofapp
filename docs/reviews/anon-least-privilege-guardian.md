# Anon least-privilege migration — Guardian review

**PR only. Do NOT apply to production without @Guardian CLEAR.**

Migration: `supabase/migrations/20260920153000_revoke_anon_mutate_keep_public_inserts.sql`

## What it does

For every listed sensitive `public.*` table, **REVOKE** from role `anon`:

- `DELETE`
- `UPDATE`
- `TRUNCATE`

Then **GRANT INSERT** (only) to `anon` on public-form tables:

| Table | Anon remains allowed |
| --- | --- |
| `feedback_submissions` | `INSERT` |
| `org_access_requests` | `INSERT` |
| `waitlist_signups` | `INSERT` |
| `marketing_leads` | `INSERT` (restored; missed by Sept 15 grant list) |

Also: `ALTER DEFAULT PRIVILEGES` so future `postgres`-owned public tables do not silently grant anon DELETE/UPDATE/TRUNCATE.

## Tables touched (REVOKE DELETE/UPDATE/TRUNCATE)

advocate_client_links, advocate_invitations, advocate_profiles, advocate_survivor_invites, agent_messages, agent_threads, ai_chat_requests, attorney_access, attorney_client_links, attorney_document_requests, attorney_evidence_reviews, attorney_incident_notes, attorney_invitations, attorney_messages, attorney_missing_evidence_checklist, attorney_profiles, attorney_survivor_invites, attorney_time_logs, audit_events, audit_log, case_collaborators, case_grants, cases, clio_connections, clio_matter_links, clio_oauth_states, communications, court_dates, dv_organizations, email_relay_attempts, email_send_log, email_send_state, email_unsubscribe_tokens, entitlements, escalation_flags, evidence, evidence_classification_suggestions, evidence_families, feedback_submissions, firm_member_invitations, firm_members, firms, import_batches, incident_evidence_links, incidents, intake_batches, legal_documents, marketing_leads, matter_advocate_invitations, matter_advocates, matters, message_threads, notifications, opra_requests, org_access_requests, org_member_invitations, org_members, pattern_analyses, proposed_incidents, recordings, referral_links, share_link_access_log, subscriptions, support_requests, suppressed_emails, thread_message_corrections, thread_messages, thread_source_documents, time_entries, user_referrals, user_roles, user_security_settings, user_terms_acceptance, voice_notes, waitlist_signups

Missing tables are skipped with a notice (no hard fail) so staging drift does not block apply after CLEAR.

## Explicitly unchanged

- Role `authenticated`
- Role `service_role`
- RLS policies
- No secret rotation, no PIN clears, no production apply in this PR

## Prior migration note

`20260915004705_restrict_anon_table_privileges.sql` already revoked ALL from anon and re-granted three INSERT tables. This PR is additive documentation + marketing_leads INSERT restore + explicit mutate revoke. Still requires Guardian CLEAR before any environment apply.
