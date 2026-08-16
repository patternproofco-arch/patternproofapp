import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useDemo, byDate, formatDemoDate } from "@/lib/demo/demo-store";
import { DEMO_PERSON } from "@/lib/demo/demo-data";

export const Route = createFileRoute("/demo/case-builder")({ component: DemoCaseBuilder });

function DemoCaseBuilder() {
  const { incidents, evidence } = useDemo();
  const rows = byDate(incidents);
  const [selected, setSelected] = useState<string[]>(() => rows.map((r) => r.id));

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <div className="grid gap-4">
      <div>
        <div className="eyebrow">Case builder</div>
        <h1>What goes in the packet</h1>
        <p style={{ fontSize: 14, marginTop: 4 }}>Choose which records to include. Alex stays in control of what leaves the app.</p>
      </div>

      <section className="pp-panel">
        <div className="pp-panel__title" style={{ marginBottom: 10 }}>Case details</div>
        <dl style={{ display: "grid", gap: 8, fontSize: 13, margin: 0 }}>
          <Row k="Documented by" v={`${DEMO_PERSON.survivor} (fictional)`} />
          <Row k="Other party" v={`${DEMO_PERSON.otherParty} (fictional)`} />
          <Row k="Matter type" v="Custody — demo scenario" />
          <Row k="Jurisdiction" v={DEMO_PERSON.jurisdiction} />
        </dl>
      </section>

      <section className="pp-panel">
        <div className="pp-panel__head">
          <div className="pp-panel__title">Records to include</div>
          <span style={{ fontSize: 12.5, color: "var(--sv-muted)" }}>{selected.length} of {rows.length} selected</span>
        </div>
        {rows.map((r) => (
          <label key={r.id} className="demo-row" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "start", cursor: "pointer" }}>
            <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} style={{ marginTop: 3 }} />
            <div>
              <strong style={{ fontSize: 13.5 }}>{formatDemoDate(r.date)}</strong>
              <span style={{ fontSize: 12, color: "var(--sv-muted)" }}> · {r.location || "No location noted"}</span>
              <p style={{ fontSize: 12.5, margin: "2px 0 0" }}>{r.description.slice(0, 130)}{r.description.length > 130 ? "…" : ""}</p>
              <span style={{ fontSize: 11.5, color: "var(--sv-muted)" }}>
                {evidence.filter((e) => e.incidentId === r.id).length} evidence item(s) attached
              </span>
            </div>
          </label>
        ))}
      </section>

      <Link to="/demo/court-packet" className="btn-primary" style={{ background: "var(--sv-green-700)", color: "#fff", borderRadius: 10, padding: "11px 16px", fontSize: 13, fontWeight: 600, textAlign: "center", textDecoration: "none", justifySelf: "start" }}>
        Continue to Court Packet
      </Link>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderTop: "1px solid var(--sv-line)", paddingTop: 8 }}>
      <dt style={{ color: "var(--sv-muted)" }}>{k}</dt>
      <dd style={{ margin: 0, fontWeight: 600 }}>{v}</dd>
    </div>
  );
}
