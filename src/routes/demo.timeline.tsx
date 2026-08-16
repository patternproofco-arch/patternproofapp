import { createFileRoute, Link } from "@tanstack/react-router";
import { useDemo, byDate, formatDemoDate } from "@/lib/demo/demo-store";

export const Route = createFileRoute("/demo/timeline")({ component: DemoTimeline });

function DemoTimeline() {
  const { incidents, evidence } = useDemo();
  const rows = byDate(incidents);
  const months = [...new Set(rows.map((r) => r.date.slice(0, 7)))];

  return (
    <div className="grid gap-4">
      <div>
        <div className="eyebrow">Timeline</div>
        <h1>In order, as it happened</h1>
        <p style={{ fontSize: 14, marginTop: 4 }}>Records sorted by date, with any evidence attached to each one.</p>
      </div>

      {months.map((month) => (
        <section key={month} className="pp-panel">
          <div className="pp-panel__title" style={{ marginBottom: 10 }}>
            {new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
          </div>
          {rows.filter((r) => r.date.startsWith(month)).map((r) => {
            const files = evidence.filter((e) => e.incidentId === r.id);
            return (
              <div key={r.id} className="demo-row" style={{ borderLeft: "3px solid var(--sv-green-500)", paddingLeft: 12, borderTop: "none", marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13.5 }}>{formatDemoDate(r.date)}</strong>
                  <span style={{ fontSize: 12, color: "var(--sv-muted)" }}>{r.time}{r.location ? ` · ${r.location}` : ""}</span>
                  {r.addedInDemo ? <span className="demo-pill">Added in this demo</span> : null}
                </div>
                <p style={{ fontSize: 13, margin: "2px 0" }}>{r.description}</p>
                {files.length ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {files.map((f) => <span key={f.id} className="demo-pill">{f.title}</span>)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}

      <p style={{ fontSize: 12.5 }}>
        Next in the walkthrough: <Link to="/demo/patterns" style={{ fontWeight: 600 }}>Recurrence</Link>
      </p>
    </div>
  );
}
