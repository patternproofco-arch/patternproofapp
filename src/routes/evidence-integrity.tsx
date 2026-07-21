import { createFileRoute } from "@tanstack/react-router";
import { TrustPage, Section, Callout } from "@/components/pp/TrustPageShell";

export const Route = createFileRoute("/evidence-integrity")({
  head: () => ({
    meta: [
      { title: "Evidence Integrity — PatternProof" },
      { name: "description", content: "How PatternProof preserves original files, generates SHA-256 hashes, tracks derivatives, and reports what a hash does and does not prove." },
      { property: "og:title", content: "Evidence Integrity — PatternProof" },
      { property: "og:description", content: "Original files are preserved byte-for-byte. Previews, transcripts, and redactions are stored as separate derivatives. Every export includes a provenance and integrity report." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <TrustPage title="Evidence Integrity" subtitle="How PatternProof preserves your original records — and what our integrity checks actually prove.">
      <Section title="Originals are preserved unchanged">
        <p>When you upload a file, PatternProof stores the original bytes exactly as received. Previews, thumbnails, OCR text, transcripts, redacted copies, and export copies are stored separately as derivatives. Editing or redacting never overwrites the original.</p>
      </Section>
      <Section title="SHA-256 hashes">
        <p>Every preserved original is fingerprinted with SHA-256. Derivatives get their own hash. Your professional-review export includes a hash for every file plus a root hash of hashes.</p>
        <Callout>A SHA-256 hash only proves that the stored bytes match the preserved version. It does not prove truth, authorship, creation date, or admissibility. Any court or professional judgment about a file is separate from this integrity check.</Callout>
      </Section>
      <Section title="What we record with each file">
        <ul>
          <li>Original filename, byte size, and MIME type</li>
          <li>Upload timestamp and reported source</li>
          <li>Raw metadata as received, and a normalized copy</li>
          <li>Preservation status: received, preserved, extraction pending, needs attention, unsupported-but-preserved, or upload incomplete</li>
          <li>Version history and duplicate relationships</li>
        </ul>
      </Section>
      <Section title="Duplicates and corroboration">
        <p>Duplicate files (renamed, re-encoded, forwarded, or imported through multiple sources) are grouped into an evidence family. PatternProof will show "N files represent 1 underlying record" rather than counting the same message six times as six pieces of proof.</p>
      </Section>
      <Section title="What we do not claim">
        <p>PatternProof does not prove abuse, determine legal truth, guarantee admissibility, or replace professional judgment. It preserves and organizes what you already have.</p>
      </Section>
    </TrustPage>
  ),
});