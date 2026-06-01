import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Circle, Clock, Download, FileText,
  Flag, HelpCircle, Image as ImageIcon, Music, Paperclip, Printer, Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  getClientCase, generateDepositionPrep, getSignedEvidenceUrl,
  listAttorneyNotes, upsertAttorneyNote,
} from "@/lib/attorney-portal.functions";
import { typeLabel } from "@/lib/abuse-types";
import { toast } from "sonner";

export const Route = createFileRoute("/_attorney/clients/$clientId")({
  component: ClientCaseView,
});

type CaseData = Awaited<ReturnType<typeof getClientCase>>;
type DepoResult = Awaited<ReturnType<typeof generateDepositionPrep>>;
type NoteRow = { incident_id: string; note: string | null; flagged: boolean; reviewed: boolean };

const TABS = [
  "Overview", "Timeline", "Patterns", "Checklist", "Gaps", "Evidence", "Deposition", "Export",
] as const;
type Tab = (typeof TABS)[number];

function ClientCaseView() {
  const { clientId } = useParams({ from: "/_attorney/clients/$clientId" });
  const fetcher = useServerFn(getClientCase);
  const depoFn = useServerFn(generateDepositionPrep);
  const notesFn = useServerFn(listAttorneyNotes);
  const [data, setData] = useState<CaseData | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [depo, setDepo] = useState<DepoResult | null>(null);
  const [depoLoading, setDepoLoading] = useState(false);
  const [notes, setNotes] = useState<NoteRow[]>([]);

  useEffect(() => {
    fetcher({ data: { clientId } }).then(setData).catch(() => toast("Couldn't load case."));
    notesFn({ data: { clientId } }).then((r) => setNotes(r.notes)).catch(() => {});
  }, [fetcher, notesFn, clientId]);

  const runDepo = async () => {
    setDepoLoading(true);
    try {
      const r = await depoFn({ data: { clientId } });
      setDepo(r);
      if (!r.ok) toast("Couldn't generate prep: " + r.reason);
    } finally { setDepoLoading(false); }
  };

  if (!data) return <div className="att-card">Loading case file…</div>;

  const caseId = `PP-${clientId.slice(0, 4).toUpperCase()}`;
  const riskColor: Record<string, string> = {
    low: "#10B981", moderate: "#FBBF24", elevated: "#F59E0B", high: "#EF4444",
  };

  return (
    <div>
      <Link to="/clients" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--att-slate)", textDecoration: "none" }}>
        <ArrowLeft size={12} /> All clients
      </Link>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginTop: 12 }}>
        <div>
          <div className="att-eyebrow">Case File</div>
          <h1 style={{ fontSize: 30, marginTop: 4 }}>Client {clientId.slice(0, 8)}</h1>
          <div style={{ fontSize: 12, color: "var(--att-text-2)" }}>
            <span className="att-mono">{caseId}</span>
            {data.incidents.length > 0 && (
              <> · {data.incidents.length} incidents · {data.evidence.length} evidence items</>
            )}
          </div>
        </div>
        <span className="att-tag" style={{ background: `${riskColor[data.risk_level]}1A`, color: riskColor[data.risk_level] }}>
          {data.risk_level.toUpperCase()} RISK
        </span>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", marginTop: 18 }}>
        <Metric label="Incidents" v={data.incidents.length} />
        <Metric label="Evidence" v={data.evidence.length} />
        <Metric label="Last 30 days" v={data.last_30_days} />
        <Metric label="Avg severity" v={data.avg_severity.toFixed(1)} />
        <Metric label="Active flags" v={data.flags.filter((f) => !f.dismissed_at).length} />
      </div>

      <nav style={{ display: "flex", flexWrap: "wrap", gap: 2, borderBottom: "1px solid var(--att-border)", marginTop: 28 }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 14px", fontSize: 13, fontWeight: tab === t ? 600 : 500,
              color: tab === t ? "var(--att-navy)" : "var(--att-text-2)",
              borderBottom: tab === t ? "2px solid var(--att-navy)" : "2px solid transparent",
              background: "transparent", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {t}
          </button>
        ))}
      </nav>

      <div style={{ marginTop: 20 }}>
        {tab === "Overview" && <Overview data={data} />}
        {tab === "Timeline" && <TimelineTab data={data} clientId={clientId} notes={notes} onNotes={setNotes} />}
        {tab === "Patterns" && <Patterns data={data} />}
        {tab === "Checklist" && <ChecklistTab data={data} />}
        {tab === "Gaps" && <Gaps data={data} />}
        {tab === "Evidence" && <EvidenceTab data={data} clientId={clientId} />}
        {tab === "Deposition" && <DepoTab depo={depo} loading={depoLoading} onRun={runDepo} />}
        {tab === "Export" && <ExportTab data={data} caseId={caseId} />}
      </div>
    </div>
  );
}

/* ---------------- shared atoms ---------------- */

function Metric({ label, v, help }: { label: string; v: number | string; help?: string }) {
  return (
    <div className="att-card" style={{ padding: 14 }} title={help}>
      <div className="att-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}{help && <HelpCircle size={10} style={{ opacity: 0.6 }} />}
      </div>
      <div style={{ fontSize: 26, fontFamily: '"Instrument Serif", serif', marginTop: 4 }}>{v}</div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      {icon}
      <h2 style={{ fontSize: 20 }}>{children}</h2>
    </div>
  );
}

/* ---------------- Overview ---------------- */

function Overview({ data }: { data: CaseData }) {
  const recent = data.incidents.slice(-6).reverse();
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)" }}>
      <div style={{ display: "grid", gap: 16 }}>
        {data.case?.pattern_summary && (
          <div className="att-card">
            <div className="att-eyebrow">Client summary</div>
            <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{data.case.pattern_summary}</p>
          </div>
        )}
        <div className="att-card">
          <SectionTitle icon={<FileText size={16} />}>Recent incidents</SectionTitle>
          <ul style={{ display: "grid", gap: 10, listStyle: "none", padding: 0, margin: 0 }}>
            {recent.length === 0 && <li style={{ color: "var(--att-text-2)", fontSize: 13 }}>No incidents documented yet.</li>}
            {recent.map((i) => (
              <li key={i.id} style={{ borderLeft: "3px solid var(--att-navy)", paddingLeft: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {new Date(i.date).toLocaleDateString()}
                  {i.severity_level ? ` · severity ${i.severity_level}` : ""}
                </div>
                <div style={{ fontSize: 13, color: "var(--att-text-2)", marginTop: 2 }}>{i.description?.slice(0, 220)}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div style={{ display: "grid", gap: 16 }}>
        <div className="att-card">
          <div className="att-eyebrow">Case info</div>
          <dl style={{ marginTop: 10, fontSize: 13, display: "grid", gap: 8 }}>
            <Row k="Other party" v={data.case?.other_party ?? "—"} />
            <Row k="Jurisdiction" v={data.case?.jurisdiction ?? "—"} />
            <Row k="Relationship" v={data.case?.relationship_type ?? "—"} />
            <Row k="Span" v={data.timeline.length > 0 ? `${data.timeline[0].month} – ${data.timeline[data.timeline.length - 1].month}` : "—"} />
          </dl>
        </div>
        <div className="att-card" style={{ background: "#F8FAFC" }}>
          <div className="att-eyebrow">Quick actions</div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <button className="att-btn-secondary" onClick={() => window.print()}>
              <Printer size={13} /> Print case file
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <dt style={{ color: "var(--att-text-2)" }}>{k}</dt>
      <dd style={{ fontWeight: 500, textAlign: "right" }}>{v}</dd>
    </div>
  );
}

/* ---------------- Timeline (with attorney private notes) ---------------- */

function TimelineTab({ data, clientId, notes, onNotes }: { data: CaseData; clientId: string; notes: NoteRow[]; onNotes: (n: NoteRow[]) => void }) {
  const upsert = useServerFn(upsertAttorneyNote);

  const byMonth = useMemo(() => {
    const m: Record<string, CaseData["incidents"]> = {};
    for (const i of [...data.incidents].sort((a, b) => b.date.localeCompare(a.date))) {
      const k = i.date.slice(0, 7);
      (m[k] ??= []).push(i);
    }
    return m;
  }, [data.incidents]);

  const noteMap = useMemo(() => Object.fromEntries(notes.map((n) => [n.incident_id, n])), [notes]);

  const update = async (incidentId: string, patch: Partial<NoteRow>) => {
    const current = noteMap[incidentId] ?? { incident_id: incidentId, note: null, flagged: false, reviewed: false };
    const next = { ...current, ...patch };
    const others = notes.filter((n) => n.incident_id !== incidentId);
    onNotes([...others, next]);
    try {
      await upsert({ data: { clientId, incidentId, ...patch } });
    } catch {
      toast("Couldn't save note.");
    }
  };

  return (
    <div className="att-card">
      <SectionTitle icon={<TrendingUp size={16} />}>Incident timeline</SectionTitle>
      {data.incidents.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>No incidents documented.</p>
      ) : (
        Object.entries(byMonth).map(([month, items]) => (
          <section key={month} style={{ marginBottom: 24 }}>
            <div className="att-eyebrow" style={{ marginBottom: 8 }}>
              {new Date(month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })} · {items.length} incident{items.length === 1 ? "" : "s"}
            </div>
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
              {items.map((i) => {
                const n = noteMap[i.id];
                const evCount = data.evidence.filter((e) => e.linked_incident_id === i.id).length;
                return (
                  <li key={i.id} style={{ borderLeft: "3px solid var(--att-navy)", padding: "10px 14px", background: "#F8FAFC", borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {new Date(i.date).toLocaleDateString()}
                          {i.severity_level ? ` · severity ${i.severity_level}` : ""}
                        </div>
                        {i.abuse_types?.length ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                            {i.abuse_types.map((t) => (
                              <span key={t} className={`att-tag att-tag-${t}`}>{typeLabel(t)}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="att-btn-ghost"
                          style={{ color: n?.flagged ? "#EF4444" : "var(--att-text-2)" }}
                          onClick={() => update(i.id, { flagged: !n?.flagged })}
                          title="Flag for review"
                        >
                          <Flag size={13} />
                        </button>
                        <button
                          className="att-btn-ghost"
                          style={{ color: n?.reviewed ? "var(--att-green)" : "var(--att-text-2)" }}
                          onClick={() => update(i.id, { reviewed: !n?.reviewed })}
                          title="Mark reviewed"
                        >
                          <CheckCircle2 size={13} />
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: 13, marginTop: 6, color: "var(--att-text)" }}>{i.description}</p>
                    {i.location && <div style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 4 }}>Location: {i.location}</div>}
                    {i.witnesses && <div style={{ fontSize: 12, color: "var(--att-text-2)" }}>Witnesses: {i.witnesses}</div>}
                    {evCount > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <span className="att-tag att-tag-auth">{evCount} evidence file{evCount === 1 ? "" : "s"} authenticated</span>
                      </div>
                    )}
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ fontSize: 12, color: "var(--att-navy)", cursor: "pointer" }}>
                        Attorney note {n?.note ? "·" : ""} {n?.note ? "saved" : "(private)"}
                      </summary>
                      <textarea
                        className="att-textarea"
                        defaultValue={n?.note ?? ""}
                        placeholder="Private note — never visible to the client."
                        onBlur={(e) => { if (e.target.value !== (n?.note ?? "")) update(i.id, { note: e.target.value }); }}
                        style={{ marginTop: 6 }}
                      />
                    </details>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}

/* ---------------- Patterns ---------------- */

function Patterns({ data }: { data: CaseData }) {
  const max = Math.max(1, ...data.categories.map((c) => c.count));
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="att-card">
        <SectionTitle icon={<TrendingUp size={16} />}>Behavior categories</SectionTitle>
        {data.categories.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>Not enough data to categorize yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {[...data.categories].sort((a, b) => b.count - a.count).map((c) => (
              <div key={c.type}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{c.type}</span>
                  <span className="att-mono" style={{ color: "var(--att-text-2)" }}>{c.count}</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "var(--att-border)", marginTop: 4 }}>
                  <div style={{ height: "100%", borderRadius: 999, width: `${(c.count / max) * 100}%`, background: "var(--att-navy)" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="att-card">
        <SectionTitle>Monthly frequency</SectionTitle>
        <div style={{ display: "grid", gap: 4 }}>
          {data.timeline.length === 0 && <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>No dated incidents yet.</p>}
          {data.timeline.map((m) => {
            const tMax = Math.max(1, ...data.timeline.map((x) => x.count));
            return (
              <div key={m.month} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                <div style={{ width: 80, color: "var(--att-text-2)" }} className="att-mono">{m.month}</div>
                <div style={{ flex: 1, height: 6, background: "var(--att-border)", borderRadius: 999 }}>
                  <div style={{ height: "100%", borderRadius: 999, width: `${(m.count / tMax) * 100}%`, background: m.avg_severity >= 3 ? "#EF4444" : "var(--att-navy-mid)" }} />
                </div>
                <div style={{ width: 90, textAlign: "right" }}>{m.count} · sev {m.avg_severity.toFixed(1)}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="att-card" style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}>
        <div className="att-eyebrow" style={{ color: "#1E40AF" }}>Legal framing</div>
        <p style={{ fontSize: 13, marginTop: 6, color: "#1E3A8A", lineHeight: 1.6 }}>
          The frequency, breadth, and escalation pattern shown above is consistent with the coercive-control framework
          recognized in many jurisdictions. Use this to argue systematic control rather than isolated conflict.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Checklist ---------------- */

function ChecklistTab({ data }: { data: CaseData }) {
  const docCount = data.checklist.filter((r) => r.documented).length;
  return (
    <div className="att-card">
      <SectionTitle>Coercive control checklist <span style={{ fontSize: 12, color: "var(--att-text-2)", fontFamily: "inherit" }}>· Stark framework</span></SectionTitle>
      <p style={{ fontSize: 13, color: "var(--att-text-2)", marginBottom: 14 }}>
        {docCount} of {data.checklist.length} mechanisms documented.
      </p>
      <ul style={{ display: "grid", gap: 10, listStyle: "none", padding: 0, margin: 0 }}>
        {data.checklist.map((row) => (
          <li key={row.item} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
            {row.documented
              ? <CheckCircle2 size={16} style={{ color: "var(--att-green)", marginTop: 2 }} />
              : <Circle size={16} style={{ color: "var(--att-muted)", marginTop: 2 }} />}
            <div>
              <div>{row.item}</div>
              <div style={{ fontSize: 11, color: "var(--att-text-2)" }}>
                {row.documented ? `${row.count} incident${row.count === 1 ? "" : "s"} documented` : "No documented incidents"}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Gaps ---------------- */

function Gaps({ data }: { data: CaseData }) {
  return (
    <div className="att-card">
      <SectionTitle icon={<AlertTriangle size={16} style={{ color: "#F59E0B" }} />}>Evidence gaps</SectionTitle>
      {data.gaps.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--att-green)" }}>No critical gaps detected.</p>
      ) : (
        <ul style={{ display: "grid", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
          {data.gaps.map((g, i) => (
            <li key={i} style={{ borderLeft: "3px solid #F59E0B", paddingLeft: 12 }}>
              <strong style={{ fontSize: 13 }}>{g.kind}</strong>
              <div style={{ fontSize: 13, color: "var(--att-text-2)" }}>{g.detail}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Evidence vault ---------------- */

function EvidenceTab({ data, clientId }: { data: CaseData; clientId: string }) {
  const signedFn = useServerFn(getSignedEvidenceUrl);
  type Cat = "All" | "Photos" | "Screenshots" | "Documents" | "Audio";
  const [cat, setCat] = useState<Cat>("All");
  const [openingId, setOpeningId] = useState<string | null>(null);

  const matches = (type: string, cat: Cat) => {
    const t = (type || "").toLowerCase();
    if (cat === "All") return true;
    if (cat === "Photos") return t.startsWith("image/") && !t.includes("png");
    if (cat === "Screenshots") return t.includes("png") || t.includes("image/png");
    if (cat === "Audio") return t.startsWith("audio/");
    if (cat === "Documents") return t.includes("pdf") || t.includes("document") || t.includes("text/");
    return true;
  };

  const items = data.evidence.filter((e) => matches(e.file_type, cat));

  const open = async (id: string) => {
    setOpeningId(id);
    try {
      const r = await signedFn({ data: { clientId, evidenceId: id } });
      if (r.url) window.open(r.url, "_blank", "noopener");
      else toast("Couldn't generate signed URL.");
    } catch { toast("Couldn't open file."); }
    finally { setOpeningId(null); }
  };

  const icon = (type: string) => {
    const t = (type || "").toLowerCase();
    if (t.startsWith("image/")) return <ImageIcon size={18} />;
    if (t.startsWith("audio/")) return <Music size={18} />;
    return <Paperclip size={18} />;
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {(["All", "Photos", "Screenshots", "Documents", "Audio"] as Cat[]).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cat === c ? "att-btn-primary" : "att-btn-secondary"}
            style={{ padding: "6px 12px", fontSize: 12 }}
          >{c}</button>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="att-card" style={{ textAlign: "center", color: "var(--att-text-2)", fontSize: 13 }}>
          No evidence in this category.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
          {items.map((e) => (
            <div key={e.id} className="att-card att-hover" style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--att-text-2)" }}>
                {icon(e.file_type)}
                <span className="att-mono" style={{ fontSize: 10, textTransform: "uppercase" }}>{e.file_type || "file"}</span>
              </div>
              <h3 style={{ fontSize: 16, marginTop: 8 }}>{e.title}</h3>
              <div style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 2 }}>
                {new Date(e.date).toLocaleDateString()}
                {e.linked_incident_id ? " · linked to incident" : " · unlinked"}
              </div>
              {e.description && <p style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 8 }}>{e.description.slice(0, 120)}</p>}
              <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
                <button className="att-btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }} disabled={openingId === e.id} onClick={() => open(e.id)}>
                  <Download size={12} /> {openingId === e.id ? "Opening…" : "Open"}
                </button>
                <span className="att-tag att-tag-auth" style={{ alignSelf: "center" }}>AUTH</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Deposition ---------------- */

function DepoTab({ depo, loading, onRun }: { depo: DepoResult | null; loading: boolean; onRun: () => void }) {
  return (
    <div className="att-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <SectionTitle icon={<Sparkles size={16} />}>AI deposition prep</SectionTitle>
        <button onClick={onRun} disabled={loading} className="att-btn-primary">
          {loading ? "Analyzing…" : depo ? "Re-run analysis" : "Generate prep"}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--att-text-2)" }}>
        Surfaces chronology strengths, credibility gaps, and likely cross-examination angles. Internal work product.
      </p>
      {depo && !depo.ok && (
        <p style={{ marginTop: 12, fontSize: 13, color: "#EF4444" }}>Couldn't generate: {depo.reason}</p>
      )}
      {depo?.ok && depo.prep && (
        <div style={{ marginTop: 18, display: "grid", gap: 18, fontSize: 13 }}>
          <DepoSection title="Chronology strengths" items={depo.prep.chronology_strengths} />
          <DepoComplex title="Weak spots" items={depo.prep.weak_spots} keys={["issue", "risk", "suggested_fix"]} />
          <DepoComplex title="Credibility gaps" items={depo.prep.credibility_gaps} keys={["gap", "address_before_testimony"]} />
          <DepoSection title="Direct examination questions" items={depo.prep.prep_questions} ordered />
          <DepoSection title="Cross-examination warnings" items={depo.prep.cross_warnings} />
        </div>
      )}
    </div>
  );
}

function DepoSection({ title, items, ordered }: { title: string; items?: string[]; ordered?: boolean }) {
  if (!items?.length) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <div>
      <h3 style={{ fontSize: 16, marginBottom: 6 }}>{title}</h3>
      <Tag style={{ paddingLeft: 20, display: "grid", gap: 4 }}>
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </Tag>
    </div>
  );
}

function DepoComplex({ title, items, keys }: { title: string; items?: Array<Record<string, string>>; keys: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 style={{ fontSize: 16, marginBottom: 6 }}>{title}</h3>
      <ul style={{ display: "grid", gap: 8, listStyle: "none", padding: 0 }}>
        {items.map((row, i) => (
          <li key={i} style={{ borderLeft: "3px solid #F59E0B", paddingLeft: 12 }}>
            {keys.map((k) => (
              <div key={k}><span className="att-eyebrow">{k.replace(/_/g, " ")}: </span>{row[k]}</div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Export ---------------- */

function ExportTab({ data, caseId }: { data: CaseData; caseId: string }) {
  const [include, setInclude] = useState({
    overview: true, timeline: true, patterns: true, checklist: true, gaps: true, evidence: true,
  });
  const [format, setFormat] = useState<"pdf" | "print" | "word">("print");
  const [certify, setCertify] = useState(false);

  const toggle = (k: keyof typeof include) => setInclude((s) => ({ ...s, [k]: !s[k] }));

  const generate = () => {
    if (format === "word") {
      toast("Word export coming soon — use Print → Save as PDF for now.");
      return;
    }
    window.print();
  };

  const Item = ({ k, label, note }: { k: keyof typeof include; label: string; note: string }) => (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 10, borderRadius: 8, background: include[k] ? "#F8FAFC" : "transparent", border: "1px solid var(--att-border)" }}>
      <input type="checkbox" checked={include[k]} onChange={() => toggle(k)} style={{ marginTop: 3 }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--att-text-2)" }}>{note}</div>
      </div>
    </label>
  );

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)" }}>
      <div className="att-card">
        <SectionTitle icon={<Printer size={16} />}>Court-ready export</SectionTitle>
        <div style={{ display: "grid", gap: 8 }}>
          <Item k="overview" label="Case overview & summary" note="Hero stats, client summary, jurisdiction." />
          <Item k="timeline" label="Full incident timeline" note={`${data.incidents.length} incidents grouped by month.`} />
          <Item k="patterns" label="Pattern analysis" note="Behavior categories, monthly frequency." />
          <Item k="checklist" label="Coercive control checklist" note="Stark framework documentation status." />
          <Item k="gaps" label="Evidence gaps" note={`${data.gaps.length} gaps flagged.`} />
          <Item k="evidence" label="Evidence index" note={`${data.evidence.length} authenticated files (titles + metadata).`} />
        </div>

        <div style={{ marginTop: 18 }}>
          <div className="att-eyebrow">Format</div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {(["print", "pdf", "word"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={format === f ? "att-btn-primary" : "att-btn-secondary"}
                style={{ padding: "6px 14px", fontSize: 12 }}
              >
                {f === "print" ? "Print / Save PDF" : f === "pdf" ? "PDF" : "Word (.docx)"}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: "flex", gap: 8, marginTop: 18, fontSize: 12, color: "var(--att-text-2)", alignItems: "flex-start" }}>
          <input type="checkbox" checked={certify} onChange={(e) => setCertify(e.target.checked)} style={{ marginTop: 3 }} />
          <span>Include attorney certification block (full name, bar number, signature line).</span>
        </label>

        <button className="att-btn-export" onClick={generate} style={{ marginTop: 18, width: "100%", padding: "12px 20px" }}>
          <Download size={14} /> Generate report
        </button>
      </div>
      <div className="att-card" style={{ background: "#F8FAFC" }}>
        <div className="att-eyebrow">Chain of custody</div>
        <p style={{ fontSize: 13, color: "var(--att-text-2)", marginTop: 8, lineHeight: 1.6 }}>
          Every generated report carries case ID <span className="att-mono">{caseId}</span>, the generating attorney's
          identity, and the export timestamp. All access is logged.
        </p>
        <div className="att-divider" />
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--att-slate)" }}>
          <Clock size={11} /> Export logged · {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
}