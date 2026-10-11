# PatternProof — Intake & Coach Spec
**Decision locked:** Sequenced survivor-safety-first path (fixed prompts first).  
**Status:** Active direction for next slice.  
**Last updated:** 2026-10-11  
**Owner:** Grace Burns / G. Burns Company LLC  

## Why this path

The highest risks are survivor safety, trust, and liability — not feature completeness. Generative Coach and full revocable professional sharing both create ways to violate the product’s core constraints before there is evidence they help. Existing onboarding (`src/routes/_authenticated/onboarding.tsx`) is already a short safety/consent gate. Journal, evidence, chronology, and sharing primitives exist. The next slice should prove that a low-load first session is safe and useful before adding model risk or complex sharing.

## Constraints (non-negotiable)

- Survivor remains in control of information and chooses what is shared and with whom.
- No diagnosis of abuse or clinical assessment.
- No legal advice or prediction of outcomes.
- Never claim “court-ready,” “admissible,” “chain of custody,” or automatic hours-saved.
- Language is supportive and non-directive. Prompts are skippable. Clear exits exist at every step.
- No dark patterns. Nothing is auto-shared.

## Definitions

**Intake** = the survivor’s first-session documentation flow after the existing safety/consent onboarding. Goal: one timestamped entry with optional light context, saved, with the ability to leave and return.

**Coach** = optional, skippable, fixed (human-written and reviewed) prompts that ask for missing useful context. Generative suggestions are out of scope until the fixed-prompt version is trusted.

## v1 slice (Phase 0 / early Phase 1)

In scope:
- Start with one entry (text, voice note, photo, or file) rather than a long form.
- 1–3 optional fixed prompts for approximate date/time, people involved, or a short survivor note on what the material shows.
- Clear exit / save-for-later.
- Entry is timestamped and appears in the existing chronology/journal view.
- Crisis/support resources remain accessible.

Out of scope for this slice:
- Generative AI prompts or model-driven organization.
- New sharing mechanics beyond what already exists.
- Professional-specific intake forms.
- Automatic packet generation or completeness scoring.

## Success signals for this slice

- Survivors can finish a first entry without feeling pushed.
- No critical safety feedback on prompt language.
- Qualitative signal from 2–3 professionals that a short source-linked entry is more usable than an unorganized file.
- Drop-off and support-resource clicks are monitored.

## Phased rollout

| Phase | Focus | Exit criteria |
|-------|--------|---------------|
| 0 | Fixed-prompt first-session flow on top of existing entry/chronology | Team can complete Flow A; language reviewed |
| 1 | Closed feedback with survivors + 2–3 professionals | Qualitative safety + usefulness signal; no critical issues |
| 2 | Lightweight generative suggestions only if Phase 1 is trusted | Prompts remain skippable; language guardrails hold |
| 3 | Expand sharing/export only after data model and revocation are specified | Revocation works; survivor audit visible |

## Implementation notes

- Reuse existing journal/evidence entry paths and chronology components where possible.
- Keep prompts as a reviewed constant list (not a model call) in the first slice.
- Existing onboarding remains the safety/consent gate; this flow begins after it.
- Parallel professional signal can be gathered with the existing `/demo` chronology or manually organized examples without building new sharing.

## Open questions

- Exact fixed prompt copy (to be reviewed for trauma-informed language).
- Whether the first entry lives in journal, evidence, or a unified capture surface.
- Measurement of drop-off at prompts.

---
*This document supersedes earlier high-level drafts. It locks the next build slice to fixed prompts and survivor-safety validation before generative Coach or expanded sharing.*
