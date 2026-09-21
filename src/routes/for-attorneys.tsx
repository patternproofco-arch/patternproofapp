import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import {
  AttorneyPlanComparison,
  AttorneyTrustFaq,
  ClientInvitationTemplate,
} from "@/components/AttorneyConversion";
import { getAttorneyOffer } from "@/lib/attorney-offer.functions";
import conversionCss from "@/styles/attorney-conversion.css?url";

export const Route = createFileRoute("/for-attorneys")({
  loader: () => getAttorneyOffer(),
  head: () => ({
    meta: [
      { title: "Client Evidence Intake for Family Law Attorneys | PatternProof" },
      {
        name: "description",
        content:
          "See a fictional source-linked chronology, download an evidence intake kit, compare attorney plans, and understand survivor-controlled sharing.",
      },
    ],
    links: [
      { rel: "canonical", href: "https://pattern-proof.tech/for-attorneys" },
      { rel: "stylesheet", href: conversionCss },
    ],
  }),
  component: ForAttorneys,
});

function ForAttorneys() {
  const offer = Route.useLoaderData();
  return (
    <div className="attorney-conversion" data-persona="attorney">
      <PublicQuickExit />
      <nav className="conversion-nav" aria-label="Attorney resources">
        <Link to="/">PatternProof</Link>
        <a href="#plans">Pricing</a>
        <Link to="/security-privacy">Security & privacy</Link>
        <Link to="/signin">Sign in</Link>
      </nav>
      <section className="conversion-section">
        <p className="conversion-eyebrow">
          Built for survivor choice. Designed for attorney review.
        </p>
        <h1>
          Your client brings the records.
          <br />
          You see the chronology.
        </h1>
        <p>
          Help clients move from scattered screenshots, messages, and notes to a dated timeline with
          links to the original sources. They review their entries and choose what to share. You
          bring the professional judgment.
        </p>
        <p>
          <a href="#professional-kit-title" className="conversion-button">
            Get the free evidence intake kit
          </a>
        </p>
        <p>
          <Link to="/lawyer-signup">
            {offer.enabled ? "Start your first case free" : "Request attorney access"}
          </Link>{" "}
          · <a href="/resources/attorney-sample">Download the fictional sample PDF</a>
        </p>
        <p>
          {offer.enabled
            ? "One case after access review. No card required. No automatic client sharing."
            : "Preview resources use fictional examples. The new first case offer is not active yet."}
        </p>
      </section>
      <section className="conversion-section">
        <p className="conversion-eyebrow">From scattered records to a reviewable file</p>
        <h2>A clearer place to start.</h2>
        <div className="conversion-grid">
          <article className="conversion-panel">
            <h3>The manual process</h3>
            <p>
              Messages in one folder. Photos in another. Dates mixed with upload times. Context in
              an email. You rebuild the sequence before you can review it.
            </p>
          </article>
          <article className="conversion-panel">
            <h3>The PatternProof workflow</h3>
            <p>
              Client confirmed entries in date order. Uncertain dates labeled. Each entry points
              back to its source. Only the shared scope is available to you.
            </p>
            <p>
              Extraction can suggest information. The client reviews it. The software does not
              decide whether abuse occurred.
            </p>
          </article>
        </div>
      </section>
      <section className="conversion-section">
        <h2>Three steps, with consent at the center.</h2>
        <div className="conversion-grid">
          <article>
            <h3>1. Prepare your workspace</h3>
            <p>
              Create your profile and complete attorney access review. Once approved, open a matter.
              Creating a matter does not give you client data.
            </p>
          </article>
          <article>
            <h3>2. Let the client choose</h3>
            <p>
              The client documents at their own pace, reviews dates and entries, and sends a case
              scoped invitation to your verified work email.
            </p>
          </article>
          <article>
            <h3>3. Review what is shared</h3>
            <p>
              Accept the invitation and attach it to the matter. Review the chronology and source
              files. Export only the material authorized for your access.
            </p>
          </article>
        </div>
      </section>
      <section className="conversion-section">
        <h2>See the output before you sign up.</h2>
        <p>
          The sample is a fictional illustration, not a customer case, testimonial, or guarantee of
          a court outcome. The kit has a matching worksheet and an invitation template.
        </p>
        <p>
          <a href="/resources/attorney-sample" className="conversion-button">
            Download sample chronology
          </a>{" "}
          · <a href="/resources/attorney-kit">Download printable kit</a>
        </p>
      </section>
      <div id="plans">
        <AttorneyPlanComparison enabled={offer.enabled} />
      </div>
      <AttorneyTrustFaq />
      <ClientInvitationTemplate />
    </div>
  );
}
