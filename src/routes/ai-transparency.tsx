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
          "Separated AI extraction and interpretation, Confirm / Edit / Reject / Unsure on every suggestion, and full provenance on every AI output.",
      },
      { property: "og:url", content: "https://pattern-proof.tech/ai-transparency" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AI Transparency — PatternProof" },
      {
        name: "twitter:description",
        content:
          "Separated AI extraction and interpretation, Confirm / Edit / Reject / Unsure on every suggestion, and full provenance on every AI output.",
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
          Review suggestions before using them. You can confirm an entry reference, edit a draft
          yourself, dismiss a suggestion, or leave it for later. Rejected suggestions never appear
          in an export.
        </p>
      </Section>
      <Section title="Optional Jev request matching">
        <p>
          After you authorize a named attorney's current share in Settings, that attorney can ask
          whether a requested item may already be shared. The app searches eligible shared files
          locally and sends TypeSafe's Jev service relevant excerpts from up to 12 candidates. Jev
          returns a fixed choice, including no clear match. It does not generate an account of
          events or decide that documentation should exist.
        </p>
        <p>
          Results show the file title, source excerpt, and how many files were searched and checked.
          A possible match needs your attorney's source review. No match does not mean an item is
          missing. Results expire after five minutes and are not added to exports or saved as
          evidence links. Minimal activity provenance records the model, instruction version, source
          IDs and fingerprints without copying the request or source text.
        </p>
        <p>
          Your permission lasts 30 days, pauses if the shared file scope changes, and can be turned
          off in Settings. Revoked shares and records marked no AI are excluded. Entry linking, AI
          record grouping and AI draft checks are deferred from this initial Jev rollout.
        </p>
      </Section>
      <Section title="Explanations, not hidden reasoning">
        <p>
          Every AI output shows what PatternProof did, why, which sources it used, what remains
          uncertain, and what you can do next. We do not expose private model reasoning or
          chain-of-thought.
        </p>
      </Section>
      <Section title="Provenance for saved AI outputs">
        <ul>
          <li>Source record IDs the suggestion was drawn from</li>
          <li>Kind of AI activity (extraction or interpretation)</li>
          <li>Model identifier and version, and instruction version</li>
          <li>Structured output, timestamp, and your response</li>
          <li>Revision and export history</li>
        </ul>
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
