import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Circle, Clock, Download, FileText,
  Flag, HelpCircle, Image as ImageIcon, Lock, Music, Paperclip, Printer, Sparkles, MessageSquare,
  TrendingUp, Briefcase, Shield, ListChecks, Scale, Gauge,
  ShieldCheck, Hash, Send, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  getClientCase, generateDepositionPrep, getSignedEvidenceUrl,
  listAttorneyNotes, upsertAttorneyNote, createDocRequest,
  getCaseNote, saveCaseNote,
  listClientThreads, getClientThread,
} from "@/lib/attorney-portal.functions";
import {
  listEvidenceReviews, upsertEvidenceReview,
} from "@/lib/attorney-evidence-reviews.functions";
import { getAttorneyEntitlement, generateAttorneyCourtPacket, generateClioPackage } from "@/lib/payments.functions";
import { typeLabel } from "@/lib/abuse-types";
import { toast } from "sonner";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, Table, TableRow, TableCell, WidthType, PageBreak,
} from "docx";

export const Route = createFileRoute("/_attorney/clients/$clientId")({
  component: ClientCaseView,
});

type CaseData = Awaited<ReturnType<typeof getClientCase>>;
type DepoResult = Awaited<ReturnType<typeof generateDepositionPrep>>;
type NoteRow = { incident_id: string; note: string | null; flagged: boolean; reviewed: boolean };

const TABS = [
  "Dashboard", "Intake", "Overview", "Timeline", "Patterns", "Checklist", "Gaps", "Evidence", "Threads", "Deposition", "Export",
] as const;
type Tab = (typeof TABS)[number];

function ClientCaseView() {
  const { clientId } = useParams({ from: "/_attorney/clients/$clientId" });
  const fetcher = useServerFn(getClientCase);
  const depoFn = useServerFn(generateDepositionPrep);
  const notesFn = useServerFn(listAttorneyNotes);
  const entFn = useServerFn(getAttorneyEntitlement);
  const [data, setData] = useState<CaseData | null>(null);
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [depo, setDepo] = useState<DepoResult | null>(null);
  const [depoLoading, setDepoLoading] = useState(false);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [ent, setEnt] = useState<{ entitled: boolean; reason: string } | null>(null);

  useEffect(() => {
    entFn({ data: { clientId } }).then(setEnt).catch(() => setEnt({ entitled: false, reason: "paywall" }));
  }, [entFn, clientId]);

  useEffect(() => {
    if (!ent?.entitled) return;
    fetcher({ data: { clientId } }).then(setData).catch(() => toast("Couldn't load case."));
    notesFn({ data: { clientId } }).then((r) => setNotes(r.notes)).catch(() => {});
  }, [fetcher, notesFn, clientId, ent]);

  const runDepo = async () => {
    setDepoLoading(true);
    try {
      const r = await depoFn({ data: { clientId } });
      setDepo(r);
      if (!r.ok) toast("Couldn't generate prep: " + r.reason);
    } finally { setDepoLoading(false); }
  };

  if (ent === null) return <div className="att-card">Checking access…</div>;
  if (!ent.entitled) {
    return (
      <div className="att-card" style={{ maxWidth: 560, margin: "40px auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 22, marginBottom: 6 }}>Subscription required</h2>
        <p style={{ color: "var(--att-text-2)", fontSize: 13, marginBottom: 16 }}>
          You already have one free client case open. Subscribe to unlock unlimited cases for $297/month.
        </p>
        <Link to="/subscribe" className="att-btn-secondary" style={{ display: "inline-block" }}>
          Subscribe — $297/mo
        </Link>
      </div>
    );
  }
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
          <h1 style={{ fontSize: 34, marginTop: 4, fontFamily: '"Instrument Serif", serif', fontWeight: 400 }}>Client {clientId.slice(0, 8)}</h1>
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
        {tab === "Dashboard" && <Dashboard data={data} clientId={clientId} />}
        {tab === "Intake" && <IntakeTab data={data} clientId={clientId} />}
        {tab === "Overview" && <Overview data={data} />}
        {tab === "Timeline" && <TimelineTab data={data} clientId={clientId} notes={notes} onNotes={setNotes} />}
        {tab === "Patterns" && <Patterns data={data} />}
        {tab === "Checklist" && <ChecklistTab data={data} />}
        {tab === "Gaps" && <Gaps data={data} />}
        {tab === "Evidence" && <EvidenceTab data={data} clientId={clientId} />}
        {tab === "Threads" && <ThreadsTab clientId={clientId} />}
        {tab === "Deposition" && <DepoTab depo={depo} loading={depoLoading} onRun={runDepo} />}
        {tab === "Export" && <ExportTab data={data} caseId={caseId} />}
      </div>
    </div>
  );
}

/* ---------------- New unified Dashboard tab ---------------- */

function Dashboard({ data, clientId }: { data: CaseData; clientId: string }) {
  const packetFn = useServerFn(generateAttorneyCourtPacket);
  const reviewsFn = useServerFn(listEvidenceReviews);
  const [downloading, setDownloading] = useState(false);
  const [reviews, setReviews] = useState<Array<{ evidence_id: string; status: string; exhibit_label: string | null }>>([]);

  useEffect(() => {
    reviewsFn({ data: { clientId } }).then((r) => setReviews(r.reviews as never)).catch(() => {});
  }, [reviewsFn, clientId]);

  const download = async () => {
    setDownloading(true);
    try {
      const r = await packetFn({ data: { clientId } });
      if (!r.ok) { toast("Couldn't generate packet: " + r.reason); return; }
      window.open(r.url, "_blank");
    } finally { setDownloading(false); }
  };

  const tMax = Math.max(1, ...data.timeline.map((x) => x.count));
  const sortedCats = [...data.categories].sort((a, b) => b.count - a.count).slice(0, 6);
  const catMax = Math.max(1, ...sortedCats.map((c) => c.count));
  const high = data.flags.filter((f) => !f.dismissed_at && (f.severity_tier ?? 0) >= 3).length;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="att-card" style={{ background: "#F8FAFC" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="att-eyebrow">Court packet</div>
            <h2 style={{ fontSize: 20, marginTop: 4 }}>Download court-ready ZIP</h2>
            <p style={{ fontSize: 13, color: "var(--att-text-2)", marginTop: 4 }}>
              Includes incidents, evidence files, communications, pattern summary, and a tamper-evident manifest.
            </p>
          </div>
          <button className="att-btn-export" onClick={download} disabled={downloading} style={{ padding: "12px 18px" }}>
            <Download size={14} /> {downloading ? "Preparing…" : "Download packet"}
          </button>
        </div>
      </div>

      <DashboardKpiRow data={data} reviews={reviews} />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18 }}>
        <div className="att-card">
          <SectionTitle icon={<TrendingUp size={16} />}>Timeline</SectionTitle>
          {data.timeline.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>No dated incidents yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 4 }}>
              {data.timeline.map((m) => (
                <div key={m.month} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                  <div style={{ width: 70, color: "var(--att-text-2)" }} className="att-mono">{m.month}</div>
                  <div style={{ flex: 1, height: 6, background: "var(--att-border)", borderRadius: 999 }}>
                    <div style={{ height: "100%", borderRadius: 999, width: `${(m.count / tMax) * 100}%`, background: m.avg_severity >= 3 ? "#EF4444" : "var(--att-navy-mid)" }} />
                  </div>
                  <div style={{ width: 80, textAlign: "right" }}>{m.count} · sev {m.avg_severity.toFixed(1)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="att-card">
          <SectionTitle icon={<Sparkles size={16} />}>Pattern summary</SectionTitle>
          {sortedCats.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>Not enough data to categorize yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {sortedCats.map((c) => (
                <div key={c.type}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span>{c.type}</span>
                    <span className="att-mono" style={{ color: "var(--att-text-2)" }}>{c.count}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "var(--att-border)", marginTop: 4 }}>
                    <div style={{ height: "100%", borderRadius: 999, width: `${(c.count / catMax) * 100}%`, background: "var(--att-navy)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {data.case?.pattern_summary && (
            <p style={{ marginTop: 12, fontSize: 13, color: "var(--att-text-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {data.case.pattern_summary.slice(0, 400)}{data.case.pattern_summary.length > 400 ? "…" : ""}
            </p>
          )}
        </div>
      </div>

      <div className="att-card">
        <SectionTitle icon={<AlertTriangle size={16} />}>Escalation arc</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 12 }}>
          <Metric label="Incidents" v={data.incidents.length} />
          <Metric label="Last 30 days" v={data.last_30_days} />
          <Metric label="Avg severity" v={data.avg_severity.toFixed(1)} />
          <Metric label="High-severity flags" v={high} />
        </div>
        {data.flags.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>No escalation flags recorded.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            {data.flags.slice(0, 8).map((f) => (
              <li key={f.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "8px 10px", background: "#FEF2F2", borderLeft: `3px solid ${(f.severity_tier ?? 0) >= 3 ? "#EF4444" : "#F59E0B"}`, borderRadius: 4 }}>
                <span>{f.details ?? f.flag_type ?? "Escalation flagged"}</span>
                <span className="att-mono" style={{ color: "var(--att-text-2)" }}>sev {f.severity_tier ?? "?"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CaseNotesCard clientId={clientId} />
    </div>
  );
}

/* ---------------- shared atoms ---------------- */

function CaseNotesCard({ clientId }: { clientId: string }) {
  const get = useServerFn(getCaseNote);
  const save = useServerFn(saveCaseNote);
  const [note, setNote] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    get({ data: { clientId } })
      .then((r) => { setNote(r.note ?? ""); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [get, clientId]);

  const persist = async (value: string) => {
    setSaving(true);
    try {
      await save({ data: { clientId, note: value } });
      setSavedAt(new Date());
    } catch {
      toast("Couldn't save note.");
    } finally { setSaving(false); }
  };

  return (
    <div className="att-card" style={{ background: "#FFFBEB", borderColor: "#FCD34D" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <SectionTitle icon={<Lock size={16} />}>Private attorney notes</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--att-text-2)" }}>
          <Lock size={11} /> Survivor never sees this · {saving ? "Saving…" : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "Autosaves on blur"}
        </div>
      </div>
      <textarea
        value={note}
        disabled={!loaded}
        onChange={(e) => setNote(e.target.value)}
        onBlur={(e) => persist(e.target.value)}
        placeholder="Theory of the case, contradictions to watch, strategy notes. Visible only to you. Included in court packet ZIP only when you toggle Attorney Notes on export."
        rows={6}
        style={{
          width: "100%", padding: 12, fontSize: 13, lineHeight: 1.6,
          border: "1px solid #FCD34D", borderRadius: 8, background: "#FFFFFF",
          fontFamily: "inherit", resize: "vertical",
        }}
      />
    </div>
  );
}

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

function IntegrityStat({ label, value, tone }: { label: string; value: number | string; tone?: "green" | "amber" | "red" }) {
  const color = tone === "green" ? "#10B981" : tone === "amber" ? "#F59E0B" : tone === "red" ? "#EF4444" : "var(--att-text)";
  return (
    <div style={{ padding: 10, background: "#fff", border: "1px solid var(--att-border)", borderRadius: 6 }}>
      <div className="att-eyebrow">{label}</div>
      <div style={{ fontSize: 20, fontFamily: '"Instrument Serif", serif', marginTop: 2, color }}>{value}</div>
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
  return <GapsTab data={data} />;
}

function GapsTab({ data }: { data: CaseData }) {
  const { clientId } = useParams({ from: "/_attorney/clients/$clientId" });
  const reqFn = useServerFn(createDocRequest);
  const [sentIdx, setSentIdx] = useState<Set<number>>(new Set());
  const [sendingIdx, setSendingIdx] = useState<number | null>(null);
  const [openBucket, setOpenBucket] = useState<Record<string, boolean>>({ high: true, moderate: true, low: false });
  const [bulkSending, setBulkSending] = useState<string | null>(null);

  const sevColor: Record<string, string> = { high: "#EF4444", moderate: "#F59E0B", low: "#94A3B8" };

  const requestClarification = async (idx: number, g: CaseData["gaps"][number]) => {
    setSendingIdx(idx);
    try {
      await reqFn({
        data: {
          clientId,
          title: g.kind,
          details: g.suggested_request ?? g.detail,
        },
      });
      setSentIdx((s) => new Set(s).add(idx));
      toast("Clarification request sent.");
    } catch {
      toast("Couldn't send request.");
    } finally {
      setSendingIdx(null);
    }
  };

  const counts = data.gaps.reduce(
    (acc, g) => {
      const sev = (g.severity ?? "moderate") as keyof typeof acc;
      acc[sev] = (acc[sev] ?? 0) + 1;
      return acc;
    },
    { high: 0, moderate: 0, low: 0 } as Record<"high" | "moderate" | "low", number>,
  );

  const buckets: Array<"high" | "moderate" | "low"> = ["high", "moderate", "low"];
  const indexedGaps = data.gaps.map((g, i) => ({ g, i }));
  const totalGaps = data.gaps.length;
  const closedGaps = sentIdx.size;
  const readinessPct = totalGaps === 0 ? 100 : Math.round(((totalGaps - (totalGaps - closedGaps)) / totalGaps) * 100);
  const readinessLabel = totalGaps === 0
    ? "Court-ready"
    : counts.high > 0 ? "Not trial-ready — close high-severity gaps first"
    : counts.moderate > 0 ? "Filing-ready, trial work remains"
    : "Polish — low-priority items only";
  const readinessColor = totalGaps === 0 || (counts.high === 0 && counts.moderate === 0) ? "#10B981"
    : counts.high === 0 ? "#F59E0B" : "#EF4444";

  const sendBucket = async (sev: "high" | "moderate" | "low") => {
    setBulkSending(sev);
    try {
      const targets = indexedGaps.filter(({ g, i }) => (g.severity ?? "moderate") === sev && !sentIdx.has(i));
      for (const { g, i } of targets) {
        try {
          await reqFn({ data: { clientId, title: g.kind, details: g.suggested_request ?? g.detail } });
          setSentIdx((s) => new Set(s).add(i));
        } catch { /* continue */ }
      }
      toast(`Sent ${targets.length} clarification request${targets.length === 1 ? "" : "s"}.`);
    } finally { setBulkSending(null); }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="att-card" style={{ background: "linear-gradient(135deg,#F8FAFC,#EFF6FF)", borderColor: "#BFDBFE" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="att-eyebrow">Court-readiness</div>
            <h2 style={{ fontSize: 22, marginTop: 4, color: readinessColor }}>{readinessLabel}</h2>
            <p style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 4 }}>
              {closedGaps} of {totalGaps} gap{totalGaps === 1 ? "" : "s"} addressed this session.
              Critical gaps below should be closed before filing.
            </p>
          </div>
          <div style={{ minWidth: 220 }}>
            <div style={{ height: 8, background: "var(--att-border)", borderRadius: 999 }}>
              <div style={{ width: `${readinessPct}%`, height: "100%", background: readinessColor, borderRadius: 999, transition: "width .3s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--att-text-2)" }}>
              <span>{counts.high} high</span><span>{counts.moderate} moderate</span><span>{counts.low} low</span>
            </div>
          </div>
        </div>
      </div>

      {totalGaps === 0 ? (
        <div className="att-card" style={{ textAlign: "center", padding: 24 }}>
          <ShieldCheck size={32} style={{ color: "var(--att-green)", margin: "0 auto" }} />
          <p style={{ fontSize: 14, color: "var(--att-green)", marginTop: 8 }}>No critical gaps detected. This case file is fully supported.</p>
        </div>
      ) : (
        buckets.map((sev) => {
          const gapsInBucket = indexedGaps.filter(({ g }) => (g.severity ?? "moderate") === sev);
          if (gapsInBucket.length === 0) return null;
          const open = openBucket[sev];
          const unsentInBucket = gapsInBucket.filter(({ i }) => !sentIdx.has(i)).length;
          return (
            <div key={sev} className="att-card" style={{ borderLeft: `4px solid ${sevColor[sev]}`, padding: 0 }}>
              <button
                onClick={() => setOpenBucket((s) => ({ ...s, [sev]: !s[sev] }))}
                style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "14px 16px", background: "transparent", border: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
              >
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <strong style={{ fontSize: 14, textTransform: "capitalize", color: sevColor[sev] }}>{sev} severity</strong>
                <span style={{ fontSize: 12, color: "var(--att-text-2)" }}>· {gapsInBucket.length} item{gapsInBucket.length === 1 ? "" : "s"}</span>
                {unsentInBucket > 0 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); sendBucket(sev); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); sendBucket(sev); } }}
                    className="att-btn-secondary"
                    style={{ marginLeft: "auto", padding: "4px 10px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                  >
                    <Send size={11} /> {bulkSending === sev ? "Sending…" : `Request all ${unsentInBucket}`}
                  </span>
                )}
              </button>
              {open && (
                <ul style={{ display: "grid", gap: 10, listStyle: "none", padding: "0 16px 16px", margin: 0 }}>
                  {gapsInBucket.map(({ g, i }) => {
                    const sent = sentIdx.has(i);
                    return (
                      <li key={i} style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: 6, borderLeft: `3px solid ${sevColor[sev]}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                          <strong style={{ fontSize: 14 }}>{g.kind}</strong>
                          {sent && <span className="att-tag att-tag-auth" style={{ fontSize: 10 }}>REQUESTED</span>}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--att-text-2)", marginBottom: 8 }}>{g.detail}</div>
                        {g.why_it_matters && (
                          <div style={{ fontSize: 12, marginTop: 8 }}>
                            <span className="att-eyebrow" style={{ display: "block", marginBottom: 2 }}>Why it matters</span>
                            <span style={{ color: "var(--att-text-2)" }}>{g.why_it_matters}</span>
                          </div>
                        )}
                        {g.suggested_fix && (
                          <div style={{ fontSize: 12, marginTop: 8 }}>
                            <span className="att-eyebrow" style={{ display: "block", marginBottom: 2 }}>Suggested fix</span>
                            <span style={{ color: "var(--att-text-2)" }}>{g.suggested_fix}</span>
                          </div>
                        )}
                        <div style={{ marginTop: 10 }}>
                          <button
                            className="att-btn-secondary"
                            style={{ padding: "6px 12px", fontSize: 12 }}
                            disabled={sent || sendingIdx === i}
                            onClick={() => requestClarification(i, g)}
                          >
                            {sent ? "Request sent" : sendingIdx === i ? "Sending…" : "Request clarification"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

/* ---------------- Evidence vault ---------------- */

function EvidenceTab({ data, clientId }: { data: CaseData; clientId: string }) {
  const signedFn = useServerFn(getSignedEvidenceUrl);
  const listReviews = useServerFn(listEvidenceReviews);
  const saveReview = useServerFn(upsertEvidenceReview);
  type Cat = "All" | "Photos" | "Screenshots" | "Documents" | "Audio";
  const [cat, setCat] = useState<Cat>("All");
  const [openingId, setOpeningId] = useState<string | null>(null);
  type Review = { evidence_id: string; status: string; exhibit_label: string | null; notes: string | null; linked_incident_id: string | null };
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    listReviews({ data: { clientId } })
      .then((r) => {
        const map: Record<string, Review> = {};
        for (const row of r.reviews) map[row.evidence_id] = row as Review;
        setReviews(map);
      })
      .catch(() => {});
  }, [listReviews, clientId]);

  const update = async (evidenceId: string, patch: Partial<Review>) => {
    const current = reviews[evidenceId] ?? { evidence_id: evidenceId, status: "unreviewed", exhibit_label: null, notes: null, linked_incident_id: null };
    const next = { ...current, ...patch };
    setReviews((s) => ({ ...s, [evidenceId]: next }));
    try {
      await saveReview({ data: { clientId, evidenceId, ...patch } });
    } catch {
      toast("Couldn't save review.");
    }
  };

  const matches = (type: string, cat: Cat) => {
    const t = (type || "").toLowerCase();
    if (cat === "All") return true;
    if (cat === "Photos") return t.startsWith("image/") && !t.includes("png");
    if (cat === "Screenshots") return t.includes("png") || t.includes("image/png");
    if (cat === "Audio") return t.startsWith("audio/");
    if (cat === "Documents") return t.includes("pdf") || t.includes("document") || t.includes("text/");
    return true;
  };

  const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
    { value: "unreviewed", label: "Unreviewed", color: "#94A3B8" },
    { value: "useful", label: "Useful", color: "#10B981" },
    { value: "needs_context", label: "Needs context", color: "#FBBF24" },
    { value: "duplicate", label: "Duplicate", color: "#94A3B8" },
    { value: "exclude", label: "Exclude", color: "#EF4444" },
    { value: "privileged", label: "Privileged", color: "#8B5CF6" },
    { value: "exhibit_candidate", label: "Exhibit candidate", color: "#2D4A8A" },
  ];
  const statusMeta = (v: string) => STATUS_OPTIONS.find((s) => s.value === v) ?? STATUS_OPTIONS[0];

  const items = data.evidence
    .filter((e) => matches(e.file_type, cat))
    .filter((e) => statusFilter === "all" ? true : (reviews[e.id]?.status ?? "unreviewed") === statusFilter);

  const bulkApply = async (status: string) => {
    for (const e of items) {
      const current = reviews[e.id]?.status ?? "unreviewed";
      if (current === status) continue;
      // optimistic
      setReviews((s) => ({
        ...s,
        [e.id]: { ...(s[e.id] ?? { evidence_id: e.id, exhibit_label: null, notes: null, linked_incident_id: null, status: "unreviewed" }), status },
      }));
      try { await saveReview({ data: { clientId, evidenceId: e.id, status } }); } catch { /* continue */ }
    }
    toast(`Updated ${items.length} item${items.length === 1 ? "" : "s"}.`);
  };

  // Integrity / chain-of-custody rollup
  const totalEv = data.evidence.length;
  const linkedEv = data.evidence.filter((e) => e.linked_incident_id).length;
  const reviewedEv = Object.values(reviews).filter((r) => r.status && r.status !== "unreviewed").length;
  const earliestUpload = data.evidence
    .map((e) => (e as { created_at?: string }).created_at)
    .filter(Boolean)
    .sort()[0];
  const integrityScore = totalEv === 0 ? 0 : Math.round(((linkedEv + reviewedEv) / (totalEv * 2)) * 100);

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
      <div className="att-card" style={{ marginBottom: 14, background: "linear-gradient(135deg,#F8FAFC,#EFF6FF)", borderColor: "#BFDBFE" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <ShieldCheck size={16} style={{ color: "var(--att-green)" }} />
          <SectionTitle>Evidence integrity record</SectionTitle>
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
          <IntegrityStat label="Files on record" value={totalEv} />
          <IntegrityStat label="Linked to incidents" value={`${linkedEv}/${totalEv || 0}`} />
          <IntegrityStat label="Reviewed" value={`${reviewedEv}/${totalEv || 0}`} />
          <IntegrityStat label="Earliest upload" value={earliestUpload ? new Date(earliestUpload).toLocaleDateString() : "—"} />
          <IntegrityStat label="Integrity score" value={`${integrityScore}%`} tone={integrityScore >= 70 ? "green" : integrityScore >= 40 ? "amber" : "red"} />
        </div>
        <p style={{ fontSize: 11.5, color: "var(--att-text-2)", marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <Hash size={11} /> All files retained with original upload timestamp, MIME type, and survivor attestation. Access is logged per file.
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {(["All", "Photos", "Screenshots", "Documents", "Audio"] as Cat[]).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cat === c ? "att-btn-primary" : "att-btn-secondary"}
            style={{ padding: "6px 12px", fontSize: 12 }}
          >{c}</button>
        ))}
        <span style={{ width: 1, background: "var(--att-border)", margin: "0 4px" }} />
        <button
          onClick={() => setStatusFilter("all")}
          className={statusFilter === "all" ? "att-btn-primary" : "att-btn-secondary"}
          style={{ padding: "6px 12px", fontSize: 12 }}
        >All reviews</button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={statusFilter === s.value ? "att-btn-primary" : "att-btn-secondary"}
            style={{ padding: "6px 12px", fontSize: 12, borderLeft: `3px solid ${s.color}` }}
          >{s.label}</button>
        ))}
      </div>

      {items.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#F8FAFC", border: "1px solid var(--att-border)", borderRadius: 6, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--att-text-2)" }}>
            <strong>{items.length}</strong> item{items.length === 1 ? "" : "s"} visible · bulk apply:
          </span>
          <button className="att-btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => bulkApply("useful")}>Mark useful</button>
          <button className="att-btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => bulkApply("exhibit_candidate")}>Exhibit candidate</button>
          <button className="att-btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => bulkApply("needs_context")}>Needs context</button>
          <button className="att-btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => bulkApply("exclude")}>Exclude</button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="att-card" style={{ textAlign: "center", color: "var(--att-text-2)", fontSize: 13 }}>
          No evidence in this category.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
          {items.map((e) => {
            const r = reviews[e.id];
            const meta = statusMeta(r?.status ?? "unreviewed");
            const isEditing = editingId === e.id;
            return (
            <div key={e.id} className="att-card att-hover" style={{ padding: 14, borderLeft: r && r.status !== "unreviewed" ? `3px solid ${meta.color}` : undefined }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--att-text-2)" }}>
                {icon(e.file_type)}
                <span className="att-mono" style={{ fontSize: 10, textTransform: "uppercase" }}>{e.file_type || "file"}</span>
                <span className="att-tag" style={{ marginLeft: "auto", background: `${meta.color}1A`, color: meta.color, fontSize: 10 }}>
                  {meta.label}{r?.exhibit_label ? ` · ${r.exhibit_label}` : ""}
                </span>
              </div>
              <h3 style={{ fontSize: 16, marginTop: 8 }}>{e.title}</h3>
              <div style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 2 }}>
                {new Date(e.date).toLocaleDateString()}
                {e.linked_incident_id ? " · linked to incident" : " · unlinked"}
              </div>
              {e.description && <p style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 8 }}>{e.description.slice(0, 120)}</p>}
              {r?.notes && !isEditing && (
                <p style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 8, padding: 8, background: "#F8FAFC", borderLeft: "2px solid var(--att-navy)", borderRadius: 4 }}>
                  <span className="att-eyebrow" style={{ display: "block", marginBottom: 2 }}>Attorney note</span>
                  {r.notes}
                </p>
              )}
              {isEditing && (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <select
                    value={r?.status ?? "unreviewed"}
                    onChange={(ev) => update(e.id, { status: ev.target.value })}
                    className="att-input"
                    style={{ padding: "6px 8px", fontSize: 12 }}
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="Exhibit label (e.g. Exhibit A)"
                    defaultValue={r?.exhibit_label ?? ""}
                    onBlur={(ev) => update(e.id, { exhibit_label: ev.target.value.trim() || null })}
                    className="att-input"
                    style={{ padding: "6px 8px", fontSize: 12 }}
                  />
                  <textarea
                    placeholder="Private attorney notes…"
                    defaultValue={r?.notes ?? ""}
                    onBlur={(ev) => update(e.id, { notes: ev.target.value.trim() || null })}
                    className="att-input"
                    rows={3}
                    style={{ padding: "6px 8px", fontSize: 12, fontFamily: "inherit", resize: "vertical" }}
                  />
                </div>
              )}
              <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className="att-btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }} disabled={openingId === e.id} onClick={() => open(e.id)}>
                  <Download size={12} /> {openingId === e.id ? "Opening…" : "Open"}
                </button>
                <button
                  className="att-btn-secondary"
                  style={{ padding: "6px 10px", fontSize: 12 }}
                  onClick={() => setEditingId(isEditing ? null : e.id)}
                >
                  <Flag size={12} /> {isEditing ? "Done" : "Review"}
                </button>
                <span className="att-tag att-tag-auth" style={{ alignSelf: "center" }}>AUTH</span>
              </div>
            </div>
            );
          })}
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
          <DepoSection title="Talking points (narrative spine)" items={depo.prep.talking_points} />
          <DepoComplex title="Strongest evidence" items={depo.prep.strongest_evidence} keys={["item", "why_it_helps", "tied_to_incident"]} accent="#10B981" />
          <DepoComplex title="Weakest evidence" items={depo.prep.weakest_evidence} keys={["item", "risk", "recommended_action"]} accent="#EF4444" />
          <DepoComplex title="Contradictions to reconcile" items={depo.prep.contradictions} keys={["topic", "conflicting_accounts", "how_to_reconcile"]} accent="#F59E0B" />
          <DepoComplex title="Weak spots" items={depo.prep.weak_spots} keys={["issue", "risk", "suggested_fix"]} />
          <DepoComplex title="Credibility gaps" items={depo.prep.credibility_gaps} keys={["gap", "address_before_testimony"]} />
          <DepoSection title="Direct examination questions" items={depo.prep.prep_questions} ordered />
          <DepoSection title="Cross-examination warnings" items={depo.prep.cross_warnings} />
          <DepoComplex title="Court-safe phrasing" items={depo.prep.court_safe_phrasing} keys={["instead_of", "say"]} accent="#2D4A8A" />
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

function DepoComplex({ title, items, keys, accent }: { title: string; items?: Array<Record<string, string>>; keys: string[]; accent?: string }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 style={{ fontSize: 16, marginBottom: 6 }}>{title}</h3>
      <ul style={{ display: "grid", gap: 8, listStyle: "none", padding: 0 }}>
        {items.map((row, i) => (
          <li key={i} style={{ borderLeft: `3px solid ${accent ?? "#F59E0B"}`, paddingLeft: 12 }}>
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
  const [attorneyNotes, setAttorneyNotes] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [clioDownloading, setClioDownloading] = useState(false);
  const packetFn = useServerFn(generateAttorneyCourtPacket);
  const clioFn = useServerFn(generateClioPackage);

  const toggle = (k: keyof typeof include) => setInclude((s) => ({ ...s, [k]: !s[k] }));

  const generate = async () => {
    if (format === "word") {
      toast("Word export coming soon — use Print → Save as PDF for now.");
      return;
    }
    setDownloading(true);
    try {
      const r = await packetFn({ data: { clientId: caseId, includeAttorneyNotes: attorneyNotes } });
      if (!r.ok) { toast("Couldn't generate packet: " + r.reason); return; }
      window.open(r.url, "_blank");
      toast("Packet ready. Includes cover, TOC, timeline, evidence index, and exhibit list.");
    } finally { setDownloading(false); }
  };

  const generateClio = async () => {
    setClioDownloading(true);
    try {
      const r = await clioFn({ data: { clientId: caseId } });
      if (!r.ok) { toast("Couldn't prepare Clio package: " + r.reason); return; }
      window.open(r.url, "_blank");
      toast(`Clio package ready — ${r.counts.documents} documents, ${r.counts.tasks} tasks.`);
    } finally { setClioDownloading(false); }
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

        <label style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 12, color: "var(--att-text-2)", alignItems: "flex-start" }}>
          <input type="checkbox" checked={attorneyNotes} onChange={(e) => setAttorneyNotes(e.target.checked)} style={{ marginTop: 3 }} />
          <span>Include private attorney notes (07_attorney_notes.md). Survivor never sees these. Strip before filing.</span>
        </label>

        <button className="att-btn-export" onClick={generate} disabled={downloading} style={{ marginTop: 18, width: "100%", padding: "12px 20px" }}>
          <Download size={14} /> {downloading ? "Preparing packet…" : "Generate court packet (ZIP)"}
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
        <div className="att-divider" />
        <div className="att-eyebrow" style={{ marginTop: 4 }}>Prepare for Clio</div>
        <p style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 6, lineHeight: 1.6 }}>
          Drop-in import package for Clio Manage. Contains <span className="att-mono">contacts.csv</span>,
          <span className="att-mono"> matter.csv</span>, <span className="att-mono">events.csv</span>,
          <span className="att-mono"> documents.csv</span>, <span className="att-mono">tasks.csv</span>, and a
          <span className="att-mono"> /documents</span> folder with every evidence file.
        </p>
        <button
          className="att-btn-secondary"
          onClick={generateClio}
          disabled={clioDownloading}
          style={{ marginTop: 10, width: "100%", padding: "10px 14px", fontSize: 13 }}
        >
          <Briefcase size={13} /> {clioDownloading ? "Preparing…" : "Download Clio package (ZIP)"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Dashboard KPI row (new attorney command-center cards) ---------------- */

type ReviewLite = { evidence_id: string; status: string; exhibit_label: string | null };

function DashboardKpiRow({ data, reviews }: { data: CaseData; reviews: ReviewLite[] }) {
  const totalEv = data.evidence.length;
  const reviewed = reviews.filter((r) => r.status && r.status !== "unreviewed").length;
  const useful = reviews.filter((r) => r.status === "useful" || r.status === "exhibit_candidate").length;
  const exhibits = reviews.filter((r) => r.exhibit_label && r.exhibit_label.trim().length > 0).length;
  const excluded = reviews.filter((r) => r.status === "exclude" || r.status === "privileged").length;
  const linked = data.evidence.filter((e) => e.linked_incident_id).length;

  const strengthPct = totalEv === 0 ? 0 : Math.round(((useful * 2 + linked) / (totalEv * 3)) * 100);
  const strengthLabel = strengthPct >= 70 ? "Strong" : strengthPct >= 40 ? "Building" : totalEv === 0 ? "No evidence yet" : "Thin";
  const strengthColor = strengthPct >= 70 ? "#10B981" : strengthPct >= 40 ? "#F59E0B" : "#EF4444";

  const reviewPct = totalEv === 0 ? 0 : Math.round((reviewed / totalEv) * 100);
  const highRisk = data.flags.filter((f) => !f.dismissed_at && (f.severity_tier ?? 0) >= 3).length;

  const moves: { label: string; why: string }[] = [];
  if (highRisk > 0) moves.push({ label: "File for protective relief", why: `${highRisk} high-severity flag${highRisk === 1 ? "" : "s"} on record` });
  if (data.gaps.some((g) => g.severity === "high")) moves.push({ label: "Send evidence request to client", why: "Critical gaps in case file" });
  if (totalEv > 0 && reviewed < totalEv) moves.push({ label: `Finish reviewing ${totalEv - reviewed} evidence item${totalEv - reviewed === 1 ? "" : "s"}`, why: "Unreviewed items can't be assigned exhibit numbers" });
  if (exhibits === 0 && useful > 0) moves.push({ label: "Assign exhibit numbers", why: `${useful} useful item${useful === 1 ? "" : "s"} ready for labeling` });
  if (data.last_30_days >= 2) moves.push({ label: "Document recency in motion practice", why: `${data.last_30_days} incidents in last 30 days` });
  if (moves.length === 0) moves.push({ label: "Case is ready for export", why: "All review steps complete" });

  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
      <div className="att-card">
        <SectionTitle icon={<Gauge size={14} />}>Evidence strength</SectionTitle>
        <div style={{ fontSize: 28, fontFamily: '"Instrument Serif", serif', color: strengthColor }}>{strengthPct}%</div>
        <div style={{ fontSize: 12, color: "var(--att-text-2)", marginBottom: 8 }}>{strengthLabel} · {linked}/{totalEv || 0} linked to incidents</div>
        <div style={{ height: 6, background: "var(--att-border)", borderRadius: 999 }}>
          <div style={{ width: `${strengthPct}%`, height: "100%", background: strengthColor, borderRadius: 999 }} />
        </div>
      </div>

      <div className="att-card">
        <SectionTitle icon={<ListChecks size={14} />}>Review status</SectionTitle>
        <div style={{ fontSize: 28, fontFamily: '"Instrument Serif", serif' }}>{reviewed}<span style={{ fontSize: 14, color: "var(--att-text-2)" }}> / {totalEv}</span></div>
        <div style={{ fontSize: 12, color: "var(--att-text-2)", marginBottom: 8 }}>{reviewPct}% reviewed · {exhibits} exhibit{exhibits === 1 ? "" : "s"} · {excluded} excluded</div>
        <div style={{ height: 6, background: "var(--att-border)", borderRadius: 999 }}>
          <div style={{ width: `${reviewPct}%`, height: "100%", background: "var(--att-navy)", borderRadius: 999 }} />
        </div>
      </div>

      <div className="att-card">
        <SectionTitle icon={<Shield size={14} />}>Urgent risk flags</SectionTitle>
        <div style={{ fontSize: 28, fontFamily: '"Instrument Serif", serif', color: highRisk > 0 ? "#EF4444" : "var(--att-text)" }}>{highRisk}</div>
        <div style={{ fontSize: 12, color: "var(--att-text-2)" }}>
          {highRisk === 0 ? "No high-severity flags active" : `High-severity escalation${highRisk === 1 ? "" : "s"} on record`}
        </div>
      </div>

      <div className="att-card" style={{ background: "#F8FAFC" }}>
        <SectionTitle icon={<Scale size={14} />}>Next legal moves</SectionTitle>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
          {moves.slice(0, 3).map((m, i) => (
            <li key={i} style={{ fontSize: 12.5 }}>
              <div style={{ fontWeight: 600, color: "var(--att-navy)" }}>{m.label}</div>
              <div style={{ color: "var(--att-text-2)", fontSize: 11 }}>{m.why}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="att-card" style={{ background: "linear-gradient(135deg,#F8FAFC,#EFF6FF)", borderColor: "#BFDBFE" }}>
        <SectionTitle icon={<Briefcase size={14} />}>Clio integration</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: "#F59E0B" }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Not connected</span>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--att-text-2)", lineHeight: 1.5, margin: 0 }}>
          Use <strong>Prepare for Clio</strong> on the Export tab to generate a Clio-ready ZIP today. Live sync coming soon.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Intake tab (attorney intake summary, auto-generated) ---------------- */

function IntakeTab({ data, clientId }: { data: CaseData; clientId: string }) {
  const caseId = `PP-${clientId.slice(0, 4).toUpperCase()}`;
  const c = data.case;
  const sortedInc = [...data.incidents].sort((a, b) => a.date.localeCompare(b.date));
  const first = sortedInc[0]?.date;
  const last = sortedInc[sortedInc.length - 1]?.date;
  const highSev = sortedInc.filter((i) => (i.severity_level ?? 0) >= 4);
  const policeMentions = sortedInc.filter((i) => /police|911|officer|report/i.test(i.description ?? "")).length;
  const childMentions = sortedInc.filter((i) => /child|kid|custody|son|daughter|minor/i.test(i.description ?? "")).length;
  const orderDocs = data.legal_documents.filter((d) => /order|restrain|tro|custody|divorce/i.test(`${d.title} ${d.document_type ?? ""}`));
  const witnesses = Array.from(new Set(sortedInc.map((i) => i.witnesses).filter(Boolean))).slice(0, 8);
  const oppBehaviors = data.categories.sort((a, b) => b.count - a.count).slice(0, 4).map((c) => c.type);
  const missingDocs = data.gaps.filter((g) => g.severity === "high" || g.severity === "moderate").slice(0, 6).map((g) => g.kind);

  const sections: { title: string; body: React.ReactNode }[] = [
    { title: "Client intake summary", body:
      <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--att-text)" }}>
        Client {clientId.slice(0, 8)} has documented <strong>{data.incidents.length} incidents</strong>
        {first && last ? <> spanning <strong>{new Date(first).toLocaleDateString()}</strong> to <strong>{new Date(last).toLocaleDateString()}</strong></> : null},
        with <strong>{data.evidence.length} evidence file{data.evidence.length === 1 ? "" : "s"}</strong> attached.
        Current risk profile is <strong style={{ textTransform: "uppercase" }}>{data.risk_level}</strong>.
        {c?.case_types && c.case_types.length > 0 ? <> Matter type: <strong>{c.case_types.join(", ")}</strong>.</> : null}
      </p>
    },
    { title: "Facts of the case", body:
      <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--att-text-2)", whiteSpace: "pre-wrap" }}>
        {c?.pattern_summary ?? "No client-provided narrative on file. Recommend scheduling an intake conversation to capture the case theory in the client's own words."}
      </p>
    },
    { title: "Key dates", body:
      <ul style={{ fontSize: 13, paddingLeft: 18, lineHeight: 1.7, margin: 0 }}>
        {first && <li>First documented incident: <strong>{new Date(first).toLocaleDateString()}</strong></li>}
        {last && <li>Most recent incident: <strong>{new Date(last).toLocaleDateString()}</strong></li>}
        {highSev.slice(0, 4).map((i) => (
          <li key={i.id}>{new Date(i.date).toLocaleDateString()} — severity {i.severity_level}: {(i.description ?? "").slice(0, 80)}</li>
        ))}
        {!first && <li style={{ color: "var(--att-text-2)" }}>No dated incidents on file.</li>}
      </ul>
    },
    { title: "Opposing party behavior", body:
      <>
        {c?.other_party && <div style={{ fontSize: 13, marginBottom: 8 }}>Identified party: <strong>{c.other_party}</strong> ({c.relationship_type ?? "relationship unspecified"})</div>}
        {oppBehaviors.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>Insufficient documented incidents to characterize a behavioral pattern.</p>
        ) : (
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            Documented patterns include: <strong>{oppBehaviors.join(", ")}</strong>.
            {data.flags.length > 0 && <> Survivor has flagged {data.flags.length} escalation event{data.flags.length === 1 ? "" : "s"}.</>}
          </p>
        )}
      </>
    },
    { title: "Children involved", body:
      <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>
        {childMentions === 0 ? "No incidents reference children. Confirm at intake." : `${childMentions} incident${childMentions === 1 ? "" : "s"} reference children or custody.`}
      </p>
    },
    { title: "Current orders on file", body:
      orderDocs.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>No protective, custody, or divorce orders uploaded. Request copies from client.</p>
      ) : (
        <ul style={{ fontSize: 13, paddingLeft: 18, lineHeight: 1.7, margin: 0 }}>
          {orderDocs.map((d) => (
            <li key={d.id}>{d.title}{d.case_number ? ` · ${d.case_number}` : ""}{d.court_name ? ` · ${d.court_name}` : ""}</li>
          ))}
        </ul>
      )
    },
    { title: "Police involvement", body:
      <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>
        {policeMentions === 0 ? "No documented police contact. Confirm whether any 911 calls, reports, or OPRA requests exist." : `${policeMentions} incident${policeMentions === 1 ? "" : "s"} reference police, 911, or reports.`}
      </p>
    },
    { title: "Witnesses & contacts", body:
      witnesses.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>No witnesses named in incident records.</p>
      ) : (
        <ul style={{ fontSize: 13, paddingLeft: 18, lineHeight: 1.7, margin: 0 }}>
          {witnesses.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )
    },
    { title: "Urgent risks", body:
      data.flags.filter((f) => !f.dismissed_at).length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>No active escalation flags.</p>
      ) : (
        <ul style={{ fontSize: 13, paddingLeft: 18, lineHeight: 1.7, margin: 0 }}>
          {data.flags.filter((f) => !f.dismissed_at).slice(0, 6).map((f) => (
            <li key={f.id}>Severity {f.severity_tier ?? "?"}: {f.details ?? f.flag_type ?? "Escalation flagged"}</li>
          ))}
        </ul>
      )
    },
    { title: "Requested relief", body:
      <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>
        To be captured at attorney intake. Suggested relief based on case profile: {data.risk_level === "high" ? "emergency protective order, custody modification, supervised visitation" : "protective order, custody clarification, no-contact terms"}.
      </p>
    },
    { title: "Missing documents", body:
      missingDocs.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--att-green)" }}>No critical gaps detected.</p>
      ) : (
        <ul style={{ fontSize: 13, paddingLeft: 18, lineHeight: 1.7, margin: 0 }}>
          {missingDocs.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      )
    },
  ];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="att-card" style={{ background: "linear-gradient(135deg,#0F2547,#1E3A6B)", color: "#fff", borderColor: "transparent" }}>
        <div style={{ fontSize: 10, letterSpacing: 1.4, opacity: 0.75 }}>ATTORNEY INTAKE SUMMARY</div>
        <h2 style={{ fontSize: 28, fontFamily: '"Instrument Serif", serif', marginTop: 4, color: "#fff" }}>Case {caseId}</h2>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
          Auto-generated from survivor-uploaded evidence · Print or include in court packet
        </div>
        <button className="att-btn-secondary" onClick={() => window.print()} style={{ marginTop: 14, background: "#fff", color: "var(--att-navy)" }}>
          <Printer size={13} /> Print intake summary
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14 }}>
        {sections.map((s) => (
          <div key={s.title} className="att-card">
            <div className="att-eyebrow" style={{ marginBottom: 8 }}>{s.title}</div>
            {s.body}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Threads tab (attorney message-thread viewer) ---------------- */

type ThreadRow = {
  id: string;
  source_filename: string;
  source_type: string;
  conversation_participant: string | null;
  exhibit_label: string | null;
  parse_status: string;
  message_count: number;
  summary: string | null;
  attorney_summary: string | null;
  flags: unknown;
  created_at: string;
};

type ThreadMessage = {
  id: string;
  position: number;
  sender: string | null;
  recipient: string | null;
  sent_on: string | null;
  sent_at_time: string | null;
  body: string | null;
  attachment_name: string | null;
  flags: unknown;
};

type ThreadFlag = { type?: string; label?: string; evidence?: string; severity?: string };

function toFlags(v: unknown): ThreadFlag[] {
  return Array.isArray(v) ? (v as ThreadFlag[]) : [];
}

function ThreadsTab({ clientId }: { clientId: string }) {
  const listFn = useServerFn(listClientThreads);
  const getFn = useServerFn(getClientThread);
  const [threads, setThreads] = useState<ThreadRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openThread, setOpenThread] = useState<{ thread: ThreadRow; messages: ThreadMessage[] } | null>(null);
  const [loadingOpen, setLoadingOpen] = useState(false);

  useEffect(() => {
    listFn({ data: { clientId } })
      .then((r) => setThreads(r.threads as ThreadRow[]))
      .catch(() => setThreads([]));
  }, [listFn, clientId]);

  const open = async (id: string) => {
    setOpenId(id);
    setLoadingOpen(true);
    setOpenThread(null);
    try {
      const r = await getFn({ data: { clientId, threadId: id } });
      setOpenThread({ thread: r.thread as ThreadRow, messages: r.messages as ThreadMessage[] });
    } catch {
      toast("Couldn't open thread.");
    } finally {
      setLoadingOpen(false);
    }
  };

  if (threads === null) return <div className="att-card">Loading threads…</div>;

  if (threads.length === 0) {
    return (
      <div className="att-card" style={{ textAlign: "center", padding: 32 }}>
        <MessageSquare size={28} style={{ color: "var(--att-text-2)", marginBottom: 8 }} />
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>No message threads uploaded</h3>
        <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>
          When the client uploads an exported iMessage, SMS, or chat conversation, it will appear here with an AI-generated attorney summary and flagged passages.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,360px) minmax(0,1fr)", gap: 18, alignItems: "start" }}>
      <div style={{ display: "grid", gap: 10 }}>
        {threads.map((t) => {
          const flags = toFlags(t.flags);
          const high = flags.filter((f) => f.severity === "high").length;
          const active = openId === t.id;
          return (
            <button
              key={t.id}
              onClick={() => open(t.id)}
              className="att-card"
              style={{
                textAlign: "left", cursor: "pointer", padding: 14,
                border: active ? "1.5px solid var(--att-navy)" : "1px solid var(--att-border)",
                background: active ? "#F8FAFC" : "#fff",
                fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--att-navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.exhibit_label || t.conversation_participant || t.source_filename}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--att-text-2)", marginTop: 2 }}>
                    {t.source_type.toUpperCase()} · {t.message_count} msgs · {new Date(t.created_at).toLocaleDateString()}
                  </div>
                </div>
                {high > 0 && (
                  <span className="att-tag" style={{ background: "#FEE2E2", color: "#B91C1C", fontSize: 10 }}>
                    {high} high
                  </span>
                )}
              </div>
              {t.parse_status !== "parsed" && (
                <div style={{ fontSize: 10, marginTop: 6, color: "var(--att-text-2)", fontStyle: "italic" }}>
                  {t.parse_status}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="att-card" style={{ minHeight: 400 }}>
        {!openId && (
          <div style={{ textAlign: "center", color: "var(--att-text-2)", padding: "60px 20px", fontSize: 13 }}>
            Select a thread to view AI summary, flagged passages, and full conversation.
          </div>
        )}
        {openId && loadingOpen && <div style={{ fontSize: 13 }}>Loading conversation…</div>}
        {openId && !loadingOpen && openThread && <ThreadViewer t={openThread.thread} messages={openThread.messages} />}
      </div>
    </div>
  );
}

function ThreadViewer({ t, messages }: { t: ThreadRow; messages: ThreadMessage[] }) {
  const flags = toFlags(t.flags);
  const sevColor = (s?: string) => s === "high" ? "#B91C1C" : s === "medium" ? "#B45309" : "#0F2547";
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <div className="att-eyebrow">Exhibit</div>
        <h3 style={{ fontSize: 18, marginTop: 4, fontFamily: '"Instrument Serif", serif' }}>
          {t.exhibit_label || t.conversation_participant || t.source_filename}
        </h3>
        <div style={{ fontSize: 11, color: "var(--att-text-2)", marginTop: 2 }}>
          Source: {t.source_filename} · {t.source_type.toUpperCase()} · {t.message_count} messages
        </div>
      </div>

      {t.attorney_summary && (
        <div style={{ padding: 14, background: "#F8FAFC", borderLeft: "3px solid var(--att-navy)", borderRadius: 4 }}>
          <div className="att-eyebrow" style={{ marginBottom: 6 }}>Attorney summary</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{t.attorney_summary}</p>
        </div>
      )}

      {flags.length > 0 && (
        <div>
          <div className="att-eyebrow" style={{ marginBottom: 8 }}>Flagged passages ({flags.length})</div>
          <div style={{ display: "grid", gap: 8 }}>
            {flags.map((f, i) => (
              <div key={i} style={{ padding: 10, borderLeft: `3px solid ${sevColor(f.severity)}`, background: "#FEF9F4", borderRadius: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  <span>{f.label || f.type}</span>
                  <span className="att-mono" style={{ color: sevColor(f.severity), textTransform: "uppercase", fontSize: 10 }}>
                    {f.severity}
                  </span>
                </div>
                {f.evidence && (
                  <p style={{ fontSize: 12, color: "var(--att-text-2)", margin: 0, fontStyle: "italic" }}>"{f.evidence}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="att-eyebrow" style={{ marginBottom: 8 }}>Full conversation</div>
        {messages.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>No structured messages parsed for this thread.</p>
        ) : (
          <div style={{ display: "grid", gap: 6, maxHeight: 500, overflowY: "auto", paddingRight: 6 }}>
            {messages.map((m) => (
              <div key={m.id} style={{ padding: "8px 10px", background: "#fff", border: "1px solid var(--att-border)", borderRadius: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--att-text-2)", marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, color: "var(--att-navy)" }}>{m.sender || "Unknown"}</span>
                  <span className="att-mono">
                    {[m.sent_on, m.sent_at_time].filter(Boolean).join(" ") || "—"}
                  </span>
                </div>
                {m.body && <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.body}</div>}
                {m.attachment_name && (
                  <div style={{ fontSize: 11, color: "var(--att-text-2)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    <Paperclip size={11} /> {m.attachment_name}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}