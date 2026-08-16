import { createFileRoute, Link } from "@tanstack/react-router";
import { useDemo, formatDemoDate } from "@/lib/demo/demo-store";
import { recurrenceByCategory, recordsPerMonth } from "@/lib/demo/demo-recurrence";

export const Route = createFileRoute("/demo/patterns")({ component: DemoPatterns });

function DemoPatterns() {
  const { incidents } = useDemo();
  const groups = recurrenceByCategory(incidents);
  const months = recordsPerMonth(incidents);
  const peak = Math.max(1, ...months.map((m) => m.count));

  return (
    <div className="grid gap-4">
      <div>
        <div className="eyebrow">Recurrence</div>
        <h1>How often, and when</h1>
        <p style={{ fontSize: 14, marginTop: 4 }}>
          Counts and dates drawn from the records above.
        </p>
      </div>

      <div className="demo-note">
        PatternProof reports frequency and recurrence only. It does not decide that anything here is abuse,
        does not diagnose anyone, and does not predict what a court will do. Reading meaning into these counts
        is the job of the survivor and the professionals she chooses.
      </div>

      <section className="pp-panel">
        <div className="pp-panel__title" style={{ marginBottom: 12 }}>Records by category</div>
        {groups.map((g) => (
          <div key={g.label} className="demo-row">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 600 }}>
              <span>{g.label}</span><span>{g.count} record{g.count === 1 ? "" : "s"}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--sv-muted)" }}>
              {g.dates.map((d) => formatDemoDate(d)).join(" · ")}
            </div>
          </div>
        ))}
      </section>

      <section className="pp-panel">
        <div className="pp-panel__title" style={{ marginBottom: 12 }}>Records per month</div>
        {months.map((m) => (
          <div key={m.month} style={{ display: "grid", gridTemplateColumns: "96px 1fr 28px", gap: 10, alignItems: "center", padding: "6px 0" }}>
            <span style={{ fontSize: 12.5, color: "var(--sv-ink-2)" }}>
              {new Date(`${m.month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}
            </span>
            <div className="demo-bar-track">
              <div className="demo-bar" style={{ width: `${(m.count / peak) * 100}%` }} />
            </div>
            <strong style={{ fontSize: 12.5, textAlign: "right" }}>{m.count}</strong>
          </div>
        ))}
      </section>

      <p style={{ fontSize: 12.5 }}>
        Next in the walkthrough: <Link to="/demo/case-builder" style={{ fontWeight: 600 }}>Case Builder</Link>
      </p>
    </div>
  );
}
