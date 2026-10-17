# Jev: first rollout is request matching

The initial four-feature implementation has been narrowed to **Check already-shared
files** in the attorney evidence-request panel. Entry-link, grouping and draft-AI
controls and server endpoints have been removed from this rollout.

Latest main is merged. In particular, upstream PR #245 now supplies the
`link_id` generated types and grant-specific `(link_id,evidence_id)` review key.
This PR preserves that contract and its tests; it does not restore the older
attorney+file-only upsert or its re-sharing tradeoff.

## Survivor → attorney workflow

1. In survivor Settings, **AI checks for already-shared files** names each active
   attorney share and explains TypeSafe processing. It starts off. The survivor
   checks an explicit authorization statement, confirms their account password
   (or uses a recent verified sign-in in the requesting session), then allows
   request checks for 30 days. This is independent of generic AI permissions and
   the outside-assistant/MCP setting.
2. Permission is bound to provider, purpose, version, survivor, attorney, grant,
   current file-scope fingerprint and an expiry. The current case intersection
   is included. Changes to file scope pause permission unless the exact authorized
   scope is restored or the survivor authorizes the new scope. Every renewal has
   a new nonce. Enabling must present the scope fingerprint shown when the survivor
   reviewed the setting; a changed scope is rejected rather than silently authorized.
   Turning off needs no password or configured provider.
3. Before sending a request, or on an existing open request, the attorney chooses
   **Check already-shared files** and confirms processing for that call.
4. The server validates attorney access and survivor permission before reading
   source content. It reads the entire effective shared file scope in batches,
   excludes sealed/deleted/unowned/no-AI files, and ranks matches locally using
   request terms and complete saved text. It does not pick the first grant IDs.
5. Only up to 12 relevant candidates go to Jev. Each contains a bounded title,
   format, relevant excerpt (up to 1,000 characters), field name and offset, plus
   a temporary alias. Raw source IDs, original bytes, storage URLs, GPS, attorney
   notes, private responses and whole documents do not go to the provider.
6. Immediately before and after the provider call, the server rechecks role,
   active share, survivor authorization nonce/scope/expiry, and fingerprints of
   every analyzed source. Changed or unavailable sources invalidate the result.
7. The attorney sees **Possible match**, a source excerpt, local-search and
   provider-candidate counts, and **Open shared file**. Opening uses the existing
   current-scope download endpoint. No match never means an item is missing.
   Editing the request clears results, late old results are ignored, and previews
   expire within five minutes. Nothing sends/resolves a request, links evidence,
   rewrites an account, merges records, or expands sharing.

Requests that contain no useful searchable terms, or have no lexical candidate,
remain a local search with no provider call. Lexical retrieval can miss synonyms,
handwriting or unreadable content. Excerpts may omit needed context. Coverage is
shown honestly; manual review remains available.

## Permission storage and activity provenance

No new SQL table or migration is required. Survivor authorization lives in
server-writable Supabase Auth `app_metadata`, under one key per share. The
server reads it fresh rather than trusting cached permission claims or user metadata.
Session-specific verified AMR timestamps establish passwordless sign-in freshness;
account-wide last-sign-in and token refresh times are not accepted. Only an owner can
change their share's permission. Partial top-level updates preserve unrelated
metadata; Supabase Auth's `UpdateAppMetaData` merges supplied keys (verified in
[the upstream source](https://github.com/supabase/auth/blob/master/internal/models/user.go)).
Each grant stores a small fingerprint, not file lists or content.

Existing audit events record permission changes and completed checks. Check
provenance has model/instruction version, source IDs and content fingerprints,
the proposed source ID (or null), and the initiating actor. There is no copied
request/source text, generated rationale, or automatic acceptance. Audit writes
are best effort. There are no confirmed Jev evidence links in this stage; a
later linking feature must define its owner, confirmation semantics and durable
provenance before it ships.

## Provider configuration and evaluation

Jev calls the fixed TypeSafe endpoint `https://api.typesafe.ai/v1/systemone` with
pinned `jev-1.13.0`. Sources: [API](https://docs.typesafe.ai/api) and
[models](https://docs.typesafe.ai/models). The integration stays off unless all
three server settings exist:

```
JEV_API_KEY=<TypeSafe key in the host secret store>
PATTERNPROOF_AI_POLICY_APPROVED=true
PATTERNPROOF_JEV_POLICY_APPROVED=true
```

These host settings are neither survivor authorization nor per-call attorney
confirmation. Complete provider retention/training review before enabling them;
the app makes no promise on TypeSafe's behalf. Do not put the key in a `VITE_`
variable, source control, logs or chat.

The `0.8` confidence cutoff is an uncalibrated pilot filter, not an accuracy
claim. No model decision authorizes an action. An opt-in fictional evaluation
uses the exact production question builder, including direct matches, unhelpful
names, recurring events on different dates, insufficient text, contradictory
items and instructions embedded in sources:

```
# With the server key and policy flags configured; uses fictional fixtures only.
RUN_JEV_MODEL_EVAL=1 npx vitest run src/__tests__/jev-model-evaluation.test.ts
```

This suite is skipped during ordinary tests. Run repeated evaluations before a
pilot, inspect false matches and abstentions, and tune the question/cutoff from
observed results. Eight fictional cases are a starting regression set, not
statistical calibration. Then prove the named-account flow on a configured test
host: survivor authorizes → attorney checks → opens source → survivor turns off AI
permission → new AI check denied while ordinary shared-file access still works.
Then revoke sharing and verify both new checks and downloads are denied. No live evaluation, user setting changes or
real-record provider calls were performed in this implementation session.

## Deferred work

- Group known file formats deterministically; use Jev only for ambiguity.
- Flag blank/unknown dates and places locally; do not send text outside the app
  for completeness checks. AI duplicates need source-aware comparison and version
  checks, including already-confirmed records where appropriate.
- Entry references need separate private-attorney and survivor-approved semantics.
- Drive/OneDrive require selected-file read-only OAuth, encrypted token handling,
  revocation and explicit import. A chat connector does not authorize an in-app
  scan. Importing must never silently widen attorney sharing.
