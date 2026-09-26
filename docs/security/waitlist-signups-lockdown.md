# waitlist_signups lockdown (Lovable Publish / Guardian)

**Status:** PR only — **needs Guardian CLEAR before apply** to any shared Supabase project.

## Why

- Live `https://pattern-proof.tech/waitlist` returns **404**; no `src/routes/*waitlist*` route remains.
- No client code inserts into `waitlist_signups` (only generated types + stale sitemap entry).
- Lovable security scan flags open INSERT RLS: *Anyone can add any record to waitlist_signups*.
- Public lead capture already uses `marketing_leads` via server functions.

## Change

Migration `20260924100000_lock_down_waitlist_signups.sql`:

1. `DROP POLICY` `"Anyone can join the waitlist"`.
2. `REVOKE ALL` on `waitlist_signups` from `anon` and `authenticated`.
3. Re-`GRANT SELECT` to `authenticated` (admin-only SELECT policy still applies).
4. Keep `service_role` `ALL` and the existing validation trigger for any future ops inserts.

App: remove `/waitlist` from `sitemap.xml` entries.

## Soft claims (not absolute)

- Closes anonymous write surface on this table **after** migration is applied.
- Does **not** rotate secrets, clear PINs, or rewrite historical rows.
- Residual risk until apply: open INSERT remains live; spam remains possible.
- Residual after apply: `service_role` / compromised server credentials can still write; admin SELECT policy depends on `private.has_role`.

## Relation to #99

PR #99 keeps anon INSERT on `waitlist_signups`. This change supersedes that keep-list entry for waitlist only. If both merge, apply order: #99 then this migration (or rebase #99 to drop waitlist from keep-INSERT list).

## Lovable Publish note

This Info finding alone may not be the same class as a hard build failure. After merge + Guardian CLEAR + migration apply, re-run Lovable security check / Publish. Also confirm host secrets still provide `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, and `VITE_SUPABASE_PUBLISHABLE_KEY` (required since #106 fail-closed builds).
