# Paper & Ink — signed-in shells

Tokens: paper `#f4f1ea`, ink `#1a1916`, hairline `#d4cfc4`, radius `3px`, no drop shadow.

Applied on:
- marketing (`.folio-page`)
- survivor (`AppShell` / `.pp-app-shell`)
- attorney (`.att-root`)
- advocate (`.pp-portal-shell`)

Walkthrough notes:
- `/choose-role` redirects to `/how-it-works`.
- Magic review: `/attorney/:token` and `/review/:token`.
- `/contribute` is auth-only; not linked from public pricing.
- Attorney portal still paywalls non-billing routes until a seat is active — expected.
- Advocate with no profile is sent to `/advocate-setup` — expected.
- `/capture` does not yet persist audio into the vault after signup.
- `/demo` still has its own rail; `DEMO_BEADS` + `ChronologyThread` are ready to drop in.
