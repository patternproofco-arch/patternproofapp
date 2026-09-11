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
    <div data-pp-thread="">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: "var(--pp-muted)" }}>
          Exact dates sit on the line. Approximate dates stay wide. The thread does not guess.
        </p>
        <div style={{ display: "flex", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <button type="button" onClick={() => setView("thread")} style={toggleStyle(view === "thread")}>
            Thread
          </button>
          <button type="button" onClick={() => setView("list")} style={toggleStyle(view === "list")}>
            List
          </button>
        </div>
      </div>

      {view === "list" ? (
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {beads.map((b) => (
            <li key={b.id}>
              <BeadCard bead={b} />
            </li>
          ))}
        </ol>
      ) : (
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: "4px 0 4px 28px",
            position: "relative",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 7,
              top: 8,
              bottom: 8,
              width: 2,
              background: "var(--pp-shadow-dark)",
            }}
          />
          {beads.map((b) => (
            <li key={b.id} style={{ position: "relative", marginBottom: 16 }}>
              <span
                aria-hidden
                title={b.certainty}
                style={{
                  position: "absolute",
                  left: -28,
                  top: 18,
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: knotColor(b.certainty),
                  border: b.certainty === "approximate" ? "2px dashed var(--pp-ink)" : "2px solid var(--pp-card)",
                  boxSizing: "border-box",
                }}
              />
              <BeadCard bead={b} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function BeadCard({ bead }: { bead: ChronologyBead }) {
  return (
    <article
      style={{
        background: "var(--pp-card)",
        boxShadow: "var(--pp-shadow-sm)",
        borderRadius: 16,
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--pp-muted)",
        }}
      >
        {bead.certainty === "exact" ? "Exact" : bead.certainty === "approximate" ? "About / week of" : "Date unresolved"}
        {bead.kind ? ` · ${bead.kind}` : ""}
        {bead.sourceRef ? ` · ${bead.sourceRef}` : ""}
        {bead.duplicateCount && bead.duplicateCount > 1 ? ` · ${bead.duplicateCount} files, one record` : ""}
      </div>
      <h3 style={{ margin: "6px 0 4px", fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 20 }}>
        {bead.title}
      </h3>
      <p style={{ margin: 0, fontSize: 14 }}>{bead.happenedLabel}</p>
      {(bead.sourceClock || bead.savedClock) && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--pp-muted)" }}>
          {bead.sourceClock ? `Source clock: ${bead.sourceClock}. ` : ""}
          {bead.savedClock ? `Saved in PatternProof: ${bead.savedClock}.` : ""}
        </p>
      )}
      {bead.body && <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.5 }}>{bead.body}</p>}
      {bead.unresolved && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--pp-muted)" }}>
          Unresolved: {bead.unresolved}
        </p>
      )}
    </article>
  );
}

function knotColor(c: DateCertainty) {
  if (c === "exact") return "var(--pp-ink)";
  if (c === "approximate") return "transparent";
  return "var(--pp-muted)";
}

function toggleStyle(on: boolean): import("react").CSSProperties {
  return {
    background: on ? "var(--pp-ink)" : "transparent",
    color: on ? "var(--pp-ground)" : "var(--pp-ink)",
    border: "1px solid var(--pp-ink)",
    borderRadius: 999,
    padding: "6px 10px",
    cursor: "pointer",
  };
}
