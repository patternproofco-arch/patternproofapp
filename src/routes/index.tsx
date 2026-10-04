import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

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
    kindLabel: "Message",
    happenedLabel: "03 Oct",
    certainty: "exact",
    original: "Sample text message, kept with its source.",
    context: "Kept with its source.",
  },
  {
    id: "s2",
    title: "Voice note",
    kindLabel: "Voice note",
    happenedLabel: "about 07 Oct",
    certainty: "approximate",
    original: "Sample voice note. The date can stay approximate.",
    context: "Date can stay approximate.",
  },
  {
    id: "s3",
    title: "Photo",
    kindLabel: "Photo",
    happenedLabel: "12 Oct",
    certainty: "exact",
    original: "Sample photo, saved as the original file.",
    context: "Location held back until you release it.",
  },
];

const DOTS: { x: number; y: number; r: number }[] = [
  [168, 36, 3], [214, 28, 5], [262, 44, 7], [312, 22, 4], [358, 48, 9], [398, 30, 3],
  [154, 86, 5], [206, 96, 8], [258, 78, 4], [308, 102, 11], [360, 84, 6], [404, 108, 4],
  [176, 148, 7], [228, 138, 4], [274, 156, 10], [328, 142, 5], [372, 164, 8], [412, 136, 3],
  [190, 204, 4], [242, 214, 9], [292, 196, 6], [340, 220, 12], [388, 198, 5],
  [210, 268, 6], [258, 258, 4], [306, 278, 8], [354, 252, 5], [396, 272, 10],
  [228, 324, 5], [276, 338, 9], [326, 318, 4], [370, 344, 7], [408, 322, 3],
  [248, 388, 4], [296, 402, 8], [346, 378, 6], [392, 408, 11],
  [268, 448, 3], [318, 436, 6], [366, 452, 4],
].map(([x, y, r]) => ({ x, y, r }));

function DotConstellation() {
  return (
    <svg className="ed-mark" viewBox="0 0 440 480" aria-hidden="true">
      <defs>
        <radialGradient id="ed-wash" cx="70%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#e7d4ea" stopOpacity="0.85" />
          <stop offset="42%" stopColor="#f6dccb" stopOpacity="0.55" />
          <stop offset="78%" stopColor="#d5e3cf" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#f4efe6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="120" y="8" width="312" height="464" fill="url(#ed-wash)" />
      {DOTS.map((dot) => (
        <circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r={dot.r} fill="#111111" />
      ))}
    </svg>
  );
}

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { ref } = Route.useSearch();
  const attorneyMode = ref?.toLowerCase() === "attorney";

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="editorial-home">
      <section className="ed-hero">
        <div className="ed-hero-copy">
          <p className="ed-kicker">Private chronology</p>
          <h1>
            {attorneyMode ? (
              <>
                A shoebox of screenshots is not a chronology.{" "}
                <em>A source-linked timeline is.</em>
              </>
            ) : (
              <>The truth is in the pattern.</>
            )}
          </h1>
          <p className="ed-sub">
            {attorneyMode
              ? "Review a structured, source-linked chronology on day one, not a folder of screenshots."
              : "Turn scattered records into one source-linked timeline."}
          </p>
          <div className="ed-actions">
            {attorneyMode ? (
              <Link to="/demo" className="ed-primary">
                Explore a sample timeline
              </Link>
            ) : (
              <a href="#sample" className="ed-primary">
                Explore a sample timeline
              </a>
            )}
          </div>
          {attorneyMode ? (
            <p className="ed-quiet">
              <Link to="/" search={{ ref: undefined }}>
                Not an attorney?
              </Link>
            </p>
          ) : (
            <p className="ed-quiet">
              <Link to="/signup">Start a private record</Link>
              <span> Survivor accounts are free. No trial and no credit card.</span>
            </p>
          )}
        </div>
        <DotConstellation />
      </section>

      {!attorneyMode && (
        <>
          <section id="sample" className="ed-sample" aria-labelledby="sample-heading">
            <p className="ed-kicker">Sample · not a real record</p>
            <h2 id="sample-heading">starts the day the file arrives.</h2>
            <p className="ed-sample-lead">
              Keep the original. Add the context. Share only if you choose.
            </p>
            <div className="ed-rail" role="table" aria-label="Sample chronology">
              <div className="ed-rail-head" role="row">
                <span role="columnheader">Date</span>
                <span role="columnheader">Original</span>
                <span role="columnheader">Context</span>
              </div>
              {SAMPLE_BEADS.map((bead) => (
                <div className="ed-rail-row" role="row" key={bead.id}>
                  <div role="cell" className="ed-date">
                    <span>{bead.happenedLabel}</span>
                    <span className="ed-certainty">{bead.certainty}</span>
                  </div>
                  <div role="cell">
                    <p className="ed-kind">{bead.kindLabel}</p>
                    <p>{bead.original}</p>
                  </div>
                  <div role="cell">
                    <p className="ed-kind">Added note</p>
                    <p>{bead.context}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="ed-gloss">Context is addition, not replacement.</p>
            <p className="ed-quiet">
              <Link to="/demo">Open the longer sample</Link>
            </p>
          </section>

          <section className="ed-paths">
            <p className="ed-kicker">Who it is for</p>
            <ul>
              <li>
                <strong>Survivors.</strong> Start with what you have. Add context when you're ready.{" "}
                <Link to="/signup">Start a private record</Link>
              </li>
              <li>
                <strong>Attorneys.</strong> Know where the case stands. Know what comes next.{" "}
                <Link to="/for-attorneys">For attorneys</Link>
              </li>
              <li>
                <strong>Organizations.</strong> Help someone prepare without taking control away.{" "}
                <Link to="/for-organizations">For organizations</Link>
              </li>
            </ul>
          </section>

          <section className="ed-safety">
            <p className="ed-kicker">Safety</p>
            <p>Exit safely, on every page.</p>
            <p>
              <Link to="/safety">Read survivor safety</Link>
            </p>
            <p className="ed-disclaimer">
              See the pattern. See the proof. PatternProof does not make legal decisions and does not
              guarantee outcomes.
            </p>
          </section>

          <p className="ed-choice">Your record. Your choice.</p>
        </>
      )}
    </div>
  );
}
