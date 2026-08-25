import { createFileRoute } from "@tanstack/react-router";
import { TrustPage, Section, Callout } from "@/components/pp/TrustPageShell";

export const Route = createFileRoute("/professional-access")({
  head: () => ({
    meta: [
      { title: "Professional Access — PatternProof" },
      { name: "description", content: "How PatternProof lets survivors share documentation with attorneys and advocates: scoped, time-bound, revocable, and logged." },
      { property: "og:title", content: "Professional Access — PatternProof" },
      { property: "og:description", content: "Survivor-approved, limited, revocable, and logged professional access. Professionals can add notes but never overwrite survivor statements or original evidence." },
      { property: "og:url", content: "https://pattern-proof.tech/professional-access" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Professional Access — PatternProof" },
      { name: "twitter:description", content: "Survivor-approved, limited, revocable, and logged professional access. Professionals can add notes but never overwrite survivor statements or original evidence." },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/professional-access" }],
  }),
  component: () => (
    <TrustPage title="Professional Access" subtitle="How survivors share documentation with attorneys and advocates.">
      <Section title="Survivor-controlled by default">
        <p>An attorney or advocate can only see what the survivor has explicitly shared. Access is scoped, time-bound where requested, and can be revoked at any time. Every access event is recorded.</p>
      </Section>
      <Section title="Professionals can add — not overwrite">
        <p>Professionals may add their own notes and reviews. They cannot overwrite survivor statements, original evidence, AI history, or prior versions.</p>
      </Section>
      <Section title="Before you share">
        <ul>
          <li>Confirm the recipient</li>
          <li>Choose which records are included</li>
          <li>Choose permissions and expiration</li>
          <li>Review the known limitations of your export</li>
        </ul>
      </Section>
      <Section title="Revocation is not deletion">
        <Callout>Revoking access prevents future access through PatternProof. It cannot delete copies someone has already downloaded or saved.</Callout>
      </Section>
      <Section title="Professional-review exports, not a legal certification">
        <p>What you send is a <strong>professional-review packet</strong> with a source-linked chronology and a provenance and integrity report. PatternProof does not determine admissibility, make legal findings, or replace professional judgment.</p>
      </Section>
    </TrustPage>
  ),
});