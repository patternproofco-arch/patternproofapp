# Honour share expiry in RLS (`has_attorney_access`)

**Status:** PR only — merge/apply **BLOCK** until `@Guardian` CLEAR of the diff.

## Problem (soft claim)

`private.has_attorney_access` previously returned true for `status = 'active'`
without checking `expires_at`. App server paths in
`src/lib/attorney-access.server.ts` already treat an expired window as revoked.
Direct PostgREST / RLS paths that call the helper (or firm/org peer SELECTs)
could diverge from that fail-closed behaviour.

## Change

Migration `20260924160000_honour_share_expiry_has_attorney_access.sql`:

1. `private.has_attorney_access` — `status = 'active'` **and**
   `revoked_at IS NULL` **and** `(expires_at IS NULL OR expires_at > now())`.
   Peer SELECT policies already required `revoked_at IS NULL`; the helper
   must fail closed on the same half-state.
2. Policy `Firm colleagues read firm client links` — same expiry clause.
3. Policy `Org colleagues read org client links` — same (column exists on
   `advocate_client_links`).

Policies that already call `private.has_attorney_access` inherit the fix.

## Follow-up (accepted)

Inline message policies that bypass `private.has_attorney_access` are out of
scope for this change; track separately if Guardian wants them aligned.

## Soft claims only

- Reduces the chance that an expired-but-still-`active` share is readable via
  RLS after apply.
- Does **not** claim absolute security, does not rotate secrets, does not
  rewrite historical rows.

## Apply

After Guardian CLEAR: apply migration via Supabase migration pipeline, then
re-check Lovable / access-control findings.
