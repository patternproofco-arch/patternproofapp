# Reconciled verification gate (#94 + #96)

Status: open for Guardian + Verifier review. **Do not merge to prod.**
Owner: Builder executor. Soft claims only where marked.

## Founder locks absorbed

1. **Grandfather existing live attorneys → Verified = YES** (soft claim).
   - Migration sets `verification_status = 'verified'` + a 365-day
     `verification_expires_at` for previously-pending attorney profiles, and
     soft-verifies their bar jurisdiction rows (minting one from profile
     jurisdiction/bar_number when none exist).
   - **Soft claim:** grandfathered Verified is **not** a fresh bar re-check.
     It only prevents locking out accounts that already held live access.
   - **Hard rule preserved:** every **new** share still runs
     `assertAttorneyVerified` (profile + every jurisdiction live).

2. **Wire the 180-day attorney access cutoff cron = YES.**
   - Cloudflare Cron Trigger `15 13 * * *` → Nitro plugin
     `nitro-plugins/attorney-access-cutoff-cron.ts` →
     `runAttorneyAccessCutoffSweep`.
   - Same Nitro `cloudflare:scheduled` pattern as email-queue backstop (#88).
   - HTTP fallback: `POST /api/cron/attorney-access-cutoff` with
     header `x-cron-secret: $CRON_SECRET`.

## Single spine

- Base: #94 server-enforced Verified gate (DV orgs + attorneys), RLS
  hardening, survivor confirm, Clio locked until Verified, aggregates &lt;10,
  no signup enumeration (already on main via #93).
- Absorbed from #96: exact day-180 fail-closed engagement (query-time),
  150/165/175 reminders, day-173 in-app survivor notice, survivor
  keep-access tap, incident location redaction default-off, grandfather
  soft-claim, cutoff cron.

## Guardian bars preserved

| Bar | Where |
| --- | --- |
| Verified-only | `assertAttorneyVerified` / org equivalent on every share/read path |
| Payment ≠ Verified | payment helpers never set verification_status |
| Suspended → immediate cutoff + staff cascade | #94 SQL suspend RPCs + query-time Verified checks |
| Clio locked until Verified | `clio.functions.ts` calls `assertAttorneyVerified` |
| Survivor confirm | invitation confirm + grant trigger |
| Aggregates &lt;10 | `org-referral-privacy.ts` |
| No signup enumeration | AuthPage (main/#93) |
| Address redacted by default | `redactIncidentLocation` + `location_reveal_opt_in` default false |
| Query-time day-180 fail-closed | `isPastAccessCutoff` (>=) even if cron lags |
| Proof uploads never AI | unchanged; still NOT VERIFIED end-to-end |
| Grandfather migration | `20260920120000_attorney_access_cutoff_and_grandfather.sql` |

## Remaining NOT VERIFIED

- Full Supabase staging migration / RLS / storage / authenticated journeys
  (fictional credentials only).
- Private proof upload/review workflow + AI-isolation evidence.
- Non-attorney staff verification model (no fabricated bar credentials).
- Exhaustive service-role / bearer-link / OAuth / signed-URL audit vs Verified.
- Cloudflare Cron Trigger live invoke on a non-prod Worker (config is in-repo;
  runtime proof still outstanding).
- Playwright authenticated portal screens for review / renew / keep-access.

## Soft claim (explicit)

Grandfathered Verified ≠ re-verified. Treat grandfathered accounts as
provisionally Verified for access continuity only. New shares always
re-check Verified + jurisdictions.
