# California launch readiness

Decision: HOLD for real survivor data. This is a targeted source and schema review, not whole product certification or legal clearance.

Reviewed October 5, 2026. Initial source baseline: f1723b9f on patternproofco-arch/patternproofapp. Reconciled with main through 6d381439, including PRs 154, 180, 182 and 183. Lovable reports 6d381439 as its latest project commit; that is not confirmation of the published deployment commit.

## Environment correction

The first metadata queries targeted `obljoemiijkryjlxihic`, the old `supabase/config.toml` target. Those findings did not describe the database attached to the published app. Earlier references to that metadata as production evidence were incorrect.

The approved auth issuer is `muynotmkcmehxnkhffzl`, as recorded by the MCP manifest and credential configuration test. Read only queries through the authenticated Lovable connector for published project `f496a23a-1a8f-408f-b5e0-e96d5947d49c` confirmed that its attached database already has the document extraction, AI permission and sealing fields, plus the two admin OAuth RPCs. This removes the claimed missing schema blocker for that project. The CLI target is corrected in this candidate. No migration should be applied merely because the old project was missing fields.

Only catalog metadata, function definitions, policies and bucket configuration were read. No survivor rows were accessed. Neither metadata inspection nor Lovable's published flag proves working runtime authorization.

## Changes prepared

1. Document OCR requires a separate unchecked action naming OpenAI and Lovable. The server checks explicit consent, ownership, sealing and the known permission state. Ordinary document extraction remains local to the application where supported.
2. Runtime AI is paused by default at every inspected gateway call and the shared SDK provider. Provider review alone cannot enable it. Only four named paths with added consent controls can be explicitly enabled after review; other AI paths cannot be enabled through environment configuration. All flags remain off by default.
3. Screenshot, call photo and recording transcription endpoints require literal request consent. Storage processing checks ownership and exact configured storage origin; redirects are rejected on the updated reads. The release gate is separate from consent and ownership.
4. Google Analytics and Leave a Dot are no longer mounted in the shared root. The prior public route filtering did not prove previously executed scripts could not observe later private navigation.
5. Connected apps use Supabase Auth's session bound grant APIs, which revoke sessions and refresh tokens as well as consent. Load failures display an unknown state, not an empty list. Revocation copy explains existing token lifetime and retained copies.
6. New OAuth approval through the app and all four MCP tools are paused. This does not itself block already issued tokens from Supabase's direct APIs; see the release blocker below.
7. Sharing expiry denies malformed dates and the exact expiry boundary. AI transparency no longer promises uniform review or full provenance and explains the pause.
8. The additive, idempotent extraction migration is retained as schema reconciliation for environments missing these fields, not a demonstrated live requirement. Existing values are preserved; no policies or grants are widened.

These are candidate changes, not deployed controls. The document checks are not a global sealing mechanism or proof of a court sealing order. Pausing AI also makes AI assisted features unavailable; manual workflows still require deployed testing.

## Observed AI scope

All listed model identifiers are strings requested by the source through Lovable's AI Gateway. They are not proof of model availability, response identity, fixed versions, provider contracts, training exclusions or retention settings. No custom trained model or synthetic image, video or audio generation endpoint was found in the inspected routes. This is evidence for a legal scope review, not a determination that PatternProof is outside CATA.

| Feature | Source | Inputs and derived output | Requested provider |
| --- | --- | --- | --- |
| Document text recognition | src/lib/document-extract.functions.ts | Uploaded scan or photo becomes unverified text; local PDF, Word and text extraction is attempted first | OpenAI, gpt-6-astra |
| Evidence transcription | src/lib/transcribe-evidence.functions.ts | Audio or video becomes a transcript | OpenAI, gpt-4o-transcribe |
| Voice notes and short recordings | src/lib/transcribe-voice-note.functions.ts; transcribe-recording.functions.ts | Audio becomes text | Google, gemini-2.5-flash; gemini-3.5-transcribe |
| Message thread reading | src/lib/message-threads.functions.ts | Screenshots, call logs and recordings become text records | Google, gemini-2.5-flash; OpenAI, gpt-4o-transcribe |
| Image, memory, transcript, legal document and journal extraction | src/lib/extract-incident.functions.ts; extract-memory.functions.ts; extract-from-transcript.functions.ts; legal-extract.functions.ts; extract-journal-page.functions.ts | User material becomes structured draft text | Google, gemini-2.5-pro |
| Timeline proposals | src/lib/propose-timeline.functions.ts | Evidence and context become suggested entries | Google, gemini-2.5-pro |
| Content classification | src/lib/evidence-classification.functions.ts | Titles, filenames, MIME and descriptions become proposed categories | Google, gemini-3.6-flash |
| Pattern analysis | src/lib/pattern-analysis.functions.ts | Records become generated analysis | Google, gemini-2.5-pro |
| Chat and support | src/lib/ai-chat.functions.ts; guide-chat.functions.ts; src/routes/api/chat.ts | Messages and supplied context become responses | Google, gemini-3-flash-preview |
| Accidental recording check | src/lib/accidental-check.functions.ts | Transcript becomes a classification | Google, gemini-3-flash-preview |
| Attorney workflow | src/lib/attorney-portal.functions.ts | Supplied case context becomes text | Google, gemini-2.5-flash |

The inspected code performs application orchestration and prompting. Whether this makes the company a covered provider or a third party licensee needs a review of the actual service and agreements. Text output is not itself generated audio, video or imagery merely because the input was media.

## California applicability record

| Topic | Verified source and status | Product consequence and open decision |
| --- | --- | --- |
| SB 1000 / CATA | Signed September 30, 2026; urgency statute effective immediately. Removes the provider user threshold. [Chaptered text](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB1000) | Counsel should assess provider versus licensee status using the inventory and gateway agreement. The media disclosure provisions do not automatically impose media watermarking on text summaries. Do not claim an assistive technology exemption based on survivor centered positioning. |
| SB 574 | Signed September 30, 2026. No urgency or alternate effective provision in reviewed text; January 1, 2027 follows the ordinary constitutional rule. [Chaptered text](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB574), [Constitution Article IV section 8](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CONS&sectionNum=SEC.%208.&article=IV) | Attorneys need confidentiality safeguards, output verification and court disclosure. A survivor confirmation button does not discharge attorney duties. Obtain the gateway processing terms and document who can access client material. |
| AB 2713 | Signed September 30, 2026; large platform provisions operative January 1, 2027. [Chaptered text](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260AB2713) | Do not assume large platform status or exemption without usage data. Preservation of provenance is independently useful; location safety must be considered before exporting metadata. |
| CalOPPA | Existing law, broader than CCPA business thresholds. [California DOJ explanation](https://oag.ca.gov/privacy/facts/online-privacy/privacy-policy), [DOJ policy guidance](https://oag.ca.gov/sites/all/files/agweb/pdfs/cybersecurity/making_your_privacy_practices_public.pdf) | Finish factual policy review: collection, recipients, choices, changes, effective date and tracking disclosure must match deployed behavior. Current text does not establish this review. |
| CCPA | Existing law with scope thresholds and additional service provider obligations. [CPPA FAQ](https://cppa.ca.gov/faq), [current monetary threshold](https://cppa.ca.gov/regulations/cpi_adjustment.html) | Need revenue, California consumer/household counts, sale/sharing practices and partner contract roles. Small size alone is not a complete applicability decision. |

The earlier briefing's phrase "prelaunch requirement" described a recommended applicability review, not an established determination that CATA applies to PatternProof.

## Release blockers and smallest closure evidence

| Blocker | Evidence | Closure evidence |
| --- | --- | --- |
| Deployed release identity is unproven | Lovable latest project commit matches main 6d381439; published commit was not returned | Match the published build and database target to the reviewed release, then run synthetic browser and direct API checks. |
| External script isolation | Candidate removes analytics and feedback loaders from the shared document | Verify a clean browser and public to private navigation have no analytics or widget requests or retained listeners in the deployed candidate. |
| AI confidentiality terms are unverified | Gateway calls are confirmed; executed processing agreements and actual retention settings were unavailable | Keep runtime AI paused until provider terms, training use, human access, retention, deletion and incident duties are recorded. Test any explicitly enabled path with synthetic inputs. |
| Existing OAuth tokens may bypass the app pause | Live evidence and incident policies check `auth.uid()` ownership; inspected policy expressions contain no `client_id` restriction. OAuth scopes do not limit Supabase database access. Current admin revoke RPC only updates consent; it does not delete sessions | Confirm issued token/session inventory without disclosing credentials. Implement and test OAuth restrictions across RLS, storage, security definer RPCs and service role backed app routes, or disable OAuth issuance and revoke existing grants with verified expiry. Pausing MCP and the approval screen alone is insufficient. |
| Professional verification and suspension | PR 94 remains unmerged. The attached database metadata did not show professional verification or suspension columns. This is supporting evidence, not exhaustive proof of absent controls | Finish and reconcile the professional access work. Test survivor A/B, attorney and advocate accounts for cross account denial, verification, suspension, scoped sharing, exact expiry, revocation and exports. Include previously signed URLs and downloaded copies in limits. |
| Secret scan history gate is red | PR's current tree secret scan passed; history job failed. Existing remediation inventory identifies public client keys and identifiers but does not establish exposure of live privileged credentials | Review the redacted historical findings, classify keys, document any necessary rotation and complete the repository gate. Do not call all hits secret leaks or rewrite history without coordinated review. |
| Original preservation needs a full round trip | Ingest hashes uploaded bytes; BatchDropzone can strip EXIF before ingest. A hash therefore proves the submitted bytes, not necessarily the original device file | Compare download hashes with upload bytes. Label privacy processed copies accurately, keep originals only with informed safe storage choices, test metadata preservation without exposing GPS to recipients. |
| Legal and policy scope remains open | AI statutes, CalOPPA, CCPA and partner roles are distinct | Complete the narrow applicability review using this inventory and actual contracts, then align launch claims and privacy terms. Do not promise court admissibility, privilege, California certification or complete provenance. |

## Verification and decision rules

Record exact commit, migration state and environment for release evidence. Tests using mocked storage or an embedded database do not prove production policy enforcement. No live migration, merge, publication, email or outreach was performed in this work.

The California launch remains on hold until the blocking rows above have evidence or the affected features are demonstrably unavailable on the server. A marketing page change alone is not a release control. A proposed limited beta would need an explicit feature scope and the same data access protections.

## Local verification results

After reconciliation with main 6d381439: all 986 tests passed across 99 files, TypeScript passed, the production bundle built successfully, and the diff whitespace check passed. New tests cover default AI denial, the fixed provider destination, SDK bypass denial, thread request consent, storage ownership and URL restrictions, OAuth grant errors, revocation messaging and MCP pause. These local tests are not deployed user journey or live RLS tests. The previous targeted extraction migration exercise passed in embedded PostgreSQL with synthetic rows: defaults, repeated application, preserved denied/sealed values and extraction writes. This was not a live migration.

Read only metadata from the database attached to the published Lovable project confirms all five listed buckets are private and no public ordinary table has RLS disabled. The admin OAuth RPCs are executable by service role, not anon or authenticated roles. These checks do not prove policy effectiveness, immediate revocation or runtime professional suspension.

## Auth sources

[Supabase grant revocation](https://supabase.com/docs/reference/javascript/oauth-server-revokegrant) documents consent, active OAuth session and refresh token revocation. [OAuth token security](https://supabase.com/docs/guides/auth/oauth-server/token-security) documents the `client_id` claim and explains that OIDC scopes do not control database access. Remaining access token behavior must be tested against this deployment.
