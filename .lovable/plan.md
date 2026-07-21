
# PatternProof — Comprehensive Read-Only Audit

Scope: marketing/funnel, security/privacy/trust, product/UX, engineering/QA. Evidence gathered from repo (file:line) and Supabase schema. No changes made.

---

## Executive Summary

PatternProof has a real, functional core (survivor journal, evidence, timeline, court packet, attorney portal with invite/scope model, MCP server, working Stripe wiring, RLS on primary tables). The problems blocking growth and trust are not the core — they are the surface: **overstated security/legal claims, visibly fake social proof, an unmeasured funnel, native `confirm()`/`alert()` dialogs on trauma-sensitive actions, missing device-safety guidance, a dead `/terms` link inside mandatory onboarding, a stale-domain sitemap, and a Clio integration that is marketed as capability while being a placeholder.**

The two highest-risk categories are:

1. **Trust claims that outrun the code.** "End-to-end encrypted," "court-ready," "enterprise-grade security," a PIN "lock" that is UI-only, a "safe exit" that doesn't clear history, and a SECURITY.md that is an unchecked template — any adversarial attorney, ED, or journalist will find these in ten minutes.
2. **Zero visibility into the funnel.** No analytics, three personas, three CTAs, a mailto-only org pilot. You cannot improve what you cannot measure, and the org buyer path is currently a dead-end into `patternproofco@gmail.com`.

Everything else is fixable in days, not months.

---

## Top 10 Critical Issues (ranked by severity × business impact)

| # | Issue | Sev | Impact |
|---|---|---|---|
| 1 | `/terms` link in mandatory onboarding modal 404s — every new user hits it (`OnboardingModal.tsx:90`) | Critical | Blocks legal consent, breaks trust on step one |
| 2 | "End-to-end encrypted" badge + "Encryption of data at rest" claim without matching implementation (`login.tsx:238`, `privacy.tsx:185-186`) | Critical | Legal/PR risk, misleads DV survivors into false safety |
| 3 | PIN Lock stored as unsalted SHA-256 in localStorage; does not gate Supabase queries (`pin-lock.tsx:10`) | Critical | Branded as security, is UI-only; bypassable via devtools |
| 4 | Quick Exit only redirects — does not clear history/session/DOM (`QuickExitButton.tsx:16-21`, duplicated in `AppShell.tsx:22-38`) | Critical | Core survivor-safety feature under-delivers vs. brand promise |
| 5 | Visibly placeholder testimonials & partner logos live on homepage (`SocialProofSection.tsx:6,12,18`) | Critical | Kills credibility instantly with attorneys/EDs |
| 6 | Zero analytics anywhere (no GA/Plausible/PostHog) across three funnels | Critical | Every conversion decision is blind |
| 7 | Org pilot funnel is `mailto:patternproofco@gmail.com` only — no form, no CRM, no tracking | High | Highest-ACV persona has the worst path |
| 8 | Sitemap points to stale `project--...lovable.app` domain and lists only `/` and `/login`; contradicts `robots.txt` and route canonicals (`sitemap.xml.ts:5,18-20`) | High | SEO is effectively broken for pricing/for-attorneys/for-orgs/demo |
| 9 | `fetchSharedBundle` returns full case + signed evidence URLs to anyone holding a token, no rate limit, no audit log (`attorney-public.functions.ts:24`) | High | A forwarded/leaked link = full disclosure until revoked |
| 10 | No stalkerware / shared-device / notification-leakage warning anywhere in onboarding or settings | High | Category-defining safety gap for a DV product |

---

## Verified Facts vs. Assumptions

**Verified (evidence in code):**
- RLS enabled with owner-scoped policies on `incidents`, `evidence`, `voice_notes`, `cases`, `communications`, `message_threads`, `thread_messages`, `audit_log`, `recordings`, `escalation_flags`, `opra_requests`.
- Storage buckets (`evidence-files`, `voice-notes`, `message-exports`, `conversation-recordings`) are private with owner-scoped `storage.objects` RLS.
- Stripe webhook does real HMAC + 300s replay window (`stripe.server.ts:47-80`).
- Invite tokens use DB-side `gen_random_bytes(24)` (192-bit).
- MCP tools use a user-token-scoped Supabase client — RLS enforced (`src/lib/mcp/supabase.ts:5-14`).
- `acceptSurvivorInvite` validates JWT email vs invite and validates scope-array ownership before granting.
- Pricing numbers are internally consistent ($297 Solo attorney, $299 org) across `pricing.tsx` and `for-attorneys.tsx`.
- Stripe env-gating (`billing.tsx:28`, `VITE_STRIPE_ENV`) is clean.
- Bulk invite hard-caps at 100 with clear messaging (`clients.index.tsx:200,250`).
- All in-app `<Link to=...>` targets in the audited set resolve to real routes.

**Assumed / unverified (call out before shipping claims):**
- RLS policies on `subscriptions`, `user_roles` not located in scanned migrations — must be confirmed present.
- `case_grants` referenced elsewhere but not located — confirm schema.
- No `deleteAccount` / `purgeUserData` server function was found — retention/deletion claims in `privacy.tsx` are currently unsupported by discoverable code.
- "Access is logged per file" copy shown to attorneys (`clients.$clientId.tsx:1448`) has no backing access-log implementation found.
- Demo page pattern analysis text is hardcoded; marketing claim of "AI pattern detection" is only partially backed by `ai-chat.functions.ts`.

---

## Bugs & Broken Flows

- `/terms` 404 inside onboarding (`OnboardingModal.tsx:90`).
- Native `confirm()` used on 13 delete/revoke sites: `evidence.tsx:216`, `journal.tsx:117`, `live-recording.tsx:190`, `voice-notes.tsx` (delete), `court-dates.tsx` (delete), `attorney-portal.tsx:78`, `clients.$clientId.tsx:736,879,2378`, etc.
- `legal-documents.tsx:445` uses raw `alert("Edit form will open in a future update.")` — dead-end UI.
- `clients.$clientId.tsx:2375,2382` surface raw Stripe/Postgres error strings via `toast.error((e as Error).message)`.
- Onboarding can loop indefinitely if `onboarding_complete` write fails — no retry/skip (`OnboardingModal.tsx:47-138`).
- Double-Esc exit logic duplicated in `AppShell.tsx` and `QuickExitButton.tsx` — divergence risk.
- Live-recording legal warning only gates on `localStorage` (`live-recording.tsx:42-48`); new device = no warning.
- `OnboardingModal.tsx:48` lacks `role="dialog"` / `aria-modal` / focus trap (only `AddFromJournalModal.tsx:134` has these across the audited set).
- Sitemap references stale Lovable staging domain while `robots.txt` uses `pattern-proof.tech` — likely rejected by crawlers.
- `for-attorneys.tsx:74` pricing grid uses fixed `repeat(3, minmax(0,1fr))` — cramps on mobile, unlike the responsive grid in `pricing.tsx`.
- Escalation Detector uses brittle keyword list (`escalation-detector.tsx:16,30`) with clinical "Tier 1/2" framing, no "may be wrong" disclaimer.

---

## Security & Privacy Risks

- **Overstated encryption:** "END-TO-END ENCRYPTED" (`login.tsx:238`) and "Encryption of data at rest" (`privacy.tsx:185-186`) — no client-side/E2E encryption exists.
- **SECURITY.md is a template**, not evidence; presenting it as posture is misleading.
- **PIN lock is UI-only**, unsalted, does not encrypt or gate API calls.
- **Quick Exit** does not clear history/sessionStorage/DOM before redirect.
- **Shared-link exposure:** `fetchSharedBundle` — unauthenticated, no rate-limit, no audit trail; signed URLs (1h) leak entire case if link is forwarded.
- **Service-role fan-out:** `supabaseAdmin` used across invite flows and webhook. Spot-checked calls include ownership filters, but the pattern is fragile — every admin query is a potential IDOR if a filter is omitted. Needs a review checklist and ideally a wrapper enforcing `attorney_user_id`/`user_id` filters.
- **Metadata trust:** `webhook.ts:118-152` reads `subscription.metadata.userId` — verify this is set server-side at checkout creation.
- **Log hygiene:** confirm no PII/Stripe customer objects flow to log aggregators (`webhook.ts:188` and similar).
- **Missing controls:** confirmable RLS policies on `subscriptions`/`user_roles`; delete/purge flow; access-log implementation behind "logged per file" copy.
- **No device-safety guidance** anywhere for shared devices / stalkerware / notification preview leakage.

---

## Conversion & Revenue Blockers

- No analytics → cannot A/B, cannot see drop-off, cannot justify ad spend.
- Placeholder social proof visibly labeled "coming soon" → destroys trust in the 3-second impression.
- Org pilot = mailto → highest-ACV persona has the worst UX.
- Sitemap missing `pricing`, `for-attorneys`, `for-organizations`, `demo` → SEO capture leakage.
- Clio "Yes… coming soon" contradiction in pricing FAQ → careful attorneys will notice.
- No lead capture on marketing pages (no email gate, no "book a demo" scheduler).
- No case studies, no third-party badges, no press mentions.

---

## Persona Objections

- **Family-law attorney:** "You claim court-ready — under whose evidentiary standard? Where is chain-of-custody hashing? Where is Clio actually integrated?"
- **DV org ED:** "How do I request a pilot without emailing a Gmail address? What is your data-processing agreement? Where's your SOC/HIPAA posture? Who owns data on offboarding?"
- **Advocate:** "How much time will this add to intake? What do I tell survivors when the AI is wrong?"
- **Survivor:** "'End-to-end encrypted' — is it really? What happens if my abuser sees my browser history after I 'exit safely'? Is the PIN actually protecting anything?"
- **Attorney (procurement):** "Where is your DPA, subprocessor list, incident response contact, SLA?"

---

## Quick Wins (< 2 hours each)

1. Create `src/routes/terms.tsx` (or point onboarding to `/privacy` until Terms exist).
2. Remove "END-TO-END ENCRYPTED" badge; rewrite as "Private by default — data is encrypted in transit and at rest by our infrastructure provider."
3. Replace all `SocialProofSection` placeholders with either a real founder quote block or delete the section entirely until real testimonials exist.
4. Fix sitemap to use `pattern-proof.tech` and include pricing/for-attorneys/for-organizations/demo.
5. Add Plausible or PostHog snippet in `__root.tsx`.
6. Replace org "Request a Pilot" mailto with a simple `/request-org-access` form (route already exists — wire the CTA).
7. Fix `for-attorneys.tsx` pricing grid to responsive `auto-fit, minmax(300px, 1fr)`.
8. Resolve Clio FAQ contradiction — change "Yes" to "Not yet — export ZIP available today; native sync in development."
9. Change `alert()` in `legal-documents.tsx:445` to a toast + hide the button until implemented.
10. Rename "PIN Lock" UI copy to "Screen Lock" and add a one-line disclaimer that it does not encrypt data.
11. Add stalkerware/shared-device warning card to onboarding step 1.
12. Add `role="dialog"` + focus trap to `OnboardingModal.tsx`.

## Fixes (< 1 day each)

13. Replace all `confirm()` / `alert()` calls with a branded `ConfirmDialog` component (13 sites).
14. Salt the PIN hash and store per-user; add rate limiting on unlock attempts.
15. Strengthen Quick Exit: clear `sessionStorage`, overwrite DOM to a neutral page, push several history entries pointing at the exit URL, then `location.replace`.
16. Add audit-log rows on every `fetchSharedBundle` access; add IP-based rate limit; shorten signed URL TTL to 10 minutes and require re-fetch.
17. Add explicit AI disclaimers on Escalation Detector, Patterns, AI Sidekick, and any AI-drafted incident form.
18. Reconcile `privacy.tsx` claims with reality; add a data-processing addendum stub and subprocessor list.
19. Add `role="dialog"`/focus trap to every modal, not just onboarding.
20. Confirm RLS policies exist on `subscriptions`, `user_roles`, `case_grants` (or add them).
21. Implement `deleteAccount` server function with cascade — required to back deletion claims.
22. Centralize `supabaseAdmin` behind a helper that mandates an owner-scope filter argument.
23. Attorney lead form + scheduling (Cal.com embed) on `/for-attorneys` and `/for-organizations`.

## Larger Projects (multi-day → multi-week)

24. Chain-of-custody: on every evidence upload store SHA-256 hash + size + mime + uploader UA/IP; expose in court packet and attorney view. Back the "logged per file" copy with real data.
25. Real E2E or field-level encryption for `description`, `emotional_impact`, transcript text — if kept out of scope, aggressively rewrite all confidentiality copy.
26. Trauma-informed onboarding rewrite (multi-step, skippable, progress-visible, offline-tolerant).
27. Native Clio OAuth + matter push (currently placeholder).
28. Access-review dashboard for survivors: "Who has seen what, when."
29. Formal DPA/subprocessor page, incident response contact, SLA — required for org procurement.
30. SOC 2 Type I readiness assessment if orgs are the ICP.

---

## 30-Day Remediation Plan

**Days 1–3 (Trust triage — do first, they are all short):**
- Ship all 12 Quick Wins.
- Publish an updated `privacy.tsx` and a real Terms page.
- Add Plausible/PostHog.
- Fix sitemap.

**Days 4–10 (Safety hardening):**
- Ship branded ConfirmDialog and remove every `confirm()`/`alert()`.
- Salt PIN, rename to Screen Lock, add rate-limit.
- Strengthen Quick Exit.
- Add stalkerware warnings across onboarding + settings.
- Add AI disclaimers on all model-backed surfaces.

**Days 11–18 (Attorney/Org conversion):**
- Real lead-capture forms on `/for-attorneys` and `/for-organizations` with Cal.com scheduling.
- Replace placeholder social proof (or delete) — begin outreach for 3 real quotes.
- Resolve Clio contradiction in copy; keep placeholder disabled.
- Ship attorney "chain-of-custody" hash pipeline for uploads.

**Days 19–24 (Data ownership & auth):**
- Ship `deleteAccount` cascade + surface it in Settings.
- Central `supabaseAdmin` wrapper enforcing owner filter.
- Confirm/repair RLS on `subscriptions`, `user_roles`, `case_grants`.
- Rate-limit + audit-log on `fetchSharedBundle`; TTL down to 10 min.

**Days 25–30 (Buyer readiness):**
- Publish DPA, subprocessor list, incident-response contact, retention schedule (matching actual code).
- Draft SOC 2 Type I gap analysis.
- Ship one real case study (survivor + attorney permission).
- Instrument funnel dashboards; set baseline conversion rates for each persona.

---

## Grace-only decisions (nothing below this line is technical)

- **Positioning:** Is the primary buyer survivor (B2C, $10-15/mo) or attorney/org (B2B, $297-$999+)? Current site tries three at once; the code shows the attorney portal is the most-invested surface.
- **Encryption posture:** Real E2E (multi-week engineering + UX cost, worth it for DV) vs. current "at rest" (fastest, requires you to strip "end-to-end" copy today).
- **Court-ready language:** Keep it and add legal disclaimers everywhere, or replace with "documentation-grade" and reserve "court-ready" for jurisdictions where an actual attorney has certified the packet.
- **Org GTM:** Self-serve pilot form vs. sales-led (Cal.com book-a-call). Current mailto is neither.
- **Support model:** Publish a support SLA before onboarding a single DV org, or state clearly "community support only."

No code was modified. This plan is the deliverable. Reply with which section to execute first and I'll switch to build mode.
