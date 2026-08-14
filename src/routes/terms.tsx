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
  return (
    <h2 className="font-serif mt-8 mb-3" style={{ fontSize: 22 }}>{children}</h2>
  );
}

function Terms() {
  const updated = "August 2026";
  return (
    <div style={{ background: "var(--background)", minHeight: "100vh" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--muted-foreground)", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
          <ArrowLeft size={16} /> Home
        </Link>
        <BrandLogo size={34} showTagline={false} />
      </header>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 24px 96px" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted-foreground)", fontWeight: 700 }}>
          Terms of Service
        </div>
        <h1 className="font-serif mt-2" style={{ fontSize: 40, lineHeight: 1.1 }}>The rules of using PatternProof.</h1>
        <p className="mt-3 text-[14px]" style={{ color: "var(--muted-foreground)" }}>Last updated: {updated}</p>

        <section style={{ fontSize: 15, lineHeight: 1.7, color: "var(--foreground)" }}>
          <H2>1. Who we are</H2>
          <p>PatternProof is operated by Grace Burns, an individual, doing business as PatternProof ("PatternProof", "we", "us"). By creating an account or using the service you agree to these Terms.</p>

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

          <H2>11. Disclaimers &amp; limitation of liability</H2>
          <p>The service is provided "as is" without warranties of any kind. To the maximum extent permitted by law, PatternProof's total liability for any claim relating to the service is limited to the amount you paid us in the 12 months before the claim.</p>

          <H2>12. Governing law</H2>
          <p>These Terms are governed by the laws of the State of New Jersey, without regard to conflict-of-law rules.</p>

          <H2>13. Contact</H2>
          <p>Questions about these Terms? Email <a href="mailto:gracieburns200@gmail.com" style={{ color: "var(--accent)" }}>gracieburns200@gmail.com</a>.</p>
        </section>
      </main>
    </div>
  );
}