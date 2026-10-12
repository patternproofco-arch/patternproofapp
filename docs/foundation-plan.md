# Record and workspace foundation

## Revised brief

PatternProof should help a person save and understand their own record without requiring a legal category, a complete date, an attachment, or a decision to pursue court action. Its starting choices are **Save something**, **Review my record**, and **Get ready to share**.

A stored file is a preserved upload, not proof that it is the original communication. Sources, survivor accounts, software suggestions, professional working notes, and dated hearing selections have different owners and purposes. Professionals may ask questions and propose corrections; they do not replace the survivor's words. Unreviewed software output cannot become a confirmed account or enter an export.

Saving, processing with an outside provider, disclosing to a recipient, and exporting are separate actions. An upload must not automatically transmit material to AI. AI processing stays disabled until a host administrator records completion of a provider-policy review. Enabling that switch is not consent, a compliance certification, or permission to infer credibility, intent, abuse diagnoses, or admissibility. Manual saving and review must continue to work.

Sharing requires a named recipient, a bounded selection, a purpose, an expiration decision, and an explanation of copy/download limits. A professional invitation does not authorize future uploads, attachments, substantive revisions, staff successors, or administrators. An unavailable item and a request for help are legitimate responses to a professional request, separate from declining or submitting evidence. A failed submission must not leave files newly disclosed.

Hearing preparation starts with jurisdiction, hearing type, requested orders, deadlines, source context and contrary information. **Selected**, **Exported**, **Filed or served**, and **Admitted** describe different facts; software must not promote one into another. Prior outputs and corrections need their own history.

## Repository assessment and implementation sequence

| Area                  | Existing foundation                                                                        | Work in this change / release gate                                                                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private saving        | Verified preservation receipts, uncertain dates, private account drafts, upload retry keys | Three starting choices; remove automatic AI processing from single and batch uploads; truthful save text                                                                                                                                                                                                              |
| Sources and accounts  | Evidence rows, incidents, many-to-many source links, separate proposed incidents           | Preserve prior incident accounts in owner-only revision history; surface history during correction                                                                                                                                                                                                                    |
| AI                    | Manual review screens and unconfirmed proposals                                            | Default-off server policy gate for all external AI gateway calls, narrow extraction instructions, no automatic provider transfer on upload                                                                                                                                                                            |
| Professional requests | Separate private response drafts and explicit submission                                   | Atomic file-disclosure/response operation; validate expiry, revocation and every selected file; explicit unavailable and help outcomes                                                                                                                                                                                |
| Sharing               | Exact-selection previews, expiry/revocation checks, separate attorney notes                | Preserve existing regression tests. Block substantive corrections while active links, pending invitations, legacy tokens or case scopes disclose the record. End those disclosures before correction, or add a separate private correction. Historical recipient snapshots are a future alternative, not claimed here |
| Hearing output        | Frozen exhibit numbering, changed-source output gates, jurisdiction/study profile          | Exclude unconfirmed incident rows and fail on incomplete reads in survivor PDF export; preserve uncertainty labels                                                                                                                                                                                                    |
| Organizations         | Separate advocate portal, consent-dependent admin visibility, grant reporting              | No expansion of administrative access. Program release forms, staff reassignment authorization, and small-cell reporting policy need program-specific review                                                                                                                                                          |
| Operations            | App lock, quick exit, account deletion procedure                                           | Retention/preservation conflicts, backups, company closure, safe recovery, child accounts and provider obligations require named policy owners before real-data rollout                                                                                                                                               |

Implement and test the code changes above in that order. Do not apply migrations to a production project as part of this change. Apply them in staging before deploying code that calls the new RPC or reads revision history.

## Acceptance checks

- A file saves without an AI request, legal classification, or a known event date; interrupted storage is reported separately from successful preservation.
- The AI gateway makes no network request by default. Only the explicit host policy switch enables it. Upload still does not invoke it automatically when enabled.
- A request response accepts only the survivor's own nondeleted selected files and a currently active, unrevoked, unexpired link. Failure rolls back both the scope and the answer. Concurrent submissions retain both deliberate selections.
- Draft answers, including a draft left behind when asking for help, are not visible to the professional. Help and unavailable responses disclose no files.
- A correction stores the previous account within the same database transaction. Another survivor and any professional cannot read or mutate that history.
- PDF export excludes unconfirmed software accounts, stops on failed/paginated reads, preserves uncertain dates, and includes no professional notes.
- Reuse fictional cross-account, expired/revoked-recipient, professional-note, interrupted-upload, changed-package and organization-visibility tests. Browser-check the three starting choices at desktop and mobile viewport sizes. An emulated mobile viewport is not an actual-phone accessibility test.

## Rollout and external decisions

1. Apply and exercise the migrations on staging, including existing grants and direct database clients. Deploy compatible code only afterward.
2. Keep `PATTERNPROOF_AI_POLICY_APPROVED` unset/false until a documented review covers provider access, retention, training, subprocessors, deletion, and applicable program obligations. Approval does not replace informed user choice or an organizational release.
3. Do not describe the complete original brief as shipped: historical recipient snapshots, formal program releases, hearing-specific filing/admission tracking, redaction review, small-group reporting controls and operational policies require further implementation/review before those capabilities can be claimed.
4. Test an actual phone and assistive technology with fictional data before real survivor evidence is used.

## Guidance supplied with the brief

These are references for professional/policy review, not a claim of independently verified current legal requirements or universal applicability:

- [NNEDV Safety Net: databases and confidentiality](https://www.techsafety.org/databases-and-confidentiality)
- [NNEDV Safety Net: VAWA/FVPSA confidentiality](https://www.techsafety.org/confidentiality-in-vawa-fvpsa)
- [New Jersey evidence rules](https://www.njcourts.gov/sites/default/files/evidence1.pdf)
- [California hearing preparation](https://www.selfhelp.courts.ca.gov/DV-restraining-order/prepare-court-date)

## Verification performed

- Full Vitest suite: 105 files, 1,081 tests passed. New checks exercise upload interruption and preservation retries, omitted receipts, default-off vendor transfer, recording without remote speech recognition, request outcomes, and export filtering/pagination/failures.
- PostgreSQL 17 in an isolated, temporary Docker container: both migrations applied to a fictional schema; ownership, private drafts, revision immutability, rollback after a forced failure, invalid selections, revoked/expired recipients, every supported disclosure family, concurrent response scope merging, and concurrent disclosure/correction checks passed. Run `bash scripts/qa/foundation-db.sh`. This supplements, and does not replace, applying the complete migration chain and checking existing grants on staging.
- Playwright with fictional sessions: all three dashboard actions navigated successfully on desktop Chromium and an emulated Android viewport (six checks). The tests exposed and verified the fix for a focus control that previously shifted links between pointer-down and pointer-up.
- TypeScript checking and the production build passed. Targeted lint errors were corrected; existing hook/type and Fast Refresh warnings remain.
- No production records were accessed or migrated. Actual-phone and assistive-technology checks and the policy decisions above remain release requirements.
