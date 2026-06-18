# PatternProof — MVP Launch Readiness Plan

A focused plan to take PatternProof from "feature-rich audit build" to a sharp, beta-testable MVP for survivors, attorneys, and DV advocates — plus a clean rollout of the new transparent logo system.

---

## 1. MVP launch readiness

### Must finish before beta
- Survivor: Landing → Safety warning → PIN → Onboarding → Journal → Timeline → Patterns → Court Packet export (end-to-end, no dead ends).
- Quick Exit button visible on every authenticated survivor page.
- PIN lock screen on app open + after inactivity.
- Stable Court Packet PDF (incidents, evidence, witnesses, dates, pattern summary).
- Attorney: Landing → Signup → Subscribe → Invite client → View client packet.
- Working Stripe checkout for Survivor Court Ready ($10) + Attorney Solo ($297).
- One unified Logo component shipped across all routes.

### Can wait (post-beta)
- Calendar view, OPRA helper, Escalation detector, Live recording, Communications log.
- Attorney Firm/Enterprise tier flows (keep pricing page, defer seats/SSO/billing splits).
- Hearing prep workspace (stub it as "Coming soon" on client detail).
- Court systems / Why courts struggle / Abuser tactics educational pages — collapse into a single Resources page.

### Unnecessary right now — remove or hide from nav
- `_authenticated/court-systems.tsx`, `why-courts-struggle.tsx`, `abuser-tactics.tsx` → merge into `/resources`.
- `attorney-portal.tsx` inside survivor area (redundant with `/share-with-attorney`).
- `legal-documents.tsx` (premature; no template engine yet).
- DV org route group — defer entirely, do not scaffold `_org` yet.

### Broken / confusing flows to fix
- Two attorney entry points (`/attorney/$token` + `/accept-invite/$token`) → consolidate to one invite flow.
- `/court-ready` vs `/court-ready-thanks` — collapse thanks into a toast + redirect to `/court-packet`.
- Survivor nav currently surfaces 20+ items — trim to 7: Dashboard, Journal, Timeline, Evidence, Patterns, Court Packet, Resources.
- `/onboarding` runs even for returning users in some cases — gate on `profiles.onboarded_at`.

---

## 2. Survivor beta flow (with copy)

| Step | Route | Headline | Body copy |
|---|---|---|---|
| Landing | `/` | "Document what happened. Safely." | "PatternProof helps you record incidents, see patterns, and prepare court-ready evidence — privately, on your own time." |
| Safety warning | modal before signup | "Before you continue" | "Use PatternProof only on a device the other party cannot access. A Quick Exit button is always at the top of every page. If you are in immediate danger, call 911 or your local emergency line." |
| PIN setup | `/onboarding/pin` | "Set a 4-digit PIN" | "Your PIN locks PatternProof when you step away. We can't recover it, so pick something you'll remember." |
| Onboarding | `/onboarding` | "A few quick questions" | "This helps us organize your records. You can change any answer later." (case type, jurisdiction, other party) |
| First incident | `/journal/new` | "Log your first incident" | "Write what happened in your own words. Date, place, and how you felt. Add evidence anytime." |
| Timeline | `/timeline` | "Your record, in order" | "Every incident, in the order it happened. Tap any entry to add detail or evidence." |
| Pattern insight | `/patterns` | "We noticed a pattern" | "Based on what you've logged, here's what's repeating. Patterns are what courts respond to." |
| Export prompt | inline on Timeline after 3+ incidents | "Ready to share this with someone?" | "Export a clean, dated summary you can give to an attorney or advocate." |
| Court Ready upgrade | `/court-ready` | "Court Ready packets" | "$10/month or pay-what-you-can. Full PDF packet, evidence index, pattern summary, attorney-ready formatting. Cancel anytime." |

---

## 3. Attorney beta flow

| Step | Route | Purpose |
|---|---|---|
| Landing | `/for-attorneys` | Hero line: **"See the pattern before the hearing."** Sub: "Receive court-ready documentation from clients in one organized packet." |
| Signup | `/lawyer-signup` | Email + firm name + bar # (optional). |
| Subscribe | `/subscribe` | Solo $297 default selected; Firm/Enterprise visible but "Contact us". |
| Invite client | `/clients` → "Invite client" | Generates a one-time invite link the survivor accepts at `/accept-invite/$token`. |
| Client dashboard | `/clients` | Table: client, last activity, incident count, packet status. |
| Client detail | `/clients/$clientId` | Pattern summary at top, timeline, evidence index, download packet. |
| Pattern review | tab on client detail | Shows detected patterns with incident references. |
| Court packet export | button on client detail | One-click PDF + ZIP of evidence. |
| Hearing prep | stub | "Coming soon — request early access." |

Copy anchor everywhere on attorney side: **"See the pattern before the hearing."**

---

## 4. Conversion & pricing audit

### Survivor — Court Ready
Current: $10/mo + PWYC. Page does not explain *what changes* after upgrading. Fix:
- **Free**: Unlimited journal, timeline, evidence uploads, basic PDF export.
- **Court Ready — $10/mo (or PWYC)**: Full court packet PDF with pattern summary, evidence index, witness list, attorney-ready formatting, priority export, share link to attorney.

Upgrade prompts (non-predatory): inline on Court Packet page when free user clicks Export, and a single dismissible banner on Patterns page after 5+ incidents.

### Attorney
- **Solo — $297/mo**: 1 attorney seat, unlimited clients, packet downloads, pattern review, email support.
- **Firm — $697/mo**: Up to 5 seats, shared client list, branded packets, priority support.
- **Enterprise — $1,497/mo**: Unlimited seats, SSO, custom intake form, dedicated success manager.

Add a clear "What you get" bullet block on `/for-attorneys` and `/subscribe`. Add testimonial slot (placeholder for beta).

---

## 5. Trust & safety layer (copy)

- **Crisis disclaimer** (footer of safety warning + Resources): "PatternProof is not an emergency service. If you are in immediate danger, call 911 or your local crisis line."
- **Legal disclaimer** (footer + court packet cover): "PatternProof helps you organize your own records. It does not provide legal advice. For legal guidance, talk to a licensed attorney."
- **Privacy** (settings + landing): "Your records are private to you. We use encryption in transit and at rest. We do not sell your data."
- **Safe device warning** (pre-signup modal): "Use PatternProof only on a device the other party cannot access."
- **Quick Exit explainer** (tooltip on the button): "Tap to leave this site immediately. It will open a neutral page."
- **Court document disclaimer** (cover page of every packet): "This document was prepared by the user. It is a personal record, not a sworn statement or legal filing."
- **Data export warning** (before download): "Once exported, this file lives on your device. Store it somewhere only you can reach."
- **Safe-device reminder** (login screen, small text): "Only sign in on a device you trust."

---

## 6. Court-ready output quality

### Packet should include
1. Cover page: client name, case type, date range, jurisdiction, disclaimer.
2. Pattern summary (1 page): plain-language summary of recurring behaviors with incident counts.
3. Chronological incident log: date, time, location, description, abuse type tags, witnesses, emotional impact.
4. Evidence index: each item numbered, linked to the incident it supports, with date and source.
5. Witness list.
6. Voice note transcripts (if any).

### Language rules
- Factual, neutral, first-person ("I observed", not "He abused").
- No diagnostic language ("narcissist", "sociopath").
- No legal conclusions ("this constitutes harassment").
- Dates in ISO + readable form. Times in 24h.
- Every claim links back to a logged incident ID.

### Organization
- Group by month, then chronological within.
- Screenshots/photos rendered inline at incident, full-res in appendix.
- Audio notes referenced by file name + duration; transcript inline.

---

## 7. PatternProof's moat

Not a journal, not a folder, not Notes. The defensible wedge:
1. **Pattern detection** across incident types (coercive control, custody interference, financial) — surfaces what survivors and attorneys both miss.
2. **Court-ready formatting** out of the box — neutral language, evidence linkage, disclaimer-correct.
3. **Attorney handoff** as a first-class product surface, not an export button.
4. **Survivor-safe UX**: PIN lock, Quick Exit, safe-device warnings, no notifications.
5. **Trauma-informed**: warm copy, no red, no alarms, no "errors" — calm language throughout.
6. **Custody + coercive control visibility** — categories and patterns most generic tools don't model.

---

## 8. Visual polish audit

### Survivor mode (iridescent teal/purple on soft white)
- Currently leans terracotta/cream in places — inconsistent with the new direction.
- Fix: replace warm terracotta CTAs on `/dashboard`, `/journal`, `/timeline` with iridescent teal→purple gradient buttons; keep white card surfaces, drop the `#DEB896` tan.
- Add soft glow under hero logo, subtle pastel gradient on dashboard header strip.

### Attorney mode (navy + white)
- Cards feel plain. Fix: deeper navy header bar, white cards with thin 1px slate border, structured table density on `/clients`.
- Add small navy "PatternProof for Attorneys" lockup in header.

### DV org mode (white/gray/light blue)
- Not built yet — defer entirely per scope.

### Cross-mode
- Sidebar item counts too high on survivor → trim to 7.
- Inconsistent font weights between Playfair headings and section labels — standardize H1 600, H2 500, body 400.

---

## 9. Beta testing checklist

**Recruit**: 5 survivors (mix of DV and high-conflict custody), 3 attorneys (1 solo, 2 small-firm), 2 DV advocates.

**Tasks each tester completes**
- Survivors: sign up → set PIN → log 3 incidents → upload 1 piece of evidence → export packet.
- Attorneys: sign up → subscribe (test mode) → invite a survivor → open packet → export.
- Advocates: walk through survivor flow and rate safety language.

**Questions to ask**
- Did anything feel unsafe, alarming, or clinical?
- Was the Quick Exit obvious?
- Did the packet look like something you'd hand to a judge / receive from a client?
- What was missing? What was too much?
- Would you pay $10/mo? Would you pay $297/mo?

**Metrics to track**
- Time to first incident logged.
- % completing Court Packet export.
- Drop-off step in onboarding.
- Attorney: time from signup to first client invite.

**Red flags before launch**
- Any tester triggered by copy.
- Quick Exit not noticed.
- Packet language sounds accusatory or diagnostic.
- More than 2 testers confused by nav.
- Attorneys say packet isn't usable in court.

---

## 10. Next build priority (ranked)

### Must ship before beta
1. New transparent Logo component + variant routing (see Technical section).
2. Trim survivor nav to 7 items; merge education pages into `/resources`.
3. Re-skin survivor mode to iridescent teal/purple (remove terracotta/tan from authed routes).
4. Fix Court Packet PDF: cover page, disclaimers, pattern summary, evidence index.
5. Consolidate attorney invite flow (one route, one token).
6. Wire upgrade prompts on Court Packet export + Patterns banner.

### Should ship soon
7. Hearing prep stub on client detail with waitlist capture.
8. Per-mode trust/safety copy pass (all 8 disclaimers).
9. Stripe live mode for Solo + Court Ready; Firm/Enterprise as "Contact us".

### Later
10. DV org portal, Live recording, Escalation detector, OPRA helper, Calendar.

---

## Technical section — Logo system rollout

### Assets
Extract uploaded zip and upload as CDN assets:
- `src/assets/patternproof-logo-attorney-transparent.png.asset.json`
- `src/assets/patternproof-logo-survivor-transparent.png.asset.json`
- `src/assets/patternproof-logo-org-transparent.png.asset.json`

### Component
`src/components/Logo.tsx`:
```tsx
type Variant = "attorney" | "survivor" | "org";
interface Props { variant: Variant; size?: number; className?: string; }
```
- Reads pointer JSON for the matching variant.
- Renders `<img>` with `alt="PatternProof logo"`, intrinsic sizing via `height={size}`, `width="auto"`.
- Adds variant-specific filter:
  - survivor: `drop-shadow(0 0 12px rgba(180,160,255,0.35))`
  - attorney: `drop-shadow(0 1px 2px rgba(15,27,61,0.25))` on light bg, none on navy.
  - org: `drop-shadow(0 1px 1px rgba(0,0,0,0.08))`.
- Never wrap in a white box.

### Route-group auto-selection
- `_attorney.tsx` layout passes `variant="attorney"` via context or imports Logo directly.
- `_authenticated.tsx` layout uses `variant="survivor"`.
- Future `_org.tsx` uses `variant="org"`.
- Public routes (`/`, `/login`, `/for-attorneys`, `/lawyer-signup`) choose explicitly based on audience.

### Sizing tokens
- Header: 40px. Sidebar: 36px. Auth/onboarding: 80px. Landing hero: 120px.

### Files touched (logo only)
- New: `src/components/Logo.tsx`, 3 `.asset.json` pointers.
- Edited (replace existing wordmark): `__root.tsx` or per-layout headers in `_attorney.tsx`, `_authenticated.tsx`, plus `index.tsx`, `login.tsx`, `for-attorneys.tsx`, `lawyer-signup.tsx`, `onboarding.tsx`.

---

## Out of scope for this round
- DV org portal and any `_org` routes.
- Hearing prep workspace (stub only).
- Firm/Enterprise billing internals.
- Calendar, Live recording, Escalation detector, OPRA helper, Communications.
