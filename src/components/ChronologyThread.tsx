import { useState } from "react";

export type DateCertainty = "exact" | "approximate" | "unknown";

export type ChronologyBead = {
  id: string;
  title: string;
  happenedLabel: string;
  certainty: DateCertainty;
  sourceClock?: string;
  savedClock?: string;
  kind?: "photo" | "text" | "audio" | "doc" | "note";
  sourceRef?: string;
  unresolved?: string;
  duplicateCount?: number;
  body?: string;
};

export function ChronologyThread({
  beads,
  defaultView = "thread",
}: {
  beads: ChronologyBead[];
  defaultView?: "thread" | "list";
}) {
  const [view, setView] = useState<"thread" | "list">(defaultView);

  return (
    <div data-pp-thread="" className="bound-sheet">
      <div className="bound-ticks">
        <span>Chronology</span>
        <span>Demo · not a real record</span>
      </div>

      <div className="bound-toolbar">
        <p className="bound-note">
          Exact dates sit on the line. Approximate dates stay wide. The thread does not guess.
        </p>
        <div className="bound-toggles">
          <button type="button" onClick={() => setView("thread")} style={toggleStyle(view === "thread")}>
            Thread
          </button>
          <button type="button" onClick={() => setView("list")} style={toggleStyle(view === "list")}>
            List
          </button>
        </div>
      </div>

      {view === "list" ? (
        <ol className="bound-list">
          {beads.map((b) => (
            <li key={b.id}>
              <BeadCard bead={b} />
            </li>
          ))}
        </ol>
      ) : (
        <ol className="bound-spine">
          <svg className="bound-thread" viewBox="0 0 12 400" preserveAspectRatio="none" aria-hidden="true">
            <path
              d="M6 0 C5.2 70 6.8 140 6 200 C5.4 270 6.6 330 6 400"
              fill="none"
              stroke="var(--thread, #0c0d0f)"
              strokeWidth="1.15"
              strokeLinecap="round"
            />
          </svg>
          {beads.map((b) => (
            <li key={b.id} className="bound-leaf">
              <span className="bound-hole" aria-hidden title={b.certainty} />
              <BeadCard bead={b} />
            </li>
          ))}
        </ol>
      )}

      <p className="bound-catch">
        catchword · <u>exit</u>
      </p>
    </div>
  );
}

function BeadCard({ bead }: { bead: ChronologyBead }) {
  const certainty =
    bead.certainty === "exact" ? "exact" : bead.certainty === "approximate" ? "approximate" : "unresolved";

  return (
    <article className="bound-entry">
      <div className="folio-kicker">
        {certainty}
        {bead.kind ? ` · ${bead.kind}` : ""}
        {bead.sourceRef ? ` · ${bead.sourceRef}` : ""}
        {bead.duplicateCount && bead.duplicateCount > 1 ? ` · ${bead.duplicateCount} files, one record` : ""}
      </div>
      <h3 className="bound-title">{bead.title}</h3>
      <p className="bound-happened">{bead.happenedLabel}</p>
      {bead.body ? <p className="bound-gloss">{bead.body}</p> : null}
      {(bead.sourceClock || bead.savedClock) && (
        <p className="bound-meta">
          {bead.sourceClock ? `Source clock: ${bead.sourceClock}. ` : ""}
          {bead.savedClock ? `Saved in PatternProof: ${bead.savedClock}.` : ""}
        </p>
      )}
      {bead.unresolved ? <p className="bound-meta">Unresolved: {bead.unresolved}</p> : null}
    </article>
  );
}

function toggleStyle(on: boolean): import("react").CSSProperties {
  return {
    background: on ? "var(--ink)" : "transparent",
    color: on ? "var(--paper)" : "var(--ink)",
    border: "1px solid var(--ink)",
    borderRadius: 0,
    padding: "6px 10px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };
}
