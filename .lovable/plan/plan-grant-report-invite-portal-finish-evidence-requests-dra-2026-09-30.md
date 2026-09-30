# Plan: Grant report, invite portal finish, evidence requests, draft review tray

Several of these already partly exist. This plan builds on what is there rather than duplicating it, in the order you listed.

## What already exists
- Attorney invites a survivor by link (survivor-invite page) and the survivor chooses what to share (Share with attorney page, now item-level and private-by-default).
- Attorney can ask for documents (basic request list) and the organization has a follow-up list.
- An evidence review page and "proposed timeline" drafts exist for AI-extracted entries.

## 1. Organization grant report page
- New page in the organization/attorney portal: "Grant report".
- Pick a date range; shows counts only: people served, cases opened/closed, follow-ups made and completed, referrals, and average days to first follow-up.
- No names, no entry contents, no survivor details — aggregate numbers only, with small numbers (under 5) shown as "fewer than 5".
- Download as a printable page and a spreadsheet file.
- Neutral wording: "Documented entries", never severity or outcomes.

## 2. Invite portal (finish end to end)
- Attorney side: one "Invite a client" form (name, safe contact, optional note) with expiring single-use link and a list of pending/accepted/expired invites with resend and cancel.
- Survivor side: open link, create account (or sign in), then a step that lists their incidents and evidence with checkboxes — nothing pre-checked — then confirm.
- Same flow for advocates.

## 3. Structured evidence request engine
- Professional creates a request: title, what is needed (e.g. "files from previous court appearances"), optional due date, suggested type (document, photo, recording, note).
- Survivor sees a quiet "Requests" tray: can upload/answer, save as draft, submit, or decline with no reason required.
- Nothing is visible to the professional until the survivor presses Submit. Submitted items create a draft entry that the survivor must approve before it appears on the timeline.
- Professional sees status only: open, submitted, declined.

## 4. Draft review tray
- One tray listing every AI draft: voice/video transcripts and text read from photos and files.
- Each draft shows the source, the extracted text, suggested date (clearly labeled event / capture / upload time), and a suggested description.
- Survivor can edit, approve (adds to timeline, marked "User-reviewed"), or discard. Nothing reaches the timeline without approval.

## 5. Publish and verify
- Publish after the above build and tests pass.
- Live check with two test accounts: survivor shares only some entries; invited attorney confirms unshared entries, files, and counts do not appear anywhere in their portal.
- Note: this needs two real test accounts. The existing fictional QA accounts will be used unless you say otherwise.

## Technical details
- New tables: `evidence_requests` (professional_id, client_user_id, link_id, title, details, kind, due_at, status draft/open/submitted/declined) and `evidence_request_responses`; reuse `proposed_incidents` / `evidence_incident_drafts` for drafts. GRANTs + RLS scoped to client or linked professional; server functions via `requireSupabaseAuth`.
- Grant report: server function aggregating `org_follow_ups`, `advocate_client_links`, `referral_engagements` with org-member check; k-anonymity floor of 5.
- All professional reads keep the existing item-scope checks (`applyCaseScope`, `resolveAdvocateGrant`).
- Draft tray route under `_authenticated/drafts`; approve writes incident with `source = user_reviewed`.
