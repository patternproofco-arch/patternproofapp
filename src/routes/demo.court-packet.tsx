import { createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { useDemo, byDate, formatDemoDate } from "@/lib/demo/demo-store";
import { DEMO_PERSON } from "@/lib/demo/demo-data";
import { recurrenceByCategory } from "@/lib/demo/demo-recurrence";

export const Route = createFileRoute("/demo/court-packet")({ component: DemoCourtPacket });

function DemoCourtPacket() {
  const { incidents, evidence } = useDemo();
  const rows = byDate(incidents);
  const groups = recurrenceByCategory(incidents);

  return (
    <div className="grid gap-4">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">Court packet</div>
          <h1>Packet preview</h1>
          <p style={{ fontSize: 14, marginTop: 4 }}>
            A plain, dated summary Alex can print or hand to an attorney.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary no-print"
          onClick={() => window.print()}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--sv-green-700)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <Printer size={15} /> Print / save as PDF
        </button>
      </div>

      <section className="pp-panel">
        <div style={{ borderBottom: "2px solid var(--sv-ink)", paddingBottom: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7A1F3D" }}>
            Demo — fictional data · not a real case record
          </div>
          <h2 style={{ margin: "6px 0 0" }}>Documentation summary</h2>
          <div style={{ fontSize: 12.5, color: "var(--sv-muted)" }}>
            Prepared by {DEMO_PERSON.survivor} · Other party {DEMO_PERSON.otherParty} · {DEMO_PERSON.jurisdiction}
          </div>
        </div>

        <h3 style={{ fontSize: 14 }}>1. What this document is</h3>
        <p style={{ fontSize: 13 }}>
          A chronological list of records the author wrote, with the evidence attached to each one, plus counts of
          how often records of each category occur. It contains no legal conclusion and no assessment of anyone's
          conduct or intent.
        </p>

        <h3 style={{ fontSize: 14, marginTop: 16 }}>2. Record counts by category</h3>
        <ul style={{ fontSize: 13, paddingLeft: 18, margin: 0 }}>
          {groups.map((g) => (
            <li key={g.label}>{g.label}: {g.count} record{g.count === 1 ? "" : "s"} ({g.span})</li>
          ))}
        </ul>

        <h3 style={{ fontSize: 14, marginTop: 16 }}>3. Records in date order</h3>
        {rows.map((r, idx) => {
          const files = evidence.filter((e) => e.incidentId === r.id);
          return (
            <div key={r.id} style={{ borderTop: "1px solid var(--sv-line)", padding: "10px 0" }}>
              <strong style={{ fontSize: 13 }}>
                {idx + 1}. {formatDemoDate(r.date)} — {r.time}{r.location ? ` — ${r.location}` : ""}
              </strong>
              <p style={{ fontSize: 13, margin: "3px 0" }}>{r.description}</p>
              {r.witnesses ? <p style={{ fontSize: 12, margin: 0, color: "var(--sv-muted)" }}>Witnesses: {r.witnesses}</p> : null}
              <p style={{ fontSize: 12, margin: 0, color: "var(--sv-muted)" }}>
                Categories: {r.categories.join(", ")}
                {files.length ? ` · Evidence: ${files.map((f) => f.title).join("; ")}` : " · No evidence attached"}
              </p>
            </div>
          );
        })}

        <h3 style={{ fontSize: 14, marginTop: 16 }}>4. Limits of this document</h3>
        <p style={{ fontSize: 13, margin: 0 }}>
          These are the author's own records. PatternProof does not verify events, does not determine whether abuse
          occurred, offers no legal advice, and makes no claim about admissibility or outcome. This demo packet is
          fictional throughout.
        </p>
      </section>
    </div>
  );
}
