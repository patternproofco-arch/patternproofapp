# PatternProof Rebrand & Full Sweep

Three workstreams. I'll do them in this order so the underlying gates exist before the copy lands on top.

## 1. Pricing & Stripe products

Replace existing Stripe products with the four canonical SKUs. Human-readable price IDs (stable across sandbox/live):

| Tier | Audience | Price ID | Amount | Interval |
|---|---|---|---|---|
| Court Ready | Survivor | `court_ready_monthly` | $10 | month |
| Court Ready (pay-what-you-can) | Survivor | `price_data` inline, min $1 | variable | one-time |
| Solo | Attorney | `attorney_solo_monthly` | $297 | month |
| Firm (recommended) | Attorney | `attorney_firm_monthly` | $697 | month |
| Enterprise | Attorney | `attorney_enterprise_monthly` | $1497 | month |

Existing `attorney_portal_monthly_297` stays as the underlying price for Solo (rename via lookup_key swap). All registered with `txcd_10103001` (SaaS) + `managed_payments: { enabled: true }`.

Tier resolution in `payments.functions.ts` maps `price_id` → tier name + client cap (Solo 5, Firm unlimited+3 seats, Enterprise unlimited+white-label flag).

## 2. Gating changes

**Survivor side — keep Core free forever.**
- Court Ready paywall ONLY blocks: AI court packet generation, attorney share/export. Everything else (journal, timeline, evidence, voice notes, PIN, escalation detector, quick exit) stays open. No hard paywall on the survivor app.
- Court Ready upsell screen lives at `/court-ready` with two CTAs: `$10/month` and `Pay what you can` (custom amount checkout, $1–$500).

**Attorney side — hard paywall on first login.**
- Remove the "view 1 client free" softness from `_attorney/clients.index.tsx` and `_attorney.tsx`. The Pilot becomes marketing copy only.
- `_attorney.tsx` layout: if `!subscription.isActive`, redirect to `/subscribe` before rendering any child.
- `accept-invite.$token.tsx` (attorney path): after acceptance, route to `/subscribe`, not `/clients`.

## 3. Copy & UX sweep

**The four screens that matter:**

1. **Survivor Screen 1** (`onboarding.tsx` step 0) — rewrite to "You don't have to remember everything alone." PIN step (current step 1) moves to be the FIRST interactive step, before anything else. Name/state come after.
2. **Free Promise** — new standalone route `/free-promise` shown once after PIN setup, before state selection: "This app is free. Full stop." with a single "Continue" button.
3. **Attorney Pricing Hero** (`lawyer-signup.tsx` or new `/for-attorneys`) — hero line "Your clients are already documented before they walk in the door." + Grace's signature story block + 3-tier pricing (Solo / Firm-highlighted / Enterprise) + Pilot framing + cognitive close "$297/month. One billable hour. Your first client is free — The Pilot."
4. **Attorney Portal first login** (`clients.index.tsx` empty state) — replace empty grid with a **Diagnosis Card**: "Status: ready. What needs attention: invite your first client." Never shows raw empty state.

**Banned-word sweep** (rg-driven, then manual):
- Survivor-facing files: replace `victim` → `survivor`, `evidence` (in user-facing copy only — column names stay) → `record`/`proof`, `incident report` → `entry`, `abuser` → `the other party`, `free trial` → `The Pilot` (attorney) / removed (survivor), `basic plan` → `Core`, `upgrade now` → `unlock Court Ready`, `are you sure?` → specific question.
- Attorney-facing: `victim` → `client`, `free trial` → `The Pilot`, `we hope this helps` → removed, "feature-first" descriptions reworded outcome-first.
- "we think / we believe" → "I've observed" everywhere it appears in marketing copy.

**Global Quick Exit** — `QuickExitButton.tsx` already exists. Verify it's mounted in `_authenticated.tsx` AppShell (bottom-right, always visible). Add if missing.

**Cognitive close audit** — pass through dashboard, journal, timeline, evidence, voice-notes, patterns, court-packet, settings. Replace generic "Learn more" / dead-end empty states with one specific next action per screen.

## Technical details

**Files I'll touch:**
- `src/lib/payments.functions.ts` — add `createCourtReadyCheckout` (fixed) and `createPayWhatYouCanCheckout` (price_data, $1 min). Update tier resolution map. Solo/Firm/Enterprise checkout helpers.
- `src/hooks/useSubscription.ts` — expose `tier: 'core' | 'court_ready' | 'solo' | 'firm' | 'enterprise'` derived from price_id.
- `src/routes/_attorney.tsx` — hard paywall guard.
- `src/routes/_attorney/subscribe.tsx` — rewrite as 3-tier picker (Solo / **Firm recommended** / Enterprise), Grace's story, Pilot framing.
- `src/routes/_attorney/clients.index.tsx` — diagnosis card replaces empty state.
- New `src/routes/for-attorneys.tsx` — public attorney pricing hero (replaces or supplements `lawyer-signup.tsx`).
- New `src/routes/_authenticated/court-ready.tsx` — survivor upsell with $10 + pay-what-you-can.
- New `src/routes/_authenticated/free-promise.tsx` — standalone screen post-PIN.
- `src/routes/_authenticated/onboarding.tsx` — reorder: intro → PIN → free promise (redirect) → state. Strip "name/email" personal asks before PIN.
- `src/routes/_authenticated/court-packet.tsx`, `share-with-attorney.tsx` — gate behind `tier !== 'core'`, link to `/court-ready`.
- `src/components/AppShell.tsx` — verify QuickExitButton mounted globally.
- `src/components/StripeEmbeddedCheckout.tsx` — extend to accept a `customAmountCents` prop for pay-what-you-can path (calls new server fn).
- Stripe products created via `payments--batch_create_product`.
- DB migration: add `tier` column to `subscriptions` (text, nullable, derived in webhook). Skip if already represented via price_id.

**What I'm NOT touching:**
- Underlying schema (incidents, evidence, voice_notes, etc.) — column names like `evidence` stay, only user-visible copy changes.
- Auth flow itself, RLS, attorney-client linking model.
- Patterns/escalation analysis logic.

## Out of scope (flag for later)

- Firm tier seat management UI (multi-attorney invite flow) — pricing exists, seat enforcement is a future build.
- Enterprise white-label theming.
- Pay-what-you-can recurring (custom amount is one-time only; recurring requires custom Stripe price creation per user, much bigger scope).
- Localization, A/B test infrastructure for hero copy.

Ready to build on approval. I'll work in passes: Stripe products → gating → 4 hero screens → copy sweep → quick-exit + cognitive-close audit, verifying preview between passes.
