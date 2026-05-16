## PatternProof Part 2 — Implementation Plan

This is a large addition on top of the existing 7-page foundation. I'll build it in coordinated phases so the app stays working at every step.

### Phase 1 — Database & storage
One migration adding:
- New tables: `audit_log`, `attorney_access`, `recordings`, `escalation_flags`, `opra_requests` (all with RLS = own rows only)
- New columns: `incidents.severity_level`, `incidents.has_escalation_flag`, `evidence.linked_recording_id`
- New private storage bucket: `conversation-recordings` with per-user RLS
- Enums for `attorney_type`, `access_level`, `opra_status`

### Phase 2 — Global safety shell
- `QuickExitButton` — fixed top-right on every authenticated page, double-Escape shortcut, clears history + redirects to user's exit URL (default weather.com)
- `PinLockProvider` — wraps authenticated area; PIN hash in localStorage, 60s (configurable) inactivity timeout, decoy PIN shows empty shell, 5-fail 30-min lockout
- `SettingsContext` for app disguise name, exit URL, session timeout, state
- Browser tab title follows disguise name

### Phase 3 — Onboarding flow
New `/onboarding` route gated before Dashboard: safety notice → PIN setup (real + decoy + trusted contact) → app disguise → state selection. Persisted to localStorage + a lightweight `user_settings` row.

### Phase 4 — Navigation additions
Add 6 new sidebar items below Court Packet: Live Recording, Escalation Detector, Attorney Portal, OPRA Helper, Resources, Settings.

### Phase 5 — New pages
- **Live Recording** — legal warning modal, MediaRecorder UI, Web Speech API transcription, recordings list separate from voice notes
- **Escalation Detector** — passive analysis of incidents with 3 severity tiers, pattern summary, resources panel, strict language rules
- **Attorney Portal** — Share My Case form + Shared Access list; generates access tokens (attorney login view is scoped for Part 3 — MVP shows the survivor-side management UI and read-only attorney view route)
- **OPRA Helper** — 3-step form generating NJ OPRA letter, save-to-evidence, appeals guide
- **Resources** — crisis panel + stage filter + hardcoded NJ + national resource cards
- **Settings** — 6 sections (App Disguise, Access Code, Quick Exit, Notifications, Data & Privacy w/ export+delete, Safety Notice)

### Phase 6 — AI Assistant sidekick
Floating chat bubble on Journal, Timeline, Case Builder only. Side panel (not modal). Uses **Lovable AI Gateway** via a TanStack server function — not the user's Anthropic key — with the exact system prompt provided, page context, and last 3 incident summaries.

### Phase 7 — Audit log
Server-side `logAudit` server function called from every mutation/view path. SHA-256 hash chain. Surfaces in Settings → My Activity (last 50, human language) and as Court Packet appendix.

### Phase 8 — Timeline + Court Packet evidence inline
Timeline shows evidence thumbnails per incident, microphone badge for recordings. Court Packet table includes evidence reference numbers matching the Evidence Index.

### Design fidelity
Every new page uses existing palette (#C99878 / #DEB896 / #4E3B31 / #E77B56 / #6A92D6 / #A8D8B9), Georgia serif headings, warm empty states, no purple/red, no shadcn defaults.

### Notes & confirmations
- **AI provider:** I'll wire the assistant to **Lovable AI** (`google/gemini-3-flash-preview` by default, system prompt verbatim). The original spec called the Anthropic API directly from the frontend, which would expose an API key in the browser — Lovable AI keeps the key server-side and is the recommended path on this stack. Say the word if you'd rather provide an Anthropic key and I'll switch.
- **Attorney external login:** The full separate attorney auth/portal app is a large addition. I'll ship the survivor-side share management + a read-only `/attorney/:token` route that resolves a share and renders the scoped view. Multi-tenant attorney accounts (their own login, multiple clients) can be a follow-up.
- **Server timestamps for recordings:** stored via server function so they're immutable.

Confirm and I'll build Phases 1–8 in order.
