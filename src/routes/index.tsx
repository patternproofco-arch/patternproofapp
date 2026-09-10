import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { ref?: string } =>
    typeof search.ref === "string" ? { ref: search.ref } : {},
  head: () => ({
    meta: [
      { title: "Private Evidence Timeline for Survivors | PatternProof" },
      {
        name: "description",
        content:
          "PatternProof is private evidence documentation software for survivors, attorneys, and domestic violence organizations. Organize photos, messages, voice notes, and written entries into one source-linked timeline.",
      },
      { property: "og:title", content: "Private Evidence Timeline for Survivors | PatternProof" },
      {
        property: "og:description",
        content:
          "Private, survivor-controlled documentation for domestic violence, coercive control, and high-conflict custody records.",
      },
      { property: "og:url", content: "https://pattern-proof.tech/" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://pattern-proof.tech/og-home.png" },
      { name: "twitter:title", content: "Private Evidence Timeline for Survivors | PatternProof" },
      {
        name: "twitter:description",
        content:
          "Organize domestic violence and custody documentation into a private, source-linked timeline you control.",
      },
      { name: "twitter:image", content: "https://pattern-proof.tech/og-home.png" },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "PatternProof",
          description:
            "Private evidence documentation software for survivors, attorneys, and domestic violence organizations. Organize scattered incidents, photos, messages, voice notes, and timelines into a source-linked chronology.",
          brand: { "@type": "Brand", name: "PatternProof" },
          category: "Evidence documentation software",
          audience: [
            { "@type": "Audience", audienceType: "Domestic violence survivors" },
            { "@type": "Audience", audienceType: "Family law attorneys" },
            { "@type": "Audience", audienceType: "Domestic violence organizations" },
          ],
          url: "https://pattern-proof.tech/",
          offers: [
            {
              "@type": "Offer",
              name: "Survivor — Free",
              price: "0",
              priceCurrency: "USD",
              url: "https://pattern-proof.tech/signin",
              availability: "https://schema.org/InStock",
            },
            {
              "@type": "Offer",
              name: "Attorney Solo",
              price: "297",
              priceCurrency: "USD",
              url: "https://pattern-proof.tech/for-attorneys",
              availability: "https://schema.org/InStock",
            },
            {
              "@type": "Offer",
              name: "DV Organization — Partner",
              price: "0",
              priceCurrency: "USD",
              url: "https://pattern-proof.tech/for-organizations",
              availability: "https://schema.org/InStock",
            },
          ],
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { ref } = Route.useSearch();
  const attorneyMode = ref?.toLowerCase() === "attorney";

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="folio-shell" style={{ minHeight: "100vh" }}>
      <div className="folio-stitch" aria-hidden="true" />

      <section className="landing-hero" style={{ paddingTop: "clamp(40px, 6vw, 72px)" }}>
        <BrandMark size={36} variant="ink" onDark />
        <p className="folio-kicker" style={{ marginTop: 22 }}>
          {attorneyMode ? "Private chronology" : "Private chronology"}
        </p>
        <h1 style={{ marginTop: 14, marginBottom: 0, maxWidth: 640 }}>
          {attorneyMode ? (
            <>
              A shoebox of screenshots is not a chronology.
              <br />
              <em>A source-linked timeline is.</em>
            </>
          ) : (
            <>
              One private timeline.
              <br />
              <em>Everything in the right order.</em>
            </>
          )}
        </h1>

        {attorneyMode ? (
          <>
            <p style={{ marginTop: 20, maxWidth: 620 }}>
              Review a structured, source-linked chronology on day one — not a folder of
              screenshots. Hearing prep starts with strategy, not sorting.
            </p>
            <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link to="/demo" className="btn-primary" style={{ textDecoration: "none" }}>
                View the sample
              </Link>
              <Link to="/" search={{ ref: undefined }} className="btn-ghost" style={{ textDecoration: "none" }}>
                Not an attorney?
              </Link>
            </div>
          </>
        ) : (
          <>
            <p style={{ marginTop: 18, maxWidth: 620 }}>
              PatternProof organizes your photos, messages, voice notes, and written entries into
              one source-linked timeline. You decide what to add, what to share, and who can see
              it. Survivor accounts are free, with no trial or credit card.
            </p>
            <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link to="/signup" className="btn-primary" style={{ textDecoration: "none" }}>
                Start a private record
              </Link>
              <Link to="/demo" className="btn-ghost" style={{ textDecoration: "none" }}>
                View the sample
              </Link>
            </div>
          </>
        )}
      </section>

      {!attorneyMode && (
        <>
          <section style={{ marginTop: 56 }}>
            <p className="folio-kicker">Sample · demo data · not a real record</p>
            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              <article className="folio-plate">
                <p className="folio-kicker">Text message · 3 Oct · exact</p>
                <p style={{ margin: "8px 0 0" }}>Kept with its source.</p>
              </article>
              <article className="folio-plate">
                <p className="folio-kicker">Voice note · about 7 Oct · approximate</p>
                <p style={{ margin: "8px 0 0" }}>Date can stay approximate.</p>
              </article>
              <article className="folio-plate">
                <p className="folio-kicker">Photo · 12 Oct · exact</p>
                <p style={{ margin: "8px 0 0" }}>Location held back until you release it.</p>
              </article>
            </div>
          </section>

          <section style={{ marginTop: 56 }}>
            <p className="folio-kicker">Who it is for</p>
            <div className="portal-path-grid" style={{ marginTop: 16 }}>
              <article className="folio-plate">
                <h2 style={{ margin: 0, fontSize: "1.35rem" }}>Survivors</h2>
                <p style={{ margin: "8px 0 14px" }}>
                  Free. Private by default. Nothing is required.
                </p>
                <Link to="/signup" style={{ color: "var(--indigo)" }}>
                  Start a private record
                </Link>
              </article>
              <article className="folio-plate">
                <h2 style={{ margin: 0, fontSize: "1.35rem" }}>Attorneys</h2>
                <p style={{ margin: "8px 0 14px" }}>
                  Review a source-linked chronology instead of a folder of screenshots.
                </p>
                <Link to="/for-attorneys" style={{ color: "var(--indigo)" }}>
                  For attorneys
                </Link>
              </article>
              <article className="folio-plate">
                <h2 style={{ margin: 0, fontSize: "1.35rem" }}>DV organizations</h2>
                <p style={{ margin: "8px 0 14px" }}>
                  Refer survivors at no cost to you or to them.
                </p>
                <Link to="/for-organizations" style={{ color: "var(--indigo)" }}>
                  For organizations
                </Link>
              </article>
            </div>
          </section>

          <section style={{ marginTop: 56 }}>
            <p className="folio-kicker">Safety</p>
            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              <p>Exit safely, on every page.</p>
              <p>Uploads finish after a dropped connection.</p>
              <p>Photo location data is held back until you choose.</p>
            </div>
            <p style={{ marginTop: 14 }}>
              <Link to="/safety" style={{ color: "var(--indigo)" }}>
                Read survivor safety
              </Link>
            </p>
            <p style={{ marginTop: 18, fontSize: 14 }}>
              Documentation is encrypted in transit and protected by per-user access controls. At-rest
              encryption is a property of our infrastructure host that we have not independently
              audited.
            </p>
          </section>

          <section style={{ marginTop: 64, paddingBottom: 48 }}>
            <h2 style={{ margin: 0 }}>
              The file is not the story. <em>The pattern is.</em>
            </h2>
            <p style={{ marginTop: 12, maxWidth: 560 }}>
              Keep the original. Add the context. Share only if you choose.
            </p>
            <div style={{ marginTop: 24 }}>
              <Link to="/signup" className="btn-primary" style={{ textDecoration: "none" }}>
                Start a private record
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
