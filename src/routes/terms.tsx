import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — PatternProof" },
      { name: "description", content: "PatternProof Terms of Service." },
      { property: "og:title", content: "Terms of Service — PatternProof" },
      { property: "og:url", content: "https://pattern-proof.tech/terms" },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/terms" }],
  }),
  component: Terms,
});

function H2({ children }: { children: React.ReactNode }) {
  return <h2>{children}</h2>;
}

function Terms() {
  const updated = "August 2026";
  return (
    <div data-persona="survivor" className="pp-legal-shell">
      <div className="pp-legal-sheet">
        <header className="pp-legal-nav justify-between">
          <Link to="/" className="pp-legal-link">
            <ArrowLeft size={16} /> Home
          </Link>
          <BrandLogo size={34} showTagline={false} />
        </header>
        <main>
          <p className="pp-legal-kicker">Terms of Service</p>
          <h1 className="pp-legal-title">The rules of using PatternProof.</h1>
          <p className="pp-legal-meta">Last updated: {updated}</p>

          <section className="pp-legal-prose">
          <H2>1. Who we are</H2>
          <p>PatternProof is a sole proprietorship operated by Grace Burns, doing business as PatternProof ("PatternProof," "we," "us"). PatternProof is not a separate legal entity from Grace Burns individually. By creating an account or using the Service, you agree to these Terms, including the limitation of liability and indemnification provisions below.</p>

          <H2>2. What PatternProof is — and isn't</H2>
          <p>PatternProof is a documentation and evidence-organization tool. It is <strong>not a law firm</strong>, does not provide legal advice, and does not create an attorney-client relationship. AI outputs (patterns, summaries, drafts) are informational and may contain errors — always verify before relying on them in legal proceedings.</p>

          <H2>3. Your account</H2>
          <p>You must be 18+ (or the age of majority in your jurisdiction) to use the service. You are responsible for keeping your credentials secure. Do not share your account.</p>

          <H2>4. Your content, your ownership</H2>
          <p>Everything you upload, write, or record on PatternProof belongs to you. You grant us a limited license only to store, process, and display it back to you (and to people you explicitly grant access to) in order to provide the service. We will not sell your data, ever.</p>

          <H2>5. Acceptable use</H2>
          <ul>
            <li>Do not use the service to harass, threaten, or fabricate evidence about another person.</li>
            <li>Do not upload content you don't have the legal right to share.</li>
            <li>Do not attempt to break, probe, or misuse the platform.</li>
          </ul>

          <H2>6. Recording &amp; two-party consent</H2>
          <p>Recording laws vary by state and country. You are solely responsible for complying with the laws that apply where you and the other party are located. PatternProof surfaces reminders where practical but cannot verify compliance for you.</p>

          <H2>7. Attorney &amp; organization users</H2>
          <p>Attorneys and organizations who access survivor data through PatternProof act as independent professionals bound by their own ethical and legal duties. PatternProof does not supervise their practice and is not responsible for their handling of matters.</p>

          <H2>8. Payments</H2>
          <p>Paid plans are billed through Stripe. You can cancel any time; access continues through the end of the paid period. We do not offer refunds for partial periods except where required by law.</p>

          <H2>9. Availability &amp; changes</H2>
          <p>We aim for high availability but do not guarantee uninterrupted service. We may add, change, or remove features. Material changes to these Terms will be posted here with a new "last updated" date.</p>

          <H2>10. Termination</H2>
          <p>You may request deletion of your account at any time by emailing gracieburns200@gmail.com (an automated in-app delete flow is not yet available). We may suspend or terminate accounts that violate these Terms or create legal or safety risk. On termination, we will delete your data per our Privacy Policy retention rules.</p>

          <H2>11. Disclaimers, Limitation of Liability &amp; Indemnification</H2>
          <p>The service is provided "as is" without warranties of any kind. To the maximum extent permitted by law, PatternProof's total liability for any claim relating to the service is limited to the amount you paid us in the 12 months before the claim.</p>
          <p>You agree to indemnify and hold harmless Grace Burns and PatternProof from any claims, damages, losses, or expenses (including reasonable attorney's fees) arising out of: (a) your violation of these Terms; (b) content you upload or submit, including any claim that it was fabricated, obtained illegally, or violates another person's rights; or (c) your violation of any law, including recording-consent laws, in connection with your use of the Service.</p>

          <H2>12. Governing law</H2>
          <p>These Terms are governed by the laws of the State of New Jersey, without regard to conflict-of-law rules.</p>

          <H2>13. Contact</H2>
          <p>Questions about these Terms? Email <a href="mailto:gracieburns200@gmail.com" className="pp-legal-link">gracieburns200@gmail.com</a>.</p>
          </section>
        </main>
      </div>
    </div>
  );
}