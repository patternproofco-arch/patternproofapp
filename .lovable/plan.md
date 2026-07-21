# PatternProof — Second-Pass Audit (Read-Only)

_Three parallel subagents: AI + court packet, security/RLS/storage/secrets, UX + attorney portal + landing. All findings are file:line-anchored. No code, DB, or config was modified._

---

## Executive summary

The first pass closed the loudest issues (overclaims, missing terms page, sitemap, org form). The second pass confirms most of what was hardened is genuinely hardened — RLS is real on all 14 named tables, storage buckets are all private and folder-scoped to `auth.uid()`, PIN lock and Stripe webhooks work as advertised, and analytics trackers are truly absent. But there are **three categories of real gap left that a Facebook-group visitor or a first-attorney could hit today**:

1. **Marketing↔product mismatch that survives from pass 1:** the survivor "Court Ready" path still delivers `window.print()`, not a SHA-256 ZIP + manifest — while `/court-ready` marketing and `/pricing` still imply the manifest exists for survivors. The real ZIP generator (`generateAttorneyCourtPacket`) is attorney-portal-only.
2. **Compliance claims with no backing code:** privacy page promises deletion within 5 business days, but `deleteAccount`/`purgeUserData` don't exist anywhere in `src/`. Multiple UI strings say "logged" / "chain-of-custody logged" for flows that never call `logAudit`.
3. **A silent data-model break:** the Escalation Detector is computed client-side and never inserts into `escalation_flags`, yet pattern analysis, attorney shared bundles, and the attorney court packet all query that table as if it were populated.

Two structural inconsistencies are also worth same-week fixes: the Clio callback is a genuine placeholder that echoes the raw OAuth `code` param to the page, and `pricing.tsx` shows one attorney tier ($297) while `for-attorneys.tsx` and `_attorney/billing.tsx` show three ($297/$697/$1,497).

---

## Top 10 issues (severity ordered)

| # | Severity | Issue | Evidence |
|---|---|---|---|
| 1 | **High** | Survivor "Court Packet" is `window.print()` on an HTML div — no ZIP, no SHA-256 manifest, no embedded disclaimer — while `court-ready.tsx:62` markets "Court-ready ZIP packet with chain-of-custody manifest." | `court-packet.tsx:118,122-226`; real ZIP lives in `payments.functions.ts:240-587` but is attorney-only |
| 2 | **High** | `escalation_flags` is read by `pattern-analysis.functions.ts:121`, `attorney-public.functions.ts:58`, `attorney-portal.functions.ts:331/413`, and `payments.functions.ts:288/344` — but no `insert` into that table exists anywhere in `src/`. Escalation Detector page only calls `setFlags(out)` in local state. | `escalation-detector.tsx:15-40`; grep `insert.*escalation_flags` in `src/` → 0 hits |
| 3 | **High** | Privacy policy promises data deletion within 5 business days; no `deleteAccount` / `purgeUserData` code exists in `src/`. | `privacy.tsx:230-234`; grep returned 0 matches |
| 4 | **High** | Clio OAuth callback is a labeled placeholder with **no state/PKCE verification** and echoes the raw `code` value (truncated) into the rendered page. | `integrations.clio.callback.tsx:6-15,17-22,44-46` |
| 5 | **Med-High** | UI claims "Access is logged" / "chain of custody logged" in 8+ places, but only `legal-documents.tsx:108` actually calls `logAudit`. Attorney shared-bundle access only bumps `last_accessed_at` — not an audit row. | `attorney.$token.tsx:130`, `trust.tsx:40,107`, `accept-invite.$token.tsx:113`, `attorney-public.functions.ts:36-39` |
| 6 | **Med-High** | `/pricing` shows one attorney tier at $297; `/for-attorneys` and `/_attorney/billing` show three tiers ($297/$697/$1,497). Public visitors see a different offer than authenticated attorneys. | `pricing.tsx:52-53` vs `for-attorneys.tsx:19-36` vs `_attorney/billing.tsx:14-17` |
| 7 | **Med** | QuickExit only calls `history.replaceState` + `location.replace`. It does **not** clear `sessionStorage` (`pp_session_unlocked_v1`), DOM state, or document title — a survivor who hits Quick Exit but doesn't close the tab is still unlocked. | `QuickExitButton.tsx:14-31`; `AppShell.tsx:26` |
| 8 | **Med** | Message-thread upload UI advertises PDF / RSMF / Excel / ZIP as first-class options; only CSV and TXT actually parse today. The "in active development" caveat only appears in a post-upload toast. | `message-threads.tsx:26-66`; `message-threads.functions.ts:229-233` |
| 9 | **Med** | `OnboardingModal` has `role="dialog"` but no focus trap, no initial focus call, no Escape handler → keyboard/screen-reader users can Tab into the page behind it. | `OnboardingModal.tsx:47-156` |
| 10 | **Med** | 12 destructive/access-revocation actions use native `confirm()` — including revoking attorney access, revoking collaborator access, deleting evidence, deleting incidents, deleting time entries. Unstyled, blocks JS thread, low-fidelity for a trust product. | full list: `clients.$clientId.tsx:736,879,2378`; `clients.index.tsx:562`; `attorney-portal.tsx:78`; `court-dates.tsx:154`; `evidence.tsx:216`; `journal.tsx:117`; `legal-documents.tsx:265`; `live-recording.tsx:190`; `message-threads.tsx:176`; `share-with-attorney.tsx:210`; `voice-notes.tsx:99` |

---

## Also worth noting (severity: low–med)

- **Attorney client detail is 2,458 lines / 13 tabs** in one file (`clients.$clientId.tsx`). Export tab mixes shipped ("ZIP today") and unshipped ("Live sync coming soon") in one sentence at `:1841`, right where an attorney is deciding if Clio will help this session.
- **Raw JS error strings surface to attorneys** via `toast(e.message)` at `clients.$clientId.tsx:643,738,809,881` — Postgres / server messages reach the UI unmodified when `e instanceof Error`.
- **`_attorney/billing.tsx:80`** uses `gridTemplateColumns: repeat(3, ...)` inline — 3-column tier grid has no responsive breakpoint, structurally at risk <380px.
- **`agent.$threadId.tsx:64`** — `catch { /* ignore */ }` silently swallows thread rename failures.
- **`why-courts-struggle.tsx`** is 5 lines total — confirm it isn't a dead/orphaned route.
- **AiSidekick messages are not persisted** — server fn returns `{ reply }` only; chat history lost on refresh. Fine as a design choice but should be labeled to the user.
- **AI-drafted extractions** (`extract-incident.functions.ts`, `legal-extract.functions.ts`) return raw JSON to the client, but no `ai_generated` / `needs_review` column is set on the resulting `incidents` / `legal_documents` row — the "AI drafted, review before use" surface is UI-only, not persisted.
- **`email_send_log` / `suppressed_emails`** have RLS on with only `service_role` policies — likely intentional (backend audit tables) but not documented anywhere in code as such.
- **Attorney invite delivery** relies on the survivor clicking a `mailto:` link (`share-with-attorney.tsx:105-108`). If the survivor closes the tab, the attorney receives nothing — no server-side transactional email fallback confirmed.

---

## Verified good (things that were doubted and turned out fine)

- **RLS on all 14 named tables** — every one enabled with owner-scoped policies (subscriptions, user_roles, case_grants, case_collaborators, attorney_access, attorney_client_links, attorney_survivor_invites, attorney_invitations, clio_connections, time_entries, agent_threads, agent_messages, notifications, plus the intentionally service-role-only email_send_log / suppressed_emails).
- **All 5 storage buckets private + folder-scoped to `auth.uid()`**: `evidence-files`, `voice-notes`, `conversation-recordings`, `exports`, `message-exports`.
- **Every `supabaseAdmin` call site sampled** applies an explicit owner filter or resolves via a verified token row.
- **Stripe webhook** does real HMAC-SHA256 + 300s replay window (`stripe.server.ts:48-76`), not stubbed.
- **PIN lock** SHA-256 hashes locally, uses sessionStorage for unlock state, 5-attempt lockout at 30 min, WebAuthn biometric fallback stores only `rawId`. It does *not* gate any Supabase call — correctly labeled as UI-only session convenience.
- **Pattern analysis (`patterns.tsx`)** is genuinely LLM-backed, auth-gated, strict-tool-schema, with repeated disclaimers ("Not a diagnosis. Not a legal conclusion." + persistent safety note).
- **Evidence↔incident cascade** is handled at the DB layer via `ON DELETE SET NULL` on `linked_incident_id` — deleting an incident does not orphan evidence.
- **Raw personal-data export (`settings.tsx:186-198`) is NOT paywalled** — free-tier survivors keep their own data. The paywall gates the polished court-exhibit generator (`court-packet.tsx:38-41`), not personal data.
- **Analytics trackers**: zero matches for plausible/posthog/gtag/mixpanel/segment. Clean.
- **Dependency overrides** already pinned (`ws@^8.21.0`, `undici@^8.5.0`, `js-yaml@^5.1.0`) — first-pass CVE remediation held.
- **Testimonial placeholders** removed from `SocialProofSection.tsx` with an inline comment explaining why — good discipline.

---

## Recommended 14-day remediation plan

### Days 1–3 (must-ship before more Facebook traffic)
1. **Rewrite `court-ready.tsx` + `pricing.tsx` copy** to describe what survivors actually get today (formatted printable exhibit + raw ZIP export from Settings), OR wire `/court-packet` to invoke a survivor version of `generateAttorneyCourtPacket`. Pick one; the current state is a promise the code doesn't keep. _(Fix #1)_
2. **Reconcile pricing tiers.** Either update `pricing.tsx` to show all three attorney tiers, or explain on `/pricing` that Firm/Enterprise are quoted. _(Fix #6)_
3. **Delete or clearly disable Clio callback** until real token exchange is implemented; at minimum stop rendering the raw `code` param on the page. _(Fix #4)_
4. **Add "Not yet supported" badges** to PDF/RSMF/Excel/ZIP cards on the message-threads upload page, before upload. _(Fix #8)_

### Days 4–7 (integrity + safety)
5. **Wire `escalation-detector.tsx` to actually insert into `escalation_flags`** (or remove the table reads in pattern/attorney code paths). Right now attorney bundles silently omit escalation data. _(Fix #2)_
6. **Ship account deletion** (`deleteAccount` server fn: revoke sessions, purge storage prefixes for the user, `supabase.auth.admin.deleteUser`) OR update `privacy.tsx` to describe manual deletion via email. _(Fix #3)_
7. **QuickExit hardening**: clear `sessionStorage`, reset `document.title`, and force full navigation, not just SPA route change. _(Fix #7)_

### Days 8–14 (trust + polish)
8. **Audit-log parity**: either add `logAudit` calls to every place the UI claims "logged" (attorney bundle views, share revocation, collaborator access, evidence access), or delete the claims. Pick one and be consistent. _(Fix #5)_
9. **Replace all 12 `confirm()` sites** with a single reusable `<ConfirmDialog>` (focus-trapped, styled, on-brand). _(Fix #10)_
10. **OnboardingModal focus trap + Escape handler** (small change, high a11y win). _(Fix #9)_
11. **Error normalization layer for attorney portal** — wrap `toast(e.message)` in a `friendlyError()` helper. _(clients.$clientId.tsx x4)_
12. **Persist `ai_generated: true` on incident/legal-document rows created via AI extraction**, and render a "Drafted by AI — please review" badge in the list views.

---

## Open questions I did not resolve

1. Whether `metadata.userId` on Stripe checkout is sourced from `context.userId` (server) or a client input (needs a look at the caller in `payments.functions.ts:45,80,125`).
2. Rate limiting on `attorney-survivor-invites.functions.ts` peek/accept — not read this pass.
3. Resolved `jszip` version in `bun.lock` vs the known prototype-pollution CVE.
4. Whether revoking attorney access invalidates an already-open portal session immediately or only on next reload.
5. Whether `runExport` (settings.tsx export server fn) has a server-side tier check that would contradict the client-side "no paywall on personal data" behavior.
6. Whether `why-courts-struggle.tsx` (5 lines) is a live route or dead code.
7. Actual <380px rendering of `_attorney/billing.tsx`'s 3-column tier grid — needs a device screenshot, not just source inference.
