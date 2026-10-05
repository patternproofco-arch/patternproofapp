# California launch readiness

Decision: HOLD for real survivor data. This is a targeted source and schema review, not whole product certification or legal clearance.

Reviewed October 5, 2026. Source baseline: f1723b9f on patternproofco-arch/patternproofapp. The configured database project was matched against supabase/config.toml. Only schema metadata and storage configuration were queried. No survivor records were read. The deployed application commit has not been matched to this source baseline.

## Changes prepared

1. Ordinary document extraction cannot send scanned files to AI. A separate unchecked consent action names OpenAI and Lovable, explains the private data transfer, and must be repeated for another attempt. The server requires literal boolean consent, owner scope, an unsealed item, and the known `ask` permission state. Denied, missing and unknown permission states do not permit AI reading.
2. Sharing expiry denies malformed dates and the exact expiry boundary.
3. AI transparency copy no longer promises complete provenance or identical review controls for every output. It adds attorney verification, confidentiality and court disclosure guidance.
4. A migration adds the document fields missing from the configured database. `ask` is only eligibility to request permission, never permission to send. Existing values are preserved; no grants or policies are widened.

These changes do not establish consent across every AI feature. The document controls are not a global sealing mechanism or proof of a court sealing order. The migration and application changes have not been deployed.

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
| Source and live schema disagree | Production metadata has none of the extraction fields or `ai_permission` / `is_sealed` used by the route | Test the migration on a disposable database and staging, review it, deploy in coordination with this consent change, then verify the deployed synthetic document flow. Never bypass failed queries. |
| External script on sensitive pages | Baseline root shell loads Leave a Dot globally. Existing [PR 180](https://github.com/patternproofco-arch/patternproofapp/pull/180) addresses scope | Verify no script or retained listener can read private content after direct navigation or public to private SPA navigation. Removing a script element alone does not unload code already executed. Keep the widget disabled if that isolation cannot be shown. |
| AI confidentiality terms are unverified | Gateway calls are confirmed; executed account agreements and actual retention settings were not available in this review | Record applicable DPA, subprocessors, training use, human access, retention, deletion and incident duties for runtime requests. General provider policies are insufficient. |
| AI permission is not uniformly enforced | This patch covers document recognition; evidence transcription, signed URL extraction, classification and timeline routes still need end to end authorization and consent review | Synthetic tests must show denied material is never sent, direct endpoints cannot bypass the choice, and failures do not widen access. Disable unverified AI routes before a restricted beta. |
| Access and suspension need deployed proof | Private buckets and RLS enabled on public ordinary tables are verified metadata, not policy effectiveness | Use synthetic survivor A/B, attorney and advocate accounts to prove cross account denial, scoped sharing, revocation, exact expiry, suspension, verification and exports. Include retained signed URLs and already downloaded copies in the limits. |
| Original preservation needs a full round trip | Ingest hashes uploaded bytes; BatchDropzone can strip EXIF before ingest. A hash therefore proves the submitted bytes, not necessarily the original device file | Compare download hashes with upload bytes. Label privacy processed copies accurately, keep originals only with informed safe storage choices, test metadata preservation without exposing GPS to recipients. |
| Legal and policy scope remains open | AI statutes, CalOPPA, CCPA and partner roles are distinct | Complete the narrow applicability review using this inventory and actual contracts, then align launch claims and privacy terms. Do not promise court admissibility, privilege, California certification or complete provenance. |

## Verification and decision rules

Record exact commit, migration state and environment for release evidence. Tests using mocked storage or an embedded database do not prove production policy enforcement. No live migration, merge, publication, email or outreach was performed in this work.

The California launch remains on hold until the blocking rows above have evidence or the affected features are demonstrably unavailable on the server. A marketing page change alone is not a release control. A proposed limited beta would need an explicit feature scope and the same data access protections.

## Local verification results

1. 65 tests passed across seven files covering the real document handler with synthetic I/O, consent UI, expiry boundaries, attorney authorization, existing extraction, existing AI notices and professional access handlers.
2. TypeScript check passed.
3. Production bundle completed successfully. This is a local build, not a deployed browser test.
4. Migration passed on embedded PostgreSQL using synthetic rows: defaults for existing records, repeated application, preservation of denied/sealed values and extraction result writes. No live migration was applied.
5. Diff whitespace check passed.

The production metadata check found all five listed storage buckets private and no public ordinary table with RLS disabled. This does not verify individual policies, views, RPCs, signed URLs or runtime suspension enforcement.
