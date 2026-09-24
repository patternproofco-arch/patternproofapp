# guideChat auth + support rate limits

**Status:** PR only — merge **BLOCK** until `@Guardian` CLEAR of the diff.

## Product decision (Guide)

`GuideHelper` lives in `AppShell` under `/_authenticated` (survivor portal).
Guide is **post-login only** in the UI, so `guideChat` **requires**
`requireSupabaseAuth` (not public + rate-limit-only).

## Changes

1. Migration `20260924161000_guide_chat_support_rate_limit_columns.sql`
   - `ai_chat_requests.ip_hash` (+ index)
   - `support_requests.ip_hash` (+ indexes on ip_hash and reply_email)
2. `src/lib/guide-chat.functions.ts`
   - `requireSupabaseAuth`
   - per-user + per-IP counters via `ai_chat_requests` (no message contents stored)
   - fail closed if `ai_chat_requests` insert returns `{ error }` — soft busy
     reply, no Lovable / `LOVABLE_API_KEY` spend
3. `src/lib/support.functions.ts`
   - stays public (intentional for login/billing help)
   - IP + reply-email throttles
   - optional session `user_id` via existing `resolveCallerUserId`

## Soft claims only

- Reduces unauthenticated spend of `LOVABLE_API_KEY` via Guide and scripted
  support spam surface after apply.
- Does **not** claim absolute security.
