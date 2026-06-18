# Calm down the post-signup experience

You're right — the "Is this device safe?" lesson belongs in signup only. Right now the dashboard also throws two more full-screen teaching modals on top of you after you're already in, and the dashboard itself is doing too much at once. This makes the app feel loud and lesson-heavy instead of calm.

## What to change

### 1. Stop the post-signup modal popups
- **`FirstTimeEducationModal`** — auto-opens on the dashboard the first time, with a "Welcome / 3 steps / Start documenting" sheet. Remove the auto-popup. The same content is already reachable from onboarding and the Court Systems page, so we don't lose it — it just stops ambushing you.
- **`WhyCourtsStruggleModal`** — auto-opens once you hit 10 incidents or 1 pattern. Remove the auto-popup. The full briefing lives at `/why-courts-struggle` and is linked from the dashboard cards and sidebar.
- Both components stay in the codebase in case we want to surface them as opt-in callouts later, but they no longer render on `/dashboard`.

### 2. Keep the "safe device" step where it belongs
- Onboarding step 1 ("Is this device safe?" → "My device is safe enough") stays exactly as is. It only runs during signup and never reappears.
- Verified there is no second "safe device" prompt elsewhere — the only other mention is a one-line tip on the Resources page, which is passive copy, not a button.

### 3. Quiet the dashboard
- Trim the header: drop the second italic line ("Deep breaths. You are in a safe space.") so the page opens with a single calm headline instead of a headline + affirmation + two giant CTAs.
- Collapse the two stacked hero CTAs (Agent + Log an incident) into a clearer hierarchy: **Log an incident** stays as the primary action; the Agent moves into the card grid as one of the equal-weight cards. One loud button, not two competing ones.
- Soften the Safety Checklist card so it reads as a quiet status, not a to-do list shouting at you (smaller eyebrow, no count badge if everything is already done).

### 4. Light audit pass on the rest
- Remove the live-recording "I understand, continue" gate from re-appearing every visit — show the warning inline above the record button instead of as a blocking screen, so you only confirm once per session.
- Scan other authenticated pages for similar "click to acknowledge" gates and remove any that repeat after the first acknowledgement.

## Files touched
- `src/routes/_authenticated/dashboard.tsx` — remove modal mounts, trim header, restructure CTAs, soften checklist card
- `src/routes/_authenticated/live-recording.tsx` — convert blocking warning to inline notice
- (No changes to onboarding, FirstTimeEducationModal, or WhyCourtsStruggleModal source — just unmounting them from the dashboard)

## What you'll feel
- Sign in → land on the dashboard → **no popup**, no overlay, no "click to continue."
- The safe-device question only ever appears during initial signup.
- The dashboard reads as one calm page with one clear next step, instead of three things asking for attention.
