import { createFileRoute, Link } from "@tanstack/react-router";
import { Mic } from "lucide-react";
import { useDemo, formatDemoDate } from "@/lib/demo/demo-store";

export const Route = createFileRoute("/demo/voice-notes")({ component: DemoVoiceNotes });

function DemoVoiceNotes() {
  const { voiceNotes } = useDemo();
  return (
    <div className="grid gap-4">
      <div>
        <div className="eyebrow">Voice notes</div>
        <h1>Spoken records</h1>
        <p style={{ fontSize: 14, marginTop: 4 }}>
          Placeholders for this walkthrough — no audio is recorded or played here.
        </p>
      </div>
      <section className="pp-panel">
        {voiceNotes.length === 0 ? (
          <p className="demo-note">Nothing here yet — when you're ready, this is a safe place to start.</p>
        ) : voiceNotes.map((v) => (
          <div key={v.id} className="demo-row" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "start" }}>
            <div className="pp-kpi__icon"><Mic size={16} /></div>
            <div>
              <strong style={{ fontSize: 13.5 }}>{v.title}</strong>
              <div style={{ fontSize: 12, color: "var(--sv-muted)" }}>{formatDemoDate(v.date)} · {v.duration}</div>
              <p style={{ fontSize: 13, margin: "4px 0 0" }}>{v.note}</p>
            </div>
          </div>
        ))}
      </section>
      <p style={{ fontSize: 12.5 }}>
        Next in the walkthrough: <Link to="/demo/patterns" style={{ fontWeight: 600 }}>Recurrence</Link>
      </p>
    </div>
  );
}
