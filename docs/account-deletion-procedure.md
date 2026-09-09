# Account deletion — verified internal procedure

Self-service deletion is **not** available in the app, and the app does not claim
otherwise: Settings and the Privacy page both say deletion is requested by email
and confirmed once complete. This document is the procedure that makes that
promise verifiable.

Do not shorten it. Do not delete an account without completing step 6.

## 0. Identify and confirm

1. Confirm the request came from the account's own verified email address.
   A deletion request from any other address is refused.
2. Record the request date, the requesting address, and the resolved `auth.users.id`
   (referred to below as `:uid`).
3. Warn the requester that deletion is irreversible and offer the in-app export
   first (Settings → export). Wait for their confirmation in writing.

## 1. Cut off live access first

Before anything is removed, stop other people from reading the account's records:

```sql
update public.attorney_client_links
   set status = 'revoked', revoked_at = now()
 where client_user_id = :uid and status = 'active';

update public.advocate_client_links
   set status = 'revoked', revoked_at = now()
 where client_user_id = :uid and status = 'active';

update public.case_grants set revoked_at = now()
 where client_link_id in (select id from public.attorney_client_links where client_user_id = :uid)
   and revoked_at is null;

update public.case_collaborators set status = 'revoked'
 where link_id in (select id from public.attorney_client_links where client_user_id = :uid)
   and status = 'active';

update public.consent_grants set revoked_at = now()
 where survivor_user_id = :uid and revoked_at is null;
```

Revocation is checked server-side on every professional read, so this alone
already ends attorney/advocate/org access, including any link a colleague holds.

## 2. Kill outstanding invitations and share links

```sql
update public.advocate_survivor_invites set status = 'revoked' where client_user_id = :uid;
update public.attorney_survivor_invites  set status = 'revoked' where client_user_id = :uid;
update public.advocate_invitations       set status = 'revoked' where client_user_id = :uid;
update public.attorney_invitations       set status = 'revoked' where client_user_id = :uid;
delete from public.clio_oauth_states where user_id = :uid;
```

Previously issued download URLs are time-limited signed URLs; note the longest
validity in use (currently 1 hour) and treat the account as fully closed only
after that window has also elapsed.

## 3. Remove stored files

Storage is not cascaded by the database. For each private bucket
(`evidence-files`, `voice-notes`, `conversation-recordings`, `exports`,
`message-exports`), list and remove every object whose path is under the user's
own prefix, and record the object count removed per bucket.

Cross-check against the database before removing rows, because the paths live in
`public.evidence.file_path`, `public.voice_notes.audio_url`,
`public.recordings`, and `public.thread_source_documents`.

## 4. Remove database records

Delete from every table that carries the user's id. As of this document the
owning columns are:

- `user_id`: `advocate_profiles`, `agent_messages`, `agent_threads`,
  `ai_chat_requests`, `ai_usage_log`, `attorney_access`, `attorney_profiles`,
  `audit_events`, `cases`, `clio_connections`, `clio_oauth_states`,
  `communications`, `court_dates`, `email_relay_attempts`, `entitlements`,
  `escalation_flags`, `evidence`, `evidence_classification_suggestions`,
  `evidence_families`, `evidence_incident_drafts`, `feedback_submissions`,
  `firm_members`, `import_batches`, `incident_evidence_links`, `incidents`,
  `intake_batches`, `legal_documents`, `message_threads`, `notifications`,
  `opra_requests`, `org_members`, `pattern_analyses`, `proposed_incidents`,
  `recordings`, `subscriptions`, `support_requests`,
  `thread_message_corrections`, `thread_messages`, `thread_source_documents`,
  `user_referrals`, `user_roles`, `user_security_settings`,
  `user_terms_acceptance`, `voice_notes`
- `client_user_id` / `survivor_user_id`: `advocate_client_links`,
  `advocate_invitations`, `attorney_client_links`, `attorney_document_requests`,
  `attorney_evidence_reviews`, `attorney_incident_notes`, `attorney_invitations`,
  `attorney_missing_evidence_checklist`, `attorney_time_logs`, `consent_grants`,
  `org_follow_ups`, `record_requests`, `referral_engagements`
- `attorney_user_id` / `advocate_user_id` / `org_user_id` (only when the account
  being deleted is the professional): `advocate_survivor_invites`,
  `attorney_survivor_invites`, `case_grants`, `clio_document_exports`,
  `referral_links`, `time_entries`

`audit_log` is deliberately tamper-evident and is **not** deleted. It holds
access events, not case content. Note this in the confirmation to the requester
rather than silently keeping it.

Re-run the column inventory before each deletion, because the schema changes:

```sql
select table_name, column_name
  from information_schema.columns
 where table_schema = 'public'
   and column_name in ('user_id','client_user_id','attorney_user_id',
                       'advocate_user_id','org_user_id','survivor_user_id')
 order by table_name;
```

## 5. Remove the login

Delete the `auth.users` row last, through the Auth admin API. Doing it earlier
orphans rows that are then harder to find.

## 6. Verify, then confirm

Deletion is not complete until all of these return zero:

1. Re-run the inventory query in step 4 as a `count(*)` per table for `:uid`.
2. Re-list each storage bucket prefix.
3. Attempt a professional read of one of the deleted records as the previously
   linked attorney or advocate; it must fail.
4. Attempt one previously issued download URL; it must fail once its signing
   window has passed.

Record the four results, the date, and who performed it. Only then reply to the
requester confirming completion, and state plainly that access-event logs are
retained.
