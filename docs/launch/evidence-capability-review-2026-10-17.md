# Evidence capability review and export repairs

## What the comparison actually establishes

EvidenceGuard contains only a title and description in its
[README](https://github.com/patternproofco-arch/EvidenceGuard/blob/73fb988559368728f7c206b50f5a615fa9fe0baa/README.md).
It has no application implementation to import. The Copilot conversation inferred
capabilities from descriptions and language percentages. Those are not evidence
that one product implements a feature or that PatternProof lacks it.

This review inspected PatternProof main at `e001c64`, its source and existing
tests. PatternProof is an evidence-documentation application with a chat helper,
not an otherwise empty conversation shell. Replacing its foundation with an
assumed Next.js/S3 application would duplicate working systems.

## Existing capabilities and real limits

| User need                                                        | Existing implementation                                                                                                                                                                                              | Limit or next step                                                                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Add files and recover from interrupted work                      | [evidence-intake.ts](../../src/lib/evidence-intake.ts), [intake-queue.ts](../../src/lib/intake-queue.ts), [BatchDropzone.tsx](../../src/components/evidence/BatchDropzone.tsx)                                       | Retries reuse an upload key. This is not transfer resumption from the last completed chunk of a large video.                      |
| Save a file fingerprint and find duplicates                      | [evidence-ingest.functions.ts](../../src/lib/evidence-ingest.functions.ts), [stored-object-hash.server.ts](../../src/lib/stored-object-hash.server.ts)                                                               | A fingerprint checks bytes, not truth, authorship, creation time, or court acceptance.                                            |
| Inspect embedded photo details and choose whether to remove them | [exif.ts](../../src/lib/exif.ts), [FileIntakeRow.tsx](../../src/components/evidence/FileIntakeRow.tsx)                                                                                                               | Not a general audio/video forensic laboratory. Originals can retain private location details even if CSV coordinates are omitted. |
| Put records in date order and group a case                       | [timeline.tsx](../../src/routes/_authenticated/timeline.tsx), [chronology.ts](../../src/lib/chronology.ts), [court-packet.server.ts](../../src/lib/court-packet.server.ts)                                           | Keep approximate and unknown dates distinct; do not turn upload times into event dates.                                           |
| Share selected records and withdraw hosted access                | [attorney-access.server.ts](../../src/lib/attorney-access.server.ts), [advocate-access.server.ts](../../src/lib/advocate-access.server.ts), [evidence-download.server.ts](../../src/lib/evidence-download.server.ts) | Withdrawal cannot retrieve files somebody already downloaded, printed, or forwarded.                                              |
| Add professional notes and review automated suggestions          | [attorney-evidence-reviews.functions.ts](../../src/lib/attorney-evidence-reviews.functions.ts), [pattern-export.ts](../../src/lib/pattern-export.ts)                                                                 | Notes and rejected-claim filtering are not a general image/PDF redaction editor.                                                  |
| Produce downloadable records and professional-review packets     | [export-zip.server.ts](../../src/lib/export-zip.server.ts), [advocate-packet.server.ts](../../src/lib/advocate-packet.server.ts), [court-packet.server.ts](../../src/lib/court-packet.server.ts)                     | The repaired ZIP paths are described below. A package is not guaranteed admissible or accepted by a court.                        |
| Record activity                                                  | [audit.functions.ts](../../src/lib/audit.functions.ts), preservation events in [evidence-ingest.functions.ts](../../src/lib/evidence-ingest.functions.ts)                                                            | This review did not establish a protected record of every preview, view, and download.                                            |

## What this change does

In everyday terms, it checks the contents of the box before handing it over,
includes a list of any files that differ from their saved copy, and provides a
checker for the recipient. It preserves the distinction between an unchanged
file, a changed file, and a file whose earlier fingerprint was never recorded.

- Survivor and advocate ZIP builders stop if a promised file cannot download or
  be read. The survivor endpoint returns `file-unavailable`, and settings shows
  an error instead of offering a partial package. Advocate callers already catch
  and display failures.
- Each included original records its saved and current fingerprints and match
  status. Changed files remain retrievable, with `INTEGRITY-WARNINGS.txt`, an
  inventory warning count, and a warning in the survivor's export confirmation.
  Historical records without a saved fingerprint remain explicitly unverified.
- `FILE-CHECKS.txt` explains results in plain language. The inventory also checks
  reports, CSV records, and metadata alongside the originals. It explicitly says
  it is unsigned.
- `verify.sh` works offline with Bash and Python 3.9+. It returns nonzero for
  missing/changed bytes, wrong lengths, incorrect original-file root checksums,
  malformed or inconsistent inventories, duplicate paths, and paths outside the
  extracted folder. It also reports known saved-fingerprint mismatches. A missing
  historical fingerprint is disclosed rather than treated as a match or failure.
- Full record IDs prevent same-date/same-title files with identical eight-character
  ID prefixes from overwriting one another inside the ZIP.
- Supporting survivor records, conversation source documents and corrections,
  file families, and advocate scoped selections use the existing page/batch
  readers. Query failures propagate instead of becoming successful empty lists.

The shared read/comparison/inventory code lives in
[export-integrity.server.ts](../../src/lib/export-integrity.server.ts).

## Why the more elaborate proposals are held

An unsigned inventory stored beside the files helps detect changes relative to
that inventory. Someone able to replace both can create a new matching inventory.
This change does not add a digital signature, an outside timestamp, or a claim
that a file was authentic before it entered PatternProof.

Permanent storage locks would change survivors' existing deletion expectations.
Retention and any legal hold need a separate, explicit product decision before
infrastructure can enforce them. A placeholder signing service must never be
presented as a real signature or as court certification.

The useful next work is to evaluate actual large-file upload failures, audit
coverage, and a supported sharing-copy redaction flow before buying another
storage system or adding advanced signing infrastructure.

## Remaining work and boundaries

- The attorney/payment packet and practice-management exporter have similar
  file-check gaps. They remain untouched while #252 owns payments changes; use a
  coordinated follow-up rather than an overlapping third PR.
- Advocate administrative storage reads still rely on stored paths from scoped
  evidence records. Reuse the owner-folder validation of the individual download
  path in a separately tested authorization follow-up, with a plan for historical
  storage paths.
- Legal-document original files and evidence voice captions are not newly added
  to these packages; the existing document records remain represented as before.
- Archive generation still builds the ZIP in memory. This does not promise
  arbitrarily large exports, malware scanning, background integrity monitoring,
  immutable retention, or privacy guarantees for optional external AI processing.
- No schema, storage configuration, trial policy, invitation expiry, invite UI,
  invite email, attribution, or production settings change in this PR.

## Validation

Regression tests run the real builders with fictional records, extract the
generated packages, and execute the delivered checker. The new tests reproduce
the original missing-file, changed-fingerprint, filename-collision, and checker
exit-status failures against the unmodified builders. Existing chat-import
mismatch behavior is retained. A large-list fixture covers more than 1,000
supporting records and conversation rows with API row and request-ID limits.

Local verification includes the full unit suite, TypeScript, the synthetic SQL
isolation suite, and a production build using CI placeholder Supabase settings.
No live account, real email, production database, or deployment is used.

- `npm test -- --reporter=dot`: 141 files and 1,424 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run test:security:sql`: passed with synthetic PGlite data.
- `npm run build`: passed with CI placeholder Supabase settings.
- Independent read-only review: no blockers found. Browser CI on the combined
  branch and a signed-in export check remain separate validation steps.
