import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft, BookOpen, Calendar, FileText, Sparkles, Shield, MapPin,
  AlertTriangle, CheckCircle2, Mic, Paperclip, Info,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Interactive Demo — PatternProof" },
      { name: "description", content: "Explore PatternProof with a sample survivor case. No signup required — click through the journal, timeline, pattern analysis, and court packet." },
      { property: "og:title", content: "Interactive Demo — PatternProof" },
      { property: "og:description", content: "See how survivors document incidents and generate professional-review evidence. Sample case, no signup." },
    ],
  }),
  component: DemoPage,
});

type Incident = {
  id: string; date: string; time: string; location: string;
  abuse_types: string[]; description: string; witnesses?: string;
  emotional_impact?: string; evidence_ids: string[];
};
type Evidence = { id: string; title: string; kind: "photo" | "text" | "audio" | "doc"; date: string; note: string; };

const EVIDENCE: Evidence[] = [
  { id: "e1", kind: "text", title: "Text thread — 'you'll never see them again'", date: "2025-09-14", note: "47 messages, 11:42pm–1:08am" },
  { id: "e2", kind: "audio", title: "Voice note: pickup at school", date: "2025-10-02", note: "1m 38s — raised voice, in front of children" },
  { id: "e3", kind: "photo", title: "Photo — broken door frame", date: "2025-10-19", note: "Front door, after argument" },
  { id: "e4", kind: "doc", title: "Bank statement — joint account", date: "2025-11-03", note: "$3,200 withdrawn without notice" },
  { id: "e5", kind: "text", title: "Email from school counselor", date: "2025-11-21", note: "Child reported being told mom 'doesn't love them'" },
  { id: "e6", kind: "photo", title: "Screenshot — co-parenting app", date: "2025-12-08", note: "Refused medical decision, 4 days no response" },
];

const INCIDENTS: Incident[] = [
  { id: "i1", date: "2025-09-14", time: "11:42 PM", location: "Home — kitchen", abuse_types: ["Emotional", "Coercive control"], description: "After I mentioned looking at apartments, he sent 47 text messages over nearly two hours, escalating from pleading to threats about custody. Said I'd 'never see them again' if I left.", emotional_impact: "Couldn't sleep. Stayed in the closet with my phone in case I needed to call someone.", evidence_ids: ["e1"] },
  { id: "i2", date: "2025-10-02", time: "3:15 PM", location: "Lincoln Elementary — pickup line", abuse_types: ["Emotional", "Custody interference"], description: "Yelled at me in front of the kids during exchange. Other parents heard. Refused to hand over the youngest's medication.", witnesses: "Two parents from the carpool, Ms. Alvarez (teacher)", emotional_impact: "The kids were quiet the whole drive home. The youngest asked if Dad was mad at her.", evidence_ids: ["e2"] },
  { id: "i3", date: "2025-10-19", time: "9:50 PM", location: "Home — front door", abuse_types: ["Physical", "Emotional"], description: "Came home unannounced after I changed the locks. Kicked the door frame until it splintered. Left when I said I was calling 911.", emotional_impact: "Hands shook for an hour. Slept with the dresser pushed against the door.", evidence_ids: ["e3"] },
  { id: "i4", date: "2025-11-03", time: "10:30 AM", location: "Online — banking app", abuse_types: ["Financial"], description: "Discovered $3,200 withdrawn from the joint account. No notice. When asked, said it was 'his money anyway.'", evidence_ids: ["e4"] },
  { id: "i5", date: "2025-11-21", time: "2:00 PM", location: "Phone call from school", abuse_types: ["Emotional", "Custody interference"], description: "School counselor called. Our 8-year-old said dad told them I 'don't love them anymore' and was 'trying to take them away.'", witnesses: "Ms. Reyes, school counselor", emotional_impact: "I sat in the parking lot and cried for 20 minutes before I could drive.", evidence_ids: ["e5"] },
  { id: "i6", date: "2025-12-08", time: "6:45 PM", location: "Co-parenting app", abuse_types: ["Custody interference"], description: "Did not respond for four days to a request to approve a dental procedure for the youngest. Tooth abscess worsened.", evidence_ids: ["e6"] },
];

const PATTERNS = [
  { title: "Escalation around separation triggers", severity: "high" as const, body: "Each time you raised separation, housing, or legal steps, retaliatory behavior occurred within 72 hours (Sept 14, Oct 19, Nov 3). Courts recognize this temporal pattern as evidence of coercive control.", incidents: ["i1", "i3", "i4"] },
  { title: "Children used as leverage", severity: "high" as const, body: "Three incidents involve direct manipulation of the children — withholding medication, telling them you don't love them, refusing medical consent. This pattern is documented in custody cases as parental alienation behavior.", incidents: ["i2", "i5", "i6"] },
  { title: "Financial control alongside emotional escalation", severity: "medium" as const, body: "The Nov 3 unauthorized withdrawal happened the same week as the school counselor incident, suggesting coordinated pressure across multiple domains rather than isolated outbursts.", incidents: ["i4", "i5"] },
];

type Tab = "overview" | "journal" | "timeline" | "patterns" | "evidence" | "packet";

function DemoPage() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F0", color: "#1F1A2E", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      <DemoHeader />
      <DemoBanner />
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px 80px" }}>
        <TabBar tab={tab} setTab={setTab} />
        <div style={{ marginTop: 24 }}>
          {tab === "overview" && <Overview onJump={setTab} />}
          {tab === "journal" && <Journal />}
          {tab === "timeline" && <Timeline />}
          {tab === "patterns" && <Patterns />}
          {tab === "evidence" && <EvidenceLibrary />}
          {tab === "packet" && <CourtPacket />}
        </div>
      </div>
    </div>
  );
}

function DemoHeader() {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 8px" }}>
      <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B5FA4", textDecoration: "none", fontWeight: 500 }}>
        <ArrowLeft size={14} /> Back to home
      </Link>
      <div style={{ marginTop: 18, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#5B4CD6", fontWeight: 700, marginBottom: 8 }}>Interactive demo</div>
          <h1 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>A sample case, end-to-end</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#6B6478", maxWidth: 620 }}>This is fictional composite data based on common patterns in coercive-control cases. Click around — nothing here is saved.</p>
        </div>
        <Link to="/login" style={{ background: "#5B4BA4", color: "white", padding: "10px 18px", borderRadius: 2, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Start your own case →</Link>
      </div>
    </div>
  );
}

function DemoBanner() {
  return (
    <div style={{ maxWidth: 1080, margin: "16px auto 0", padding: "0 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255, 235, 180, 0.45)", border: "1px solid rgba(180, 140, 60, 0.25)", borderRadius: 2, padding: "10px 14px", fontSize: 13, color: "#5C4520" }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <div><strong>Demo mode.</strong> Buttons like "Save", "Upload", or "Export" won't do anything — this case is read-only sample data. To document a real case, <Link to="/login" style={{ color: "#5B4BA4", fontWeight: 600 }}>create an account</Link>.</div>
      </div>
    </div>
  );
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: Array<{ key: Tab; label: string; icon: typeof BookOpen }> = [
    { key: "overview", label: "Overview", icon: Shield },
    { key: "journal", label: "Journal", icon: BookOpen },
    { key: "timeline", label: "Timeline", icon: Calendar },
    { key: "patterns", label: "Patterns", icon: Sparkles },
    { key: "evidence", label: "Evidence", icon: Paperclip },
    { key: "packet", label: "Court Packet", icon: FileText },
  ];
  return (
    <div style={{ marginTop: 28, display: "flex", gap: 4, overflowX: "auto", background: "white", padding: 6, borderRadius: 2, border: "1px solid rgba(91,75,164,0.12)", boxShadow: "none" }}>
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = tab === t.key;
        return (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 2, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", whiteSpace: "nowrap", background: active ? "#5B4BA4" : "transparent", color: active ? "white" : "#5A5469" }}>
            <Icon size={14} /> {t.label}
          </button>
        );
      })}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "white", borderRadius: 2, padding: 20, border: "1px solid rgba(91,75,164,0.10)", boxShadow: "none", ...style }}>{children}</div>;
}

function Overview({ onJump }: { onJump: (t: Tab) => void }) {
  const stats = [
    { label: "Documented incidents", value: INCIDENTS.length, icon: BookOpen },
    { label: "Evidence items linked", value: EVIDENCE.length, icon: Paperclip },
    { label: "Patterns detected", value: PATTERNS.length, icon: Sparkles },
    { label: "Months of history", value: 4, icon: Calendar },
  ];
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <Card>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Sample case: "M.R. v. T.R."</h2>
        <p style={{ marginTop: 8, fontSize: 14, color: "#5A5469", lineHeight: 1.6 }}>A custody matter with documented emotional abuse, coercive control, financial interference, and one physical incident. Four months of documentation, ready for an attorney consultation.</p>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          {stats.map((s) => {
            const I = s.icon;
            return (
              <div key={s.label} style={{ background: "rgba(91,75,164,0.05)", borderRadius: 2, padding: 14 }}>
                <I size={16} style={{ color: "#5B4CD6" }} />
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#6B6478" }}>{s.label}</div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>What to explore</h3>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {([
            ["journal", "Journal — see how survivors capture an incident in under a minute"],
            ["timeline", "Timeline — six events plotted chronologically"],
            ["patterns", "Patterns — what the AI surfaces that one-off incidents miss"],
            ["packet", "Court Packet — the attorney-ready output"],
          ] as Array<[Tab, string]>).map(([key, label]) => (
            <button key={key} onClick={() => onJump(key)} style={{ textAlign: "left", background: "transparent", border: "1px solid rgba(91,75,164,0.15)", padding: "10px 14px", borderRadius: 2, fontSize: 13, color: "#1F1A2E", cursor: "pointer" }}>{label} →</button>
          ))}
        </div>
      </Card>
    </div>
  );
}

const TYPE_COLORS: Record<string, string> = {
  "Physical": "#C2553B", "Emotional": "#5B4CD6", "Coercive control": "#5B4BA4",
  "Financial": "#3F8A6E", "Custody interference": "#B5732A",
};

function TypeBadge({ t }: { t: string }) {
  const color = TYPE_COLORS[t] ?? "#5A5469";
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 2, background: color + "18", color, border: "1px solid " + color + "30" }}>{t}</span>;
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function IncidentRow({ inc }: { inc: Incident }) {
  const evidence = EVIDENCE.filter((e) => inc.evidence_ids.includes(e.id));
  return (
    <Card style={{ borderLeft: "3px solid " + (TYPE_COLORS[inc.abuse_types[0]] ?? "#5B4BA4") }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{formatDate(inc.date)} · {inc.time}</div>
        <div style={{ fontSize: 12, color: "#6B6478", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <MapPin size={12} /> {inc.location}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {inc.abuse_types.map((t) => <TypeBadge key={t} t={t} />)}
      </div>
      <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "#2A2440" }}>{inc.description}</p>
      {inc.witnesses && <div style={{ fontSize: 12, color: "#6B6478", marginTop: 6 }}><strong style={{ color: "#5A5469" }}>Witnesses:</strong> {inc.witnesses}</div>}
      {inc.emotional_impact && <div style={{ fontSize: 12, color: "#6B6478", marginTop: 4, fontStyle: "italic" }}>"{inc.emotional_impact}"</div>}
      {evidence.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed rgba(91,75,164,0.15)", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {evidence.map((e) => (
            <span key={e.id} style={{ fontSize: 11, color: "#5A5469", background: "rgba(91,75,164,0.06)", padding: "3px 8px", borderRadius: 2, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Paperclip size={11} /> {e.title}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function Journal() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Journal</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B6478" }}>Every incident, captured in the survivor's own words.</p>
        </div>
        <button onClick={() => toast.info("Demo mode — log an incident on your real account.")} style={demoButton}>+ Log incident</button>
      </div>
      {INCIDENTS.map((i) => <IncidentRow key={i.id} inc={i} />)}
    </div>
  );
}

function Timeline() {
  const sorted = useMemo(() => [...INCIDENTS].sort((a, b) => a.date.localeCompare(b.date)), []);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Timeline</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B6478" }}>Chronological view — what attorneys read first.</p>
      </Card>
      <div style={{ position: "relative", paddingLeft: 22 }}>
        <div style={{ position: "absolute", left: 7, top: 6, bottom: 6, width: 2, background: "rgba(91,75,164,0.18)" }} />
        {sorted.map((inc) => (
          <div key={inc.id} style={{ position: "relative", marginBottom: 14 }}>
            <div style={{ position: "absolute", left: -22, top: 16, width: 12, height: 12, borderRadius: 999, background: TYPE_COLORS[inc.abuse_types[0]] ?? "#5B4BA4", border: "2px solid white", boxShadow: "none" }} />
            <IncidentRow inc={inc} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Patterns() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Pattern analysis</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B6478" }}>What's hard to see one incident at a time — surfaced across the whole record.</p>
      </Card>
      {PATTERNS.map((p) => {
        const sev = p.severity === "high" ? "#C2553B" : "#B5732A";
        return (
          <Card key={p.title} style={{ borderLeft: "3px solid " + sev }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={16} style={{ color: sev }} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{p.title}</h3>
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: sev }}>{p.severity} severity</span>
            </div>
            <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "#2A2440" }}>{p.body}</p>
            <div style={{ marginTop: 10, fontSize: 12, color: "#6B6478" }}>Drawn from {p.incidents.length} incidents: {p.incidents.map((id) => formatDate(INCIDENTS.find((i) => i.id === id)!.date)).join(" · ")}</div>
          </Card>
        );
      })}
    </div>
  );
}

function EvidenceLibrary() {
  const icons = { photo: Paperclip, text: BookOpen, audio: Mic, doc: FileText };
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Evidence library</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B6478" }}>Every file is linked to the incident it belongs to.</p>
        </div>
        <button onClick={() => toast.info("Demo mode — uploads are disabled.")} style={demoButton}>+ Upload</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {EVIDENCE.map((e) => {
          const I = icons[e.kind];
          return (
            <Card key={e.id}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 32, height: 32, borderRadius: 2, background: "rgba(91,75,164,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#5B4BA4", flexShrink: 0 }}>
                  <I size={16} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: "#6B6478", marginTop: 2 }}>{formatDate(e.date)} · {e.kind}</div>
                  <div style={{ fontSize: 12, color: "#5A5469", marginTop: 6 }}>{e.note}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CourtPacket() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Court packet preview</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B6478" }}>Attorney-ready summary of the entire case — generated from your records.</p>
        </div>
        <button onClick={() => toast.info("Demo mode — exports are disabled. Sign up to generate a real packet.")} style={demoButton}>Export (.docx)</button>
      </div>
      <Card>
        <div style={{ borderBottom: "1px solid rgba(91,75,164,0.12)", paddingBottom: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#5B4CD6", fontWeight: 700 }}>Case Summary</div>
          <h3 style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 700 }}>M.R. v. T.R. — Custody &amp; Coercive Control</h3>
          <div style={{ fontSize: 12, color: "#6B6478", marginTop: 4 }}>Reporting period: Sept 14, 2025 – Dec 8, 2025 · {INCIDENTS.length} incidents · {EVIDENCE.length} evidence items</div>
        </div>
        <Section title="Overview">
          <p style={prose}>Petitioner documents a sustained pattern of emotional abuse, coercive control, and custody interference by Respondent over a four-month period, including one physical incident (Oct 19, 2025) and one financial interference incident (Nov 3, 2025).</p>
        </Section>
        <Section title="Patterns identified">
          <ul style={list}>
            {PATTERNS.map((p) => (<li key={p.title}><strong>{p.title}.</strong> {p.body}</li>))}
          </ul>
        </Section>
        <Section title="Incident index">
          <ol style={list}>
            {INCIDENTS.map((i) => (<li key={i.id}><strong>{formatDate(i.date)} — {i.location}.</strong> {i.abuse_types.join(", ")}.</li>))}
          </ol>
        </Section>
        <Section title="Evidence index">
          <ol style={list}>
            {EVIDENCE.map((e) => (<li key={e.id}><strong>{e.title}</strong> ({formatDate(e.date)}) — {e.note}</li>))}
          </ol>
        </Section>
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(91,75,164,0.12)", display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "#3F8A6E" }}>
          <CheckCircle2 size={14} /> Certified: every incident in this packet is linked to dated, timestamped evidence in the survivor's record.
        </div>
      </Card>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "#5B4BA4", textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</h4>
      {children}
    </div>
  );
}

const prose: React.CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.65, color: "#2A2440" };
const list: React.CSSProperties = { ...prose, paddingLeft: 20, display: "grid", gap: 6 };
const demoButton: React.CSSProperties = { background: "white", color: "#5B4BA4", padding: "8px 14px", borderRadius: 2, border: "1px solid rgba(91,75,164,0.25)", fontSize: 13, fontWeight: 600, cursor: "pointer" };
