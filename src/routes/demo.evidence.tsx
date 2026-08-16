import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Image, MessageSquare, Mic } from "lucide-react";
import { useDemo, byDate, formatDemoDate } from "@/lib/demo/demo-store";

export const Route = createFileRoute("/demo/evidence")({ component: DemoEvidence });

const ICONS = { photo: Image, screenshot: MessageSquare, document: FileText, audio: Mic } as const;

function DemoEvidence() {
  const { evidence, incidents } = useDemo();
  const rows = byDate(evidence).reverse();
  const label = (id?: string) => {
    const match = incidents.find((i) => i.id === id);
    return match ? `${formatDemoDate(match.date)} — ${match.location}` : null;
  };

  return (
    <div className="grid gap-4">
      <div>
        <div className="eyebrow">Evidence</div>
        <h1>Files and exhibits</h1>
        <p style={{ fontSize: 14, marginTop: 4 }}>
          Fictional placeholders. In the real app these are private files stored per account; nothing is
          uploaded in this demo.
        </p>
      </div>

      <section className="pp-panel">
        {rows.map((e) => {
          const Icon = ICONS[e.kind];
          const linked = label(e.incidentId);
          return (
            <div key={e.id} className="demo-row" style={{ gridTemplateColumns: "auto 1fr", display: "grid", alignItems: "start", gap: 12 }}>
              <div className="pp-kpi__icon"><Icon size={16} /></div>
              <div>
                <strong style={{ fontSize: 13.5 }}>{e.title}</strong>
                <div style={{ fontSize: 12, color: "var(--sv-muted)" }}>{formatDemoDate(e.date)} · {e.note}</div>
                <div style={{ marginTop: 6 }}>
                  {linked
                    ? <span className="demo-pill">Linked to record: {linked}</span>
                    : <span className="demo-pill" style={{ background: "#F4F2EE", color: "var(--sv-muted)" }}>Not linked to a record yet</span>}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <p style={{ fontSize: 12.5 }}>
        Next in the walkthrough: <Link to="/demo/timeline" style={{ fontWeight: 600 }}>Timeline</Link>
      </p>
    </div>
  );
}
