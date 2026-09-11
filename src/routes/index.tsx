import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { BrandMark } from "@/components/BrandMark";
import { ChronologyThread } from "@/components/ChronologyThread";

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
  }),
  component: Index,
});

const SAMPLE_BEADS = [
  {
    id: "s1",
    title: "Text message",
    happenedLabel: "3 Oct · exact",
    certainty: "exact" as const,
    kind: "text" as const,
    body: "Kept with its source.",
  },
  {
    id: "s2",
    title: "Voice note",
    happenedLabel: "about 7 Oct · approximate",
    certainty: "approximate" as const,
    kind: "audio" as const,
    body: "Date can stay approximate.",
  },
  {
    id: "s3",
    title: "Photo",
    happenedLabel: "12 Oct · exact",
    certainty: "exact" as const,
    kind: "photo" as const,
    body: "Location held back until you release it.",
  },
];

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
          Private chronology
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
            <ChronologyThread beads={SAMPLE_BEADS} />
          </section>

          <section style={{ marginTop: 56 }}>
            <p className="folio-kicker">Who it is for</p>
            <div style={{ marginTop: 16, display: "grid", gap: 0 }}>
              <div className="docket">
                <div className="docket-tab">Exhibit · Survivors</div>
                <div className="docket-body">
                  <h2 style={{ margin: 0, fontSize: "1.45rem" }}>Free. Private by default.</h2>
                  <p style={{ margin: "8px 0 14px" }}>Nothing is required.</p>
                  <Link to="/signup" style={{ color: "var(--indigo)" }}>
                    Start a private record
                  </Link>
                </div>
              </div>
              <div className="docket">
                <div className="docket-tab">Exhibit · Attorneys</div>
                <div className="docket-body">
                  <h2 style={{ margin: 0, fontSize: "1.45rem" }}>Review starts the day the file arrives.</h2>
                  <p style={{ margin: "8px 0 14px" }}>
                    A source-linked chronology instead of a folder of screenshots.
                  </p>
                  <Link to="/for-attorneys" style={{ color: "var(--indigo)" }}>
                    For attorneys
                  </Link>
                </div>
              </div>
              <div className="docket">
                <div className="docket-tab">Exhibit · Organizations</div>
                <div className="docket-body">
                  <h2 style={{ margin: 0, fontSize: "1.45rem" }}>The intake can begin already in order.</h2>
                  <p style={{ margin: "8px 0 14px" }}>
                    Refer survivors at no cost to you or to them.
                  </p>
                  <Link to="/for-organizations" style={{ color: "var(--indigo)" }}>
                    For organizations
                  </Link>
                </div>
              </div>
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

          <section className="gloss-block" style={{ marginTop: 64, paddingBottom: 48 }}>
            <p className="line">The file is not the story.</p>
            <p className="between">a screenshot without a date is only a file</p>
            <p className="line">The pattern is.</p>
            <p className="between">order, source, and context — together</p>
            <p style={{ marginTop: 16, maxWidth: 560 }}>
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
