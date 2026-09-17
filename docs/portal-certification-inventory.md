# Portal Certification — Interaction Inventory

Generated from the codebase on the certification pass. One row per route file
under `src/routes`. "Forms" counts `onSubmit` handlers, "Upload" flags a file
input on the page, "Primary controls" lists literal button and link labels
found in the route file (truncated to 12 per route).

| Route | Portal | Forms | Upload | Primary controls |
| --- | --- | --- | --- | --- |
| `/.lovable/oauth/consent` | Public | 0 | no | decide(false)} > Deny |
| `(no route)` | Public | 0 | no | → Go home |
| `/_advocate` | Advocate/Org | 0 | no | →  |
| `/_advocate/advocate-cases/$clientId` | Advocate/Org | 0 | no | ; → Back to cases |
| `/_advocate/advocate-cases/` | Advocate/Org | 1 | no | setOpen(false)} style={btn(t.muted, false)}>; ; → Refresh your list |
| `/_advocate/advocate-setup` | Advocate/Org | 1 | no | {busy ? "Saving…" : "Open my cases"} |
| `/_attorney` | Attorney | 0 | no | →  |
| `/_attorney/attorney-feedback` | Attorney | 1 | no | {saving ? "Sending…" : "Submit feedback"} |
| `/_attorney/billing-return` | Attorney | 0 | no | → Go to clients |
| `/_attorney/billing` | Attorney | 0 | no | ; On this plan; Switch in Stripe; {busy ? "Working…" : "Disconnect"}; {busy ? "Opening Clio…" : "Connect Clio"}; Unavailable; → Choose a plan; → Start {t.name} |
| `/_attorney/caseload` | Attorney | 0 | no | →  |
| `/_attorney/clients/$clientId` | Attorney | 1 | no | ; window.print()}>; open(e.id)} >; {saving ? "Saving…" : "Add entry"}; Save; startEdit(r)}> Edit; Add; → Subscribe — $297/mo; → ; → Settings |
| `/_attorney/clients/` | Attorney | 1 | yes | Preview pasted rows; ; setOpen(false)}>; → Client {c.client_user_id.slice(0, 8)}; → Open |
| `/_attorney/clients` | Attorney | 0 | no | — |
| `/_attorney/conflict-check` | Attorney | 1 | no | — |
| `/_attorney/setup` | Attorney | 1 | no | — |
| `/_attorney/subscribe` | Attorney | 0 | no | → Open case files |
| `/_attorney/team` | Attorney | 2 | no | Create firm team; Send invite; → Review Firm plan; → Manage seats &amp; billing |
| `/_attorney/trust` | Attorney | 0 | no | → Open the client list |
| `/_authenticated` | Survivor | 0 | no | — |
| `/_authenticated/access` | Survivor | 0 | no | → Review; → Share with an attorney; → Share with an advocate |
| `/_authenticated/admin/org-requests` | Survivor | 1 | no | {busy ? "Saving…" : "Approve"} |
| `/_authenticated/agent/$threadId` | Survivor | 1 | no | — |
| `/_authenticated/agent/` | Survivor | 0 | no | Try again |
| `/_authenticated/agent` | Survivor | 0 | no | — |
| `/_authenticated/attorney-billing` | Survivor | 0 | no | — |
| `/_authenticated/attorney-time-log` | Survivor | 0 | no | →  |
| `/_authenticated/calendar` | Survivor | 0 | no | — |
| `/_authenticated/case-builder` | Survivor | 0 | no | + Start a new case; Build Professional-Review Packet |
| `/_authenticated/case` | Survivor | 0 | no | → Share with attorney |
| `/_authenticated/communications` | Survivor | 0 | no | — |
| `/_authenticated/contribute-thanks` | Survivor | 0 | no | — |
| `/_authenticated/contribute` | Survivor | 0 | no | → Open court packet; → Open your packet |
| `/_authenticated/court-dates` | Survivor | 0 | no | Save; →  |
| `/_authenticated/court-packet` | Survivor | 0 | no | — |
| `/_authenticated/court-ready-thanks` | Survivor | 0 | no | — |
| `/_authenticated/court-ready` | Survivor | 0 | no | — |
| `/_authenticated/court-systems` | Survivor | 0 | no | → Open Recurline; → Build professional-review packet; → Share with attorney |
| `/_authenticated/dashboard` | Survivor | 0 | no | → ; → Open your Archive →; → Share how PatternProof is feeling for you |
| `/_authenticated/evidence-review` | Survivor | 0 | no | → Back to evidence |
| `/_authenticated/evidence` | Survivor | 1 | yes | {busy ? "Saving…" : "Add to Evidence"}; ✕; Cancel; ; → ; → Review it now |
| `/_authenticated/feedback` | Survivor | 1 | no | {saving ? "Sending…" : "Share with the team"}; →  |
| `/_authenticated/import-messages` | Survivor | 0 | yes | — |
| `/_authenticated/journal` | Survivor | 1 | yes | Cancel; →  |
| `/_authenticated/legal-documents` | Survivor | 0 | yes | ; Extract Information; Save This Document; Cancel; → Link to incident |
| `/_authenticated/live-recording` | Survivor | 0 | no | ; Discard; Save Recording; Delete |
| `/_authenticated/message-threads` | Survivor | 0 | yes | ; {recommended && ( |
| `/_authenticated/onboarding` | Survivor | 0 | no | — |
| `/_authenticated/opra-helper` | Survivor | 0 | no | — |
| `/_authenticated/patterns` | Survivor | 0 | no | call("unsure")}> Unsure; → Add a Mark |
| `/_authenticated/search` | Survivor | 0 | no | →  |
| `/_authenticated/settings` | Survivor | 0 | no | Save PIN; ; → Share feedback |
| `/_authenticated/share-with-advocate` | Survivor | 0 | no | {busy ? "Creating…" : "Create invite link"} |
| `/_authenticated/share-with-attorney` | Survivor | 0 | no | ; → ; → Add them in Case Builder |
| `/_authenticated/timeline` | Survivor | 0 | no | → Open the conversation → |
| `/_authenticated/voice-notes` | Survivor | 0 | no | {recording ?; {busy ? "Saving…" : "Save Voice Note"} |
| `/accept-invite/$token` | Public | 1 | no | — |
| `/advocate-invite/$token` | Public | 0 | no | — |
| `/advocate-survivor-invite/$token` | Public | 1 | no | Finish the welcome step; ; Decline — grant no access |
| `/ai-transparency` | Public | 0 | no | — |
| `/attorney/$token` | Public | 0 | no | — |
| `/attorneys` | Public | 0 | no | — |
| `/choose-role` | Public | 0 | no | → {label}; → ← PatternProof; → Not sure yet? See how it works first → |
| `/collaborator-invite/$token` | Public | 1 | no | — |
| `/connect` | Public | 0 | no | → Sign in to Connected apps; → Home |
| `/demo` | Public | 0 | no | → ; → Start your own case →; → start documenting |
| `/evidence-integrity` | Public | 0 | no | — |
| `/family-law-workload` | Public | 0 | no | → ; → Review the fictional example |
| `/for-attorneys` | Public | 0 | no | → View the Attorney Demo →; → Compare attorney plans →; → Request access →; → ← PatternProof; → How it works; → Request access; → PRIVACY; → SAFETY; → TERMS |
| `/for-organizations` | Public | 0 | no | → Request access →; → How PatternProof handles data privacy →; → ← PatternProof; → How it works; → PRIVACY; → SAFETY; → TERMS |
| `/how-it-works` | Public | 0 | no | {label}; → {label}; → ← PatternProof; → PRIVACY; → SAFETY; → TERMS |
| `/` | Public | 0 | no | → Try the demo →; → Not an attorney? See all options; → Create My Free Account; → Learn more; → Privacy; → Safety; → Support; → How it works; → Resources; → Terms; → For attorneys; → For organizations |
| `/lawyer-signup` | Public | 2 | no | {busy ? "One moment…" : "Sign in"}; {busy ? "Saving…" : "Enter portal"}; → Request access |
| `/login` | Public | 0 | no | — |
| `/org-feedback` | Public | 1 | no | {saving ? "Sending…" : "Send feedback"}; →  |
| `/org-portal` | Public | 0 | no | → Set up your organization →; → Back to PatternProof |
| `/org-signup` | Public | 2 | no | {busy ? "One moment…" : "Sign in"}; → Request access; → Ask about my verification |
| `/partner-access` | Public | 1 | no | {saving ? "Sending…" : "Send request"}; → Back to partner overview |
| `/pricing` | Public | 0 | no | → ; → Home; → Privacy Policy; → {tier.cta} |
| `/privacy` | Public | 0 | no | → ; → Pricing |
| `/professional-access` | Public | 0 | no | — |
| `/resources` | Public | 0 | no | → ← PatternProof; → {g.label} → |
| `/safety` | Public | 0 | no | — |
| `/self-help-guide` | Public | 0 | no | → ← PatternProof; → PRIVACY; → SAFETY; → TERMS; → {link.label} |
| `/signin` | Public | 0 | no | — |
| `/signup` | Public | 0 | no | — |
| `/support` | Public | 1 | no | {copied ?; → ; → Survivor Safety |
| `/survivor-invite/$token` | Public | 1 | no | — |
| `/team-invite` | Public | 0 | no | — |
| `/terms` | Public | 0 | no | →  |
| `/triage` | Public | 0 | no | — |
| `/unsubscribe` | Public | 0 | no | {busy ? "One moment…" : "Confirm unsubscribe"} |
| `/version` | Public | 0 | no | — |

## Evidence pipeline stages (code-verified)

| Stage | Implementation | Applies to |
| --- | --- | --- |
| Preserve original | `src/lib/evidence-ingest.functions.ts` (SHA-256 + dHash near-duplicate check), private `evidence-files` bucket | all uploads |
| Metadata extraction | `src/lib/evidence-enrichment.functions.ts` (EXIF/QuickTime dates, in-image timestamp text, quarantined GPS) | image, video, audio |
| Transcription | `src/lib/transcribe-evidence.functions.ts` (Lovable AI Gateway, "Speaker 1/2", unverified until confirmed) | audio, video |
| Screenshot message reading | `src/lib/message-import.functions.ts`, `src/routes/_authenticated/import-messages.tsx` | screenshots, screen recordings |
| Structured thread import | `src/lib/message-threads.functions.ts` (pdf/csv/excel/txt/rsmf/zip source types) | exported thread files |
| Draft proposal | `src/lib/propose-timeline.functions.ts` → `proposed_incidents` (pending) | all extracted content |
| Human decision | `acceptProposedIncident` / `denyProposedIncident`, `ProposedTimelineReview.tsx` | every draft |
| Chronology | `src/routes/_authenticated/timeline.tsx`, `src/lib/dates.ts` precision-aware ordering | confirmed records |
| Recurrence | `src/lib/frequency-observations.server.ts` (counts only, `phrase()` is the single wording point) | confirmed records |
| Source trace | `incident_evidence_links`, `source_evidence_ids`, evidence detail links | every derived item |

## Known format coverage

Accepted directly in Evidence: JPEG, PNG, WebP, HEIC/HEIF, PDF, TXT, DOCX,
MP3, MP4 audio, WAV, M4A, AAC, OGG, MP4, MOV, M4V, WebM.

Chat exports upload at `/message-threads`: CSV and TXT exports are parsed
deterministically into individual messages; PDF, Excel, RSMF and ZIP exports
are stored intact and marked "queued" (deep parsing not built), which the UI
states plainly.

Not currently ingested as text: PDF and DOCX evidence bodies are stored and
previewed but their text is not extracted into the drafting pipeline. There is
no `.eml` email import.
