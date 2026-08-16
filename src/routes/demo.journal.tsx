import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useDemo, byDate, formatDemoDate } from "@/lib/demo/demo-store";
import { DEMO_CATEGORIES } from "@/lib/demo/demo-data";

export const Route = createFileRoute("/demo/journal")({ component: DemoJournal });

const EMPTY = { date: "2026-08-12", time: "7:30 PM", location: "", description: "", witnesses: "", impact: "" };

function DemoJournal() {
  const { incidents, addIncident } = useDemo();
  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const rows = byDate(incidents).reverse();

  const toggle = (c: string) =>
    setCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const save = () => {
    if (!form.description.trim()) {
      toast("Add a short description first — even a sentence is enough.");
      return;
    }
    addIncident({ ...form, categories: categories.length ? categories : ["Emotional"] });
    setForm(EMPTY);
    setCategories([]);
    setOpen(false);
    toast("Saved. Your record is safe.");
  };

  return (
    <div className="grid gap-4">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">Journal</div>
          <h1>Records</h1>
          <p style={{ fontSize: 14, marginTop: 4 }}>Written in Alex's own words, kept in date order.</p>
        </div>
        <button type="button" className="btn-primary" style={btn} onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Log an incident"}
        </button>
      </div>

      {open ? (
        <section className="pp-panel">
          <div className="pp-panel__title" style={{ marginBottom: 12 }}>Log an incident</div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Field label="Date"><input style={input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Time"><input style={input} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
            <Field label="Where it happened"><input style={input} placeholder="Home — kitchen" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="What happened">
              <textarea style={{ ...input, minHeight: 96 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe it however feels natural. There's no wrong way." />
            </Field>
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <Field label="Anyone who saw or heard it"><input style={input} value={form.witnesses} onChange={(e) => setForm({ ...form, witnesses: e.target.value })} /></Field>
            <Field label="How it affected you"><input style={input} value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} /></Field>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {DEMO_CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => toggle(c)} className="demo-mobilenav__item" data-active={categories.includes(c)} style={{ cursor: "pointer" }}>
                {c}
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary" style={{ ...btn, marginTop: 14 }} onClick={save}>Save record</button>
        </section>
      ) : null}

      <section className="pp-panel">
        {rows.length === 0 ? (
          <p className="demo-note">Nothing here yet — when you're ready, this is a safe place to start.</p>
        ) : (
          rows.map((i) => (
            <article key={i.id} className="demo-row">
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 13.5 }}>{formatDemoDate(i.date)}</strong>
                <span style={{ fontSize: 12, color: "var(--sv-muted)" }}>{i.time}{i.location ? ` · ${i.location}` : ""}</span>
                {i.addedInDemo ? <span className="demo-pill">Added in this demo</span> : null}
              </div>
              <p style={{ fontSize: 13, margin: "2px 0" }}>{i.description}</p>
              {i.witnesses ? <p style={{ fontSize: 12, margin: 0, color: "var(--sv-muted)" }}>Witnesses: {i.witnesses}</p> : null}
              {i.impact ? <p style={{ fontSize: 12, margin: 0, color: "var(--sv-muted)" }}>Impact: {i.impact}</p> : null}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                {i.categories.map((c) => <span key={c} className="demo-pill">{c}</span>)}
              </div>
            </article>
          ))
        )}
      </section>

      <p style={{ fontSize: 12.5 }}>
        Next in the walkthrough: <Link to="/demo/evidence" style={{ fontWeight: 600 }}>Evidence</Link>
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--sv-ink-2)" }}>
      {label}
      {children}
    </label>
  );
}

const input: React.CSSProperties = {
  border: "1px solid var(--sv-line-strong)", borderRadius: 10, padding: "9px 11px",
  fontSize: 13, fontWeight: 400, background: "#fff", width: "100%",
};
const btn: React.CSSProperties = {
  background: "var(--sv-green-700)", color: "#fff", borderRadius: 10,
  padding: "10px 16px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
};
