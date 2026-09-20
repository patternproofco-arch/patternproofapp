# Password recovery walkthrough (fictional / founder-controlled only)

**Scope:** Prepare Verifier and Grace to exercise `/forgot-password` → recovery email → `/reset-password` without claiming a production survivor mailbox was walked.

**Do not** use real survivor emails. Use a **fictional** address or a **founder-controlled** inbox Grace explicitly owns for this check.

## Preconditions

1. Live or Preview build includes this PR (confirm `/version.json` shows a full 40-char SHA matching the published commit — not a stamp-file lag).
2. Supabase Auth recovery emails are enabled for the target environment.
3. Site URL / redirect allow-list includes `{origin}/reset-password` (and `?reason=recovery`).

## Exact steps (fictional or founder-controlled email)

1. Open `/signin` → **Forgot your password?** (or go directly to `/forgot-password`).
2. Enter the fictional/founder email. Submit **Send reset link**.
3. Expect the calm success screen: *Check your email* / *If that email has an account…*  
   - The UI must **not** say whether the address is registered (enumeration-safe).
4. Open the inbox for that controlled address.
5. Open the recovery link (should land on `/reset-password?reason=recovery` or via `/auth/callback` which forwards recovery to `/reset-password`).
6. Choose a new password (≥ 8 characters), confirm, submit **Save password**.
7. On validation errors (mismatch / too short / update failure), confirm a visible `role="alert"` banner (not muted toast-only copy).
8. After success, you should be routed into the role home (`/dashboard`, `/clients`, or advocate/org portal).

## Negative / calm-error checks

- Submit with network offline (or block the Auth host): expect `role="alert"` on `/forgot-password`, not an account-existence hint.
- Expired or reused recovery link: `/reset-password` shows *This link has expired* with a path back to `/forgot-password`.

## Status language

- Mark the walk **NOT VERIFIED** until Verifier/Grace completes it on Preview or live with a controlled address.
- Do **not** claim a production survivor email was used.
