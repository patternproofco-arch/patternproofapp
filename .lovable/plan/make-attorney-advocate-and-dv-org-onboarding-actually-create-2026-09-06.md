# Make attorney, advocate and DV-org onboarding actually create real accounts

## What's happening today (verified against the live data)

- **Attorney** — the setup form *does* save the profile correctly. The account is then sent to pricing and blocked from the real client dashboard because there is no paid plan. The test attorney has the attorney role but no profile and no plan.
- **DV organization** — the organization signup form saves nothing at all: it always answers "new partner accounts require a verified invitation." So no organization, no membership and no advocate profile is ever created, and the organization portal shows "you are not a verified member of a partner organization."
- **Advocate** — an advocate profile is only ever created when an advocate accepts a survivor's invitation. There is no way for an advocate to fill in their own name and organization, so the portal header shows blank.
- **Survivor** — this one already works end to end; the test survivor simply has not completed the welcome steps yet.

## What I'll build

### 1. Organization signup creates a real organization
The organization form will create, in one step: the organization record, the person's advocate role, their advocate profile, owner-level membership of the organization, and their first referral code. They land in a working organization portal immediately instead of an error.

### 2. Advocate profile setup
A short advocate setup page (name, organization, work email, confidentiality acknowledgement), mirroring the attorney one. Any advocate who signs in without a completed profile is sent there first, then on to their cases. Advocates who arrive by accepting a survivor invitation keep working exactly as they do now.

### 3. 90-day trial for the first 9 attorneys
After finishing attorney setup, an attorney is granted a 90-day full-access trial — but only while fewer than 9 trials have been claimed. Attorney number 10 onward goes to pricing as today. The portal will treat an unexpired trial as active access, and show a clear "trial ends on <date>" line in the portal and on billing, with the pricing page reachable at any time.

### 4. Test accounts that aren't blocked
Once the above is in place, I'll set up the three QA accounts so each lands on its real dashboard:
- `test-attorney@patternproof.test` — attorney profile + a comped trial that doesn't consume one of the 9 public slots → `/clients`
- `test-dvorg@patternproof.test` — advocate profile, an organization and owner membership → `/org-portal`
- `test-survivor@patternproof.test` — welcome steps marked complete → `/dashboard`

I'll then sign in as each one in the preview and confirm what loads.

## Technical notes

- `setMyOrg` in `src/lib/org-portal.functions.ts` is rewritten to provision `dv_organizations` + `org_members` (owner) + `user_roles` (advocate) + `advocate_profiles` + a `referral_links` code, all under the service-role client, idempotent by user.
- New `completeAdvocateOnboarding` in `src/lib/advocate.functions.ts` and a `/_advocate/advocate-setup` route; `src/routes/_advocate.tsx` redirects when `advocate_profiles.onboarded` is not true.
- Migration: add `trial_started_at` / `trial_ends_at` to `attorney_profiles` (plus a comped flag so QA accounts don't burn a public slot), with the existing GRANT/RLS pattern.
- `completeAttorneyOnboarding` grants the trial inside a guarded count (`< 9` non-comped trials), mirroring how the charter-cohort cap is enforced today.
- `isAttorneyEntitled` in `src/lib/payments.functions.ts` and `useSubscription` treat an unexpired trial as active; the `_attorney` paywall redirect respects it.
- QA account rows are inserted as data, not schema.
- No survivor-facing changes, no pricing copy changes beyond the trial notice in the attorney portal.
