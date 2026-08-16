import { createFileRoute, Link } from "@tanstack/react-router";
import { NotebookPen, Paperclip, Mic, CalendarClock, ShieldCheck } from "lucide-react";
import { useDemo, byDate, formatDemoDate } from "@/lib/demo/demo-store";
import { recurrenceByCategory } from "@/lib/demo/demo-recurrence";
import { DEMO_PERSON } from "@/lib/demo/demo-data";

export const Route = createFileRoute("/demo/")({ component: DemoDashboard });

function DemoDashboard() {
  const { incidents, evidence, voiceNotes } = useDemo();
  const months = new Set(incidents.map((i) => i.date.slice(0, 7))).size;
  const recent = byDate(incidents).slice(-4).reverse();
  const groups = recurrenceByCategory(incidents).slice(0, 4);

  const kpis = [
    { label: "Records logged", value: incidents.length, hint: "Entries written by Alex", Icon: NotebookPen },
    { label: "Evidence items", value: evidence.length, hint: "Files linked to records", Icon: Paperclip },
    { label: "Voice notes", value: voiceNotes.length, hint: "Spoken accounts", Icon: Mic },
    { label: "Months documented", value: months, hint: "Span of the record", Icon: CalendarClock },
  ];

  return (
    <div className="grid gap-4">
      <div>
        <div className="eyebrow">Demo dashboard</div>
        <h1>Good afternoon, {DEMO_PERSON.survivor.split(" ")[0]}</h1>
        <p style={{ fontSize: 14, marginTop: 4 }}>
          Everything below is fictional sample material for this walkthrough.
        </p>
      </div>

      <div className="pp-kpi-grid">
        {kpis.map(({ label, value, hint, Icon }) => (
          <div key={label} className="pp-kpi">
            <div className="pp-kpi__icon"><Icon size={16} /></div>
            <div className="pp-kpi__value">{value}</div>
            <div className="pp-kpi__label">{label}</div>
            <div className="pp-kpi__hint">{hint}</div>
          </div>
        ))}
      </div>

      <div className="pp-dash-grid">
        <section className="pp-panel">
          <div className="pp-panel__head">
            <div className="pp-panel__title">Recent records</div>
            <Link to="/demo/journal" style={{ fontSize: 12.5, fontWeight: 600 }}>Open journal</Link>
          </div>
          {recent.length === 0 ? (
            <p className="demo-note">Nothing here yet — when you're ready, this is a safe place to start.</p>
          ) : (
            recent.map((i) => (
              <div key={i.id} className="demo-row">
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13.5 }}>{formatDemoDate(i.date)}</strong>
                  <span style={{ fontSize: 12, color: "var(--sv-muted)" }}>{i.time} · {i.location}</span>
                  {i.addedInDemo ? <span className="demo-pill">Added in this demo</span> : null}
                </div>
                <p style={{ fontSize: 13, margin: 0 }}>{i.description}</p>
              </div>
            ))
          )}
        </section>

        <div className="grid gap-4">
          <section className="pp-panel">
            <div className="pp-panel__head">
              <div className="pp-panel__title">How often things recur</div>
              <Link to="/demo/patterns" style={{ fontSize: 12.5, fontWeight: 600 }}>View detail</Link>
            </div>
            {groups.map((g) => (
              <div key={g.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13 }}>
                <span>{g.label}</span>
                <strong>{g.count}</strong>
              </div>
            ))}
            <p className="demo-note" style={{ marginTop: 10 }}>
              Counts of what was recorded, grouped by the category Alex chose. PatternProof does not decide what
              the records mean — that reading belongs to Alex and the people she chooses to share with.
            </p>
          </section>

          <section className="pp-safety-panel">
            <div style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 650, fontSize: 13.5 }}>
              <ShieldCheck size={16} /> Privacy and safety
            </div>
            <p style={{ fontSize: 12.5, marginTop: 6 }}>
              In the real app, records are private to the account holder, protected by per-user access rules,
              and encrypted in transit. Quick Exit stays available on every screen.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
