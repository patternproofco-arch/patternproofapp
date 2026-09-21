import { createFileRoute, Link } from "@tanstack/react-router";
import { AttorneyTrustFaq } from "@/components/AttorneyConversion";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import conversionCss from "@/styles/attorney-conversion.css?url";

export const Route = createFileRoute("/security-privacy")({
  head: () => ({
    meta: [
      { title: "Security & Privacy FAQ | PatternProof" },
      {
        name: "description",
        content:
          "Plain answers about sharing, originals, exports, revocation, encryption, and the limits of PatternProof.",
      },
    ],
    links: [
      { rel: "stylesheet", href: conversionCss },
      { rel: "canonical", href: "https://pattern-proof.tech/security-privacy" },
    ],
  }),
  component: () => (
    <div className="attorney-conversion">
      <PublicQuickExit />
      <nav className="conversion-nav">
        <Link to="/for-attorneys">For attorneys</Link>
        <Link to="/privacy">Privacy Policy</Link>
      </nav>
      <section className="conversion-section">
        <h1>Know what you are sharing.</h1>
        <p>
          These answers describe the software and its limits. They are not a certification of
          security, legal advice, or a promise of a particular court outcome.
        </p>
      </section>
      <AttorneyTrustFaq full />
    </div>
  ),
});
