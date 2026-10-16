# Jev review proposals

The evidence-review type fix is already on main: reviews use the real
`attorney_user_id,evidence_id` unique key, without a `link_id` column. The
existing 12 fresh-share privacy tests remain in place. Since reviews are not
per-grant, earlier notes on a file can be visible again to the same attorney
when the survivor actively re-shares that file. Revocation still removes access.
Reviews that reference an entry outside the current share are hidden in full.

## Available flows

| Screen                       | Optional action               | Result                                                                                                                                                                                                                               |
| ---------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Attorney client → Evidence   | Suggest entry link with Jev   | Proposes one of up to 40 currently shared, AI-eligible documented entries, or no match. Confirm saves only a private attorney review reference through the existing scope-checked endpoint. Review also has a manual entry selector. |
| Attorney client → Evidence   | Group up to 20 files with Jev | Temporary record-type groups and a group filter. Select Unchecked files to check the next batch; clear groups to restore the view. No file or review status changes.                                                                 |
| Survivor → Drafts to review  | Check draft with Jev          | Date/place review flags and a possible duplicate among up to 20 other pending drafts. Opens the existing editor; never rewrites, fills fields, merges, deletes, accepts or shares.                                                   |
| Attorney → Evidence requests | Check shared files with Jev   | Matches the unsent request text or an existing open request to one of up to 40 currently shared eligible files. No match means only that this bounded check found no confident match. Never creates, sends or resolves a request.    |

Entry/request candidate limits follow the current grant's recorded ID order.
They do not search the full vault or external drives. Group checks use the first
20 files in the currently filtered queue. All UI copy is owned by the app;
there is no generated narrative, conduct label, credibility score, diagnosis,
severity/risk score, or legal conclusion. The 0.8 confidence threshold is a
conservative UI filter, not an accuracy guarantee; every proposed link still
requires human review. Noul values are yes-probabilities for review questions,
not probabilities that an event occurred.

## Enable on the host

The integration calls TypeSafe directly, independently of the Lovable gateway.
It uses the fixed `https://api.typesafe.ai/v1/systemone` destination and pinned
`jev-1.13.0` model. Source: [TypeSafe HTTP API](https://docs.typesafe.ai/api)
and [models](https://docs.typesafe.ai/models), checked 2026-10-16.

In the host's **server secret store**, configure:

```
JEV_API_KEY=<TypeSafe API key>
PATTERNPROOF_AI_POLICY_APPROVED=true
PATTERNPROOF_JEV_POLICY_APPROVED=true
```

Do not put the key in a `VITE_` variable or commit it. Complete a separate review
of TypeSafe's processing, retention and training terms before setting the Jev
policy flag. The implementation deliberately makes no provider-retention or
training promises. The general AI policy flag alone does not enable this new
provider. Every UI invocation also asks for consent to send the named saved text
to TypeSafe; the server requires literal `aiConsent: true`.

If the key or either policy flag is absent, the check fails closed and manual
review remains available. No deployment, database migration, live-data scan or
real-record AI call is part of this change. Credentials were not provisioned.

## Data and authorization boundaries

- Attorney functions use the strict attorney portal gate, recheck attorney role
  and active grant, and intersect with the current case's attachments. They
  query only the survivor's undeleted records in that scope, and recheck scope
  after the AI call. Saving a confirmed reference rechecks current scope again.
- Only `organize` and `all` AI permissions qualify. Unknown/null permissions,
  sealed files, deleted records, unshared entries and draft incidents stay out.
- Drafts must belong to the survivor and remain pending. Every source file must
  still be owned, undeleted, unsealed and AI-eligible; a single disallowed or
  missing source excludes the whole draft. Other users' drafts stay out.
- Payloads contain bounded existing text and metadata, not original file bytes,
  URLs, storage keys, GPS, attorney notes, request responses or sharing IDs.
  Existing transcripts are used only when ready; otherwise only saved extracted
  text is used. Text snippets can be incomplete, so manual source review matters.
- Responses must contain all requested typed answers, valid probabilities and
  choices from the exact candidate set. Missing/malformed responses fail as a
  check error, rather than becoming a default match. Timeouts are 20 seconds,
  redirects are forbidden, and provider error bodies never reach the user.
- Proposals are session state, dismissed or cleared locally, and absent from
  exports. Only a confirmed entry reference is stored in the existing review
  row. No Jev provenance table, new sharing scope or automatic write is created.

## Drive and OneDrive

No Drive/OneDrive integration is configured in this repository change. A chat
connector does not establish per-user authorization inside PatternProof. A real
scan needs registered OAuth clients, narrow per-user scopes, encrypted token
storage, explicit file selection, revocation handling, and a separate provider
review before sending selected text to Jev. That remains an open roadmap item;
the app does not claim to scan those services.

## Verification

The Jev suites use fictional records and mocked network I/O:

```
npx tsc --noEmit
npx vitest run src/__tests__/jev-client.test.ts src/__tests__/jev-proposals.test.ts src/__tests__/jev-review-controls.test.tsx src/__tests__/fresh-grant-access.test.ts
npm test
npm run build
```

They cover no-consent/no-policy behavior, provider contract and failures, scope
and role removal, revocation during a call, sealed/deleted/no-AI sources, draft
ownership and source permissions, no automatic writes, separate confirmation,
dismissal, manual editing and stale request-result suppression. A configured
host and signed-in test accounts are still needed for live end-to-end proof.
