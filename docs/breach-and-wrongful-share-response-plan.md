# Breach & wrongful-share response plan

Required before any attorney verification or 180-day cutoff system goes live
against real survivor data (see `docs/portal-certification-report.md` for the
same "before real data" bar applied to other launch-readiness items). This is
the internal runbook — who gets told, how fast, and how the notification
itself is done safely for a DV survivor.

## Two trigger conditions

1. **Breach** — survivor data reached someone who was never authorized: a
   suspended/declined attorney's access wasn't actually cut off, a case grant
   went to the wrong colleague, an export left the system unencrypted, or an
   account was compromised.
2. **Wrongly granted share** — the system worked as built, but access was
   granted to the wrong person: a survivor invited the wrong attorney, an
   attorney verification was approved in error, or a case grant crossed to
   the wrong client.

Both start the same clock. A wrongful share is not a lesser event just
because no external attacker was involved — the survivor's safety exposure
can be identical or worse (a known abuser's attorney, a shared address).

## Timeline

- **0–1 hour: contain.** Revoke the access immediately — `revokeLink`,
  `reviewAttorney` with decision `suspended`, or a direct
  `attorney_client_links` status update if the normal path is itself
  compromised. Confirm containment by re-running the exact access check that
  failed (the same `assertLink`/`assertCaseAccess` call), not by assumption.
- **Within 4 hours: assess.** What was exposed (which tables, which
  survivor(s), address/location fields specifically — those are the highest
  safety risk), how it happened, and whether it's ongoing. Pull the relevant
  rows from `attorney_verification_decisions`, `attorney_access_confirmations`,
  `audit_events`, and `share_link_access_log` — these are the "who did what,
  when" records this system now keeps for exactly this purpose.
- **Within 24 hours: notify affected survivors.** In-app only, by default —
  matching the standing rule that survivor-facing notices never go by email
  or SMS, because an email/SMS channel can itself be watched by an abuser.
  If in-app cannot reach her in time (account inactive, urgent physical
  safety risk), the advocate/org relationship on file is the fallback
  contact path, never a raw email/SMS from PatternProof to the survivor
  about the breach itself.
- **Within 72 hours (or sooner where law requires): assess legal notification
  duty.** State breach-notification laws (most relevant: New Jersey's, given
  the attorney bar-verification scope) and, if legal services data is
  implicated, professional-conduct disclosure obligations. This is the NJ
  ethics attorney review's job, not an engineering decision — loop them in at
  hour 4, not after this step.

## What "notify the survivor" means here

- Plain language: what happened, what PatternProof did about it, what she
  might want to consider (e.g., "an attorney you shared with had their
  access suspended for X — nothing else in your account changed").
- Never re-expose the thing that leaked in the notification itself (don't
  quote her address back to her in a push notification that could be seen
  over her shoulder).
- Offer a real next step every time: revoke additional shares, rotate
  password, talk to an advocate — not just "we're aware."

## Internal escalation

- Engineering on call contains and assesses.
- Founder/product owner is told within the first hour of a confirmed breach
  (not a suspected one that turns out to be a false alarm) — no batching
  into a weekly update.
- The NJ ethics attorney is looped in within 4 hours for anything touching
  attorney conduct, staff-seat access, or an export (RPC 1.6 confidentiality,
  RPC 5.3 supervision — see the ethics review note below).
- A written incident summary is filed in this repo's `docs/` once contained,
  even for a near-miss with no confirmed exposure — the point is to have a
  record, not just a memory.

## What this system already gives the response team

- `attorney_verification_decisions` — every verify/decline/suspend, who
  decided it and on what evidence.
- `attorney_access_confirmations` — every "still on this case" and "keep
  access going" action, who and when.
- `share_link_access_log` (survivor-visible via `listMyShareLinkAccessLog`)
  and `audit_events` (survivor-visible via `listMyAccessAudit`) — every
  access attempt against a share, successful or not.

None of this replaces judgment during an actual incident. It exists so the
first hour is spent containing and assessing instead of reconstructing what
happened from scratch.
