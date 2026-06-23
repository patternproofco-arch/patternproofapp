
# PatternProof Unification + Attorney Portal Completion

This is a very large scope (design system + 10 attorney features across ~40 routes). I need to break it into reviewable phases — shipping it all in one turn would be unreviewable and almost certainly introduce regressions across the survivor app. Here's how I'll structure it.

---

## Phase 0 — Shared design system (foundation)

Single source of truth in `src/styles.css` + `src/styles/attorney.css`:

- **Tokens**: base (`--pp-bg #FAFBFF`, `--pp-fg #14171F`, `--pp-card #FFF`, `--pp-border #E2E8F0`), brand (teal `#2F8D85`, navy `#1B2A4A`, deep navy `#071426`, blue `#2D4A8A`), iridescent accents (purple/mint/blue/lilac/pink/gold), status (success/warning/danger/destructive).
- **Typography load**: confirm Inter + Instrument Serif + IBM Plex Sans + IBM Plex Mono in `__root.tsx` head links.
- **Shared utilities**: `.pp-card`, `.pp-input`, `.pp-badge`, `.pp-btn-primary`, `.pp-btn-secondary`, `.pp-btn-danger`, `.pp-page-header`, `.pp-empty-state`, `.iridescent-divider`, `.att-cockpit-bg`, `.att-glass`, `.att-glow`, `.att-tab-active`.
- **Standardize radius/shadow/spacing scale** so survivor + attorney + org share one rhythm.

No component logic changes — purely tokens/utilities.

---

## Phase 1 — Shared primitives & page header pattern

- New `<PageHeader eyebrow title description action />` used across every main page (survivor + attorney + org).
- New `<EmptyState>`, `<StatusBadge>`, `<SectionDivider iridescent />` components.
- Reskin shadcn `button`, `input`, `card`, `badge` variants to bind to the new tokens (no API changes — just internal classes).

---

## Phase 2 — Attorney cockpit shell

Rebuild `src/routes/_attorney.tsx`:

- Navy gradient bg `#071426 → #1B2A4A → #2D4A8A`.
- Top nav: Clients · Cases · Timeline · Patterns · Evidence · Gaps · Deposition · Court Packet · Billing · Settings.
- Active tab = soft blue glow + iridescent underline.
- Sticky header with firm + attorney name, environment badge, sign-out.
- Instrument Serif page titles, IBM Plex Sans body, IBM Plex Mono case IDs.

---

## Phase 3 — Attorney onboarding

New route `src/routes/_attorney/onboarding.tsx` (gated until `attorney_profiles.onboarded`). Collects name, email, firm, bar number, jurisdiction, role (solo/firm/paralegal/advocate), confidentiality checkbox, tier selection → Stripe checkout or `/clients`.

**Migration**: extend `attorney_profiles` with `firm_name`, `bar_number`, `jurisdiction`, `role`, `confidentiality_accepted_at`, `onboarded`.

---

## Phase 4 — Client intake pipeline

Upgrade `_attorney/clients.index.tsx`: invite survivor (email), status pills (Pending/Accepted/Expired/Revoked), revoke + resend + copy link, per-client last activity, case readiness %, missing evidence count, risk badge.

---

## Phase 5 — Case command dashboard

Rebuild `_attorney/clients.$clientId.tsx` Dashboard tab: Risk · Pattern summary · Incident count · Evidence count · Timeline density · Escalation markers · Missing info · Upcoming court dates · Recent uploads · Attorney notes.

---

## Phase 6 — Evidence review workflow

Tags per item: Useful · Needs context · Duplicate · Exclude · Privileged · Exhibit candidate. Private notes, exhibit label, linked incident, source/date, preview, download.

**Migration**: `attorney_evidence_reviews (attorney_id, evidence_id, status, exhibit_label, notes, linked_incident_id)`.

---

## Phase 7 — Case Gaps tab

Rule-based gap analysis with why-it-matters + suggested fix + "Request clarification" (writes `attorney_document_requests`).

---

## Phase 8 — Deposition & hearing prep

AI-generated (Lovable AI Gateway) deposition questions, contradictions, key/strongest/weakest evidence, talking points, court-safe phrasing.

---

## Phase 9 — Court packet export upgrade

Cover · TOC · overview · pattern summary · timeline · escalation · evidence index · exhibit list · legal docs · optional attorney notes toggle · PDF + ZIP.

---

## Phase 10 — Attorney notes surfaces

Notes on client dashboard, incidents, evidence, timeline, exports. Never surfaced to survivor.

---

## Phase 11 — Billing polish

3-tier compare (Solo $297 · **Firm $697 ★** · Enterprise $1,497), billing status, upgrade/downgrade via Stripe portal, locked states, payment success.

---

## Phase 12 — Security & audit trail

Trust panel in Settings: read-only badge, access log (from `audit_log`), last viewed, export history, invite history, revoked access, confidentiality reminder.

---

## Phase 13 — Survivor + Org cohesion pass

Apply `<PageHeader>`, unified buttons/cards/inputs/badges, iridescent dividers, shared empty/loading states across survivor routes (Dashboard, Journal, Evidence, Timeline, Patterns, Agent, Court Packet, Case Builder, Court Dates, Voice Notes, Communications, Legal Docs, Search, Share, Resources, Settings, OPRA, Court Ready) and org/public routes (`/`, `/login`, `/for-attorneys`, `/for-organizations`, `/request-org-access`, `/lawyer-signup`, `/accept-invite`, checkout/thanks). Survivor stays iridescent/soft; org stays clean/trustworthy; only system primitives unify.

---

## Technical notes

- DB migrations in Phases 3, 6 (and possibly 7). Each: 4-step pattern (CREATE → GRANT → RLS → POLICY), scoped via `auth.uid()` + `has_attorney_access`.
- All attorney server logic via `createServerFn` + `requireSupabaseAuth`.
- AI features via Lovable AI Gateway, no new secrets.
- Stripe reuses existing `payments.functions.ts` + `useSubscription` hook.
- No survivor data-fetching changes — survivor pass is pure UI/styling.

---

## Recommended rollout

Doing all 13 in one turn = thousands of lines, no review checkpoints, high regression risk on a live survivor app.

**My recommendation**: ship in three batches you can verify between:

- **Batch A** — Phases 0, 1, 2, 13 (design system + attorney shell + survivor/org cohesion). Visible everywhere, no DB changes.
- **Batch B** — Phases 3, 4, 5, 10, 11, 12 (attorney workflow + billing + audit). 1 migration.
- **Batch C** — Phases 6, 7, 8, 9 (evidence review + gaps + deposition + court packet export). 1 migration.

Reply with:
- **"Batch A"** → I start with the design system + cohesion sweep now.
- **"All sequentially"** → I do all 13 in order, one phase per turn, ~13 turns.
- Or list the specific phases you want (e.g. "0, 1, 2, 3, 4, 11").
