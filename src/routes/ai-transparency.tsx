import { createFileRoute } from "@tanstack/react-router";
import { TrustPage, Section, Callout } from "@/components/pp/TrustPageShell";

export const Route = createFileRoute("/ai-transparency")({
  head: () => ({
    meta: [
      { title: "AI Transparency — PatternProof" },
      {
        name: "description",
        content:
          "How PatternProof uses AI: what it extracts, what it interprets, what you can confirm or reject, and how AI provenance is recorded.",
      },
      { property: "og:title", content: "AI Transparency — PatternProof" },
      {
        property: "og:description",
        content:
          "How AI assists documentation, how to review its output, and what attorneys should verify.",
      },
      { property: "og:url", content: "https://pattern-proof.tech/ai-transparency" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AI Transparency — PatternProof" },
      {
        name: "twitter:description",
        content:
          "How AI assists documentation, how to review its output, and what attorneys should verify.",
      },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/ai-transparency" }],
  }),
  component: () => (
    <TrustPage
      title="AI Transparency"
      subtitle="What our AI does, what it does not do, and how you stay in control."
    >
      <Section title="Extraction vs. interpretation">
        <p>
          <strong>Extraction</strong> pulls facts out of what you upload: text, names, dates, times,
          locations, senders, recipients, attachments, visible metadata, and reply relationships.
        </p>
        <p>
          <strong>Interpretation</strong> suggests possible groupings, recurring documented themes,
          documentation gaps, and clarification questions. Interpretation is always shown as a
          suggestion, never as a fact.
        </p>
      </Section>
      <Section title="You decide">
        <p>
          Review AI suggestions against your source material before saving or sharing them. Check
          the final export too. Available review controls vary by feature.
        </p>
      </Section>
      <Section title="Explanations, not hidden reasoning">
        <p>
          AI can misread names, dates, speakers, and context. A fluent answer is not proof that an
          event occurred. Keep the original source available when reviewing a suggestion.
        </p>
      </Section>
      <Section title="Source records and AI processing">
        <p>
          Source references and processing details vary by feature. PatternProof does not promise a
          complete model version, instruction history, or revision record for every AI output. AI
          text and transcripts are derived material, not authenticated originals.
        </p>
        <p>
          AI features send relevant content to Google or OpenAI through Lovable's AI Gateway. Review
          our{" "}
          <a href="/privacy" className="underline">
            privacy notice
          </a>{" "}
          before using them with confidential information. Confirm the applicable provider terms and
          authorization before entering client material.
        </p>
      </Section>
      <Section title="For attorneys">
        <p>
          PatternProof assists documentation and does not replace your legal judgment. Independently
          check facts, dates, quotations, and any legal citations against their sources before use.
          A user's confirmation is not an attorney's verification or a guarantee of admissibility.
        </p>
        <p>
          Before submitting a document to a court, identify any AI contribution and check the
          court's applicable disclosure rules. Sharing through PatternProof does not by itself
          establish an attorney client relationship or make a record privileged.
        </p>
      </Section>
      <Section title="What AI does not do">
        <Callout>
          PatternProof does not diagnose an alleged abuser, predict future violence, calculate the
          probability that abuse occurred, or replace professional judgment. It helps you preserve,
          organize, and describe what you already have.
        </Callout>
      </Section>
    </TrustPage>
  ),
});
