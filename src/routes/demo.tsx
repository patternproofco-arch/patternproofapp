import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  FileText,
  Sparkles,
  Shield,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Mic,
  Paperclip,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { PublicQuickExit } from "@/components/PublicQuickExit";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Interactive Demo — PatternProof" },
      {
        name: "description",
        content:
          "Explore PatternProof with a sample survivor case. No signup required — click through the journal, timeline, pattern analysis, and professional-review packet.",
      },
      { property: "og:title", content: "Interactive Demo — PatternProof" },
      {
        property: "og:description",
        content:
          "See how survivors document incidents and generate professional-review evidence. Sample case, no signup.",
      },
    ],
  }),
  component: DemoPage,
});

type Incident = {
  id: string;
  date: string;
  time: string;
  location: string;
  abuse_types: string[];
  description: string;
  witnesses?: string;
  emotional_impact?: string;
  evidence_ids: string[];
};
type Evidence = {
  id: string;
  title: string;
  kind: "photo" | "text" | "audio" | "doc";
  date: string;
  note: string;
};

const EVIDENCE: Evidence[] = [
  {
    id: "e1",
    kind: "text",
    title: "Text thread — 'you'll never see them again'",
    date: "2025-09-14",
    note: "47 messages, 11:42pm–1:08am",
  },
  {
    id: "e2",
    kind: "audio",
    title: "Voice note: pickup at school",
    date: "2025-10-02",
    note: "1m 38s — raised voice, in front of children",
  },
  {
    id: "e3",
    kind: "photo",
    title: "Photo — broken door frame",
    date: "2025-10-19",
    note: "Front door, after argument",
  },
  {
    id: "e4",
    kind: "doc",
    title: "Bank statement — joint account",
    date: "2025-11-03",
    note: "$3,200 withdrawn without notice",
  },
  {
    id: "e5",
    kind: "text",
    title: "Email from school counselor",
    date: "2025-11-21",
    note: "Child reported being told mom 'doesn't love them'",
  },
  {
    id: "e6",
    kind: "photo",
    title: "Screenshot — co-parenting app",
    date: "2025-12-08",
    note: "Refused medical decision, 4 days no response",
  },
];

const INCIDENTS: Incident[] = [
  {
    id: "i1",
    date: "2025-09-14",
    time: "11:42 PM",
    location: "Home — kitchen",
    abuse_types: ["Emotional", "Coercive control"],
    description:
      "After I mentioned looking at apartments, he sent 47 text messages over nearly two hours, escalating from pleading to threats about custody. Said I'd 'never see them again' if I left.",
    emotional_impact:
      "Couldn't sleep. Stayed in the closet with my phone in case I needed to call someone.",
    evidence_ids: ["e1"],
  },
  {
    id: "i2",
    date: "2025-10-02",
    time: "3:15 PM",
    location: "Lincoln Elementary — pickup line",
    abuse_types: ["Emotional", "Custody interference"],
    description:
      "Yelled at me in front of the kids during exchange. Other parents heard. Refused to hand over the youngest's medication.",
    witnesses: "Two parents from the carpool, Ms. Alvarez (teacher)",
    emotional_impact:
      "The kids were quiet the whole drive home. The youngest asked if Dad was mad at her.",
    evidence_ids: ["e2"],
  },
  {
    id: "i3",
    date: "2025-10-19",
    time: "9:50 PM",
    location: "Home — front door",
    abuse_types: ["Physical", "Emotional"],
    description:
      "Came home unannounced after I changed the locks. Kicked the door frame until it splintered. Left when I said I was calling 911.",
    emotional_impact: "Hands shook for an hour. Slept with the dresser pushed against the door.",
    evidence_ids: ["e3"],
  },
  {
    id: "i4",
    date: "2025-11-03",
    time: "10:30 AM",
    location: "Online — banking app",
    abuse_types: ["Financial"],
    description:
      "Discovered $3,200 withdrawn from the joint account. No notice. When asked, said it was 'his money anyway.'",
    evidence_ids: ["e4"],
  },
  {
    id: "i5",
    date: "2025-11-21",
    time: "2:00 PM",
    location: "Phone call from school",
    abuse_types: ["Emotional", "Custody interference"],
    description:
      "School counselor called. Our 8-year-old said dad told them I 'don't love them anymore' and was 'trying to take them away.'",
    witnesses: "Ms. Reyes, school counselor",
    emotional_impact: "I sat in the parking lot and cried for 20 minutes before I could drive.",
    evidence_ids: ["e5"],
  },
  {
    id: "i6",
    date: "2025-12-08",
    time: "6:45 PM",
    location: "Co-parenting app",
    abuse_types: ["Custody interference"],
    description:
      "Did not respond for four days to a request to approve a dental procedure for the youngest. Tooth abscess worsened.",
    evidence_ids: ["e6"],
  },
];

const PATTERNS = [
  {
    title: "Entries clustered after separation steps",
    body: "Three logged entries (Sept 14, Oct 19, Nov 3) each fall within 72 hours of an entry mentioning separation, housing, or legal steps. This is a count of what was logged, not a legal conclusion.",
    incidents: ["i1", "i3", "i4"],
  },
  {
    title: "Entries involving the children",
    body: "Three entries describe the children directly — withholding medication, statements made to them, and a refused medical consent. Grouped by shared subject, as recorded by the survivor.",
    incidents: ["i2", "i5", "i6"],
  },
  {
    title: "Financial entry in the same week as another entry",
    body: "The Nov 3 unauthorized-withdrawal entry and the school counselor entry were logged in the same week. Dates and counts only — PatternProof does not interpret intent.",
    incidents: ["i4", "i5"],
  },
];

type Tab = "overview" | "journal" | "timeline" | "patterns" | "evidence" | "packet";

function DemoPage() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--pp-paper, #FAF8F4)",
        color: "var(--pp-ink)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <PublicQuickExit />
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
      <Link
        to="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "var(--pp-accent)",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        <ArrowLeft size={14} /> Back to home
      </Link>
      <div
        style={{
          marginTop: 18,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--pp-accent)",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Interactive demo
          </div>
          <h1
            style={{
              fontSize: "clamp(1.8rem, 3.5vw, 2.4rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            A sample case, end-to-end
          </h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "var(--pp-muted)", maxWidth: 620 }}>
            This is fictional composite data based on common patterns in coercive-control cases.
            Click around — nothing here is saved.
          </p>
        </div>
        <Link
          to="/signup"
          style={{
            background: "var(--pp-accent)",
            color: "white",
            padding: "10px 18px",
            borderRadius: 18,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Start your own case →
        </Link>
      </div>
    </div>
  );
}

function DemoBanner() {
  return (
    <div style={{ maxWidth: 1080, margin: "16px auto 0", padding: "0 20px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          background: "var(--pp-ground)",
          boxShadow: "var(--pp-shadow-in-sm)",
          borderRadius: 18,
          padding: "10px 14px",
          fontSize: 13,
          color: "var(--pp-warning)",
        }}
      >
        <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>Demo mode.</strong> Buttons like "Save", "Upload", or "Export" won't do anything —
          this case is read-only sample data. To document a real case,{" "}
          <Link to="/signup" style={{ color: "var(--pp-accent)", fontWeight: 600 }}>
            create an account
          </Link>
          .
        </div>
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
    { key: "packet", label: "Professional-review packet", icon: FileText },
  ];
  return (
    <div
      style={{
        marginTop: 28,
        display: "flex",
        gap: 4,
        overflowX: "auto",
        background: "white",
        padding: 6,
        borderRadius: 18,
        border: "1px solid rgba(65,50,180,0.12)",
        boxShadow: "var(--pp-shadow-sm)",
      }}
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 14px",
              borderRadius: 18,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
              background: active ? "var(--pp-accent)" : "transparent",
              color: active ? "white" : "#5A5469",
            }}
          >
            <Icon size={14} /> {t.label}
          </button>
        );
      })}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 18,
        padding: 20,
        border: "1px solid rgba(65,50,180,0.10)",
        boxShadow: "var(--pp-shadow-sm)",
        ...style,
      }}
    >
      {children}
    </div>
  );
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
        <p style={{ marginTop: 8, fontSize: 14, color: "#5A5469", lineHeight: 1.6 }}>
          A custody matter with documented emotional abuse, coercive control, financial
          interference, and one physical incident. Four months of documentation, ready for an
          attorney consultation.
        </p>
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
          }}
        >
          {stats.map((s) => {
            const I = s.icon;
            return (
              <div
                key={s.label}
                style={{ background: "rgba(65,50,180,0.05)", borderRadius: 18, padding: 14 }}
              >
                <I size={16} style={{ color: "var(--pp-accent)" }} />
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "var(--pp-muted)" }}>{s.label}</div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>What to explore</h3>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {(
            [
              ["journal", "Journal — see how survivors capture an incident in under a minute"],
              ["timeline", "Timeline — six events plotted chronologically"],
              ["patterns", "Patterns — recurrence across entries, counted not interpreted"],
              ["packet", "Professional-review packet — the shareable output"],
            ] as Array<[Tab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => onJump(key)}
              style={{
                textAlign: "left",
                background: "transparent",
                border: "1px solid rgba(65,50,180,0.15)",
                padding: "10px 14px",
                borderRadius: 18,
                fontSize: 13,
                color: "var(--pp-ink)",
                cursor: "pointer",
              }}
            >
              {label} →
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

const TYPE_COLORS: Record<string, string> = {
  Physical: "var(--color-type-physical)",
  Emotional: "var(--color-type-emotional)",
  "Coercive control": "var(--color-type-coercive)",
  Financial: "var(--color-type-financial)",
  "Custody interference": "var(--color-type-custody)",
};

function TypeBadge({ t }: { t: string }) {
  const color = TYPE_COLORS[t] ?? "#5A5469";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 18,
        background: color + "18",
        color,
        border: "1px solid " + color + "30",
      }}
    >
      {t}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function IncidentRow({ inc }: { inc: Incident }) {
  const evidence = EVIDENCE.filter((e) => inc.evidence_ids.includes(e.id));
  return (
    <Card style={{ borderLeft: "3px solid " + (TYPE_COLORS[inc.abuse_types[0]] ?? "var(--pp-accent)") }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {formatDate(inc.date)} · {inc.time}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--pp-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <MapPin size={12} /> {inc.location}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {inc.abuse_types.map((t) => (
          <TypeBadge key={t} t={t} />
        ))}
      </div>
      <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "#2A2440" }}>
        {inc.description}
      </p>
      {inc.witnesses && (
        <div style={{ fontSize: 12, color: "var(--pp-muted)", marginTop: 6 }}>
          <strong style={{ color: "#5A5469" }}>Witnesses:</strong> {inc.witnesses}
        </div>
      )}
      {inc.emotional_impact && (
        <div style={{ fontSize: 12, color: "var(--pp-muted)", marginTop: 4, fontStyle: "italic" }}>
          "{inc.emotional_impact}"
        </div>
      )}
      {evidence.length > 0 && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px dashed rgba(65,50,180,0.15)",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {evidence.map((e) => (
            <span
              key={e.id}
              style={{
                fontSize: 11,
                color: "#5A5469",
                background: "rgba(65,50,180,0.06)",
                padding: "3px 8px",
                borderRadius: 18,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Journal</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--pp-muted)" }}>
            Every incident, captured in the survivor's own words.
          </p>
        </div>
        <button
          onClick={() => toast.info("Demo mode — log an incident on your real account.")}
          style={demoButton}
        >
          + Log incident
        </button>
      </div>
      {INCIDENTS.map((i) => (
        <IncidentRow key={i.id} inc={i} />
      ))}
    </div>
  );
}

function Timeline() {
  const sorted = useMemo(() => [...INCIDENTS].sort((a, b) => a.date.localeCompare(b.date)), []);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Timeline</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--pp-muted)" }}>
          Chronological view — what attorneys read first.
        </p>
      </Card>
      <div style={{ position: "relative", paddingLeft: 22 }}>
        <div
          style={{
            position: "absolute",
            left: 7,
            top: 6,
            bottom: 6,
            width: 2,
            background: "rgba(65,50,180,0.18)",
          }}
        />
        {sorted.map((inc) => (
          <div key={inc.id} style={{ position: "relative", marginBottom: 14 }}>
            <div
              style={{
                position: "absolute",
                left: -22,
                top: 16,
                width: 12,
                height: 12,
                borderRadius: 999,
                background: TYPE_COLORS[inc.abuse_types[0]] ?? "var(--pp-accent)",
                border: "2px solid white",
                boxShadow: "var(--pp-shadow-sm)",
              }}
            />
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
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--pp-muted)" }}>
          What's hard to see one incident at a time — surfaced across the whole record.
        </p>
      </Card>
      {PATTERNS.map((p) => {
        const sev = "var(--pp-accent)";
        return (
          <Card key={p.title} style={{ borderLeft: "3px solid " + sev }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={16} style={{ color: sev }} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{p.title}</h3>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: sev,
                }}
              >
                {p.incidents.length} entries
              </span>
            </div>
            <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "#2A2440" }}>
              {p.body}
            </p>
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--pp-muted)" }}>
              Drawn from {p.incidents.length} incidents:{" "}
              {p.incidents
                .map((id) => formatDate(INCIDENTS.find((i) => i.id === id)!.date))
                .join(" · ")}
            </div>
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Evidence library</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--pp-muted)" }}>
            Every file is linked to the incident it belongs to.
          </p>
        </div>
        <button onClick={() => toast.info("Demo mode — uploads are disabled.")} style={demoButton}>
          + Upload
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        {EVIDENCE.map((e) => {
          const I = icons[e.kind];
          return (
            <Card key={e.id}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 18,
                    background: "rgba(65,50,180,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--pp-accent)",
                    flexShrink: 0,
                  }}
                >
                  <I size={16} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: "var(--pp-muted)", marginTop: 2 }}>
                    {formatDate(e.date)} · {e.kind}
                  </div>
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Professional-review packet preview</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--pp-muted)" }}>
            A source-linked summary of the case — generated from your records for professional
            review.
          </p>
        </div>
        <button
          onClick={() =>
            toast.info("Demo mode — exports are disabled. Sign up to generate a real packet.")
          }
          style={demoButton}
        >
          Export packet (PDF)
        </button>
      </div>
      <Card>
        <div
          style={{
            borderBottom: "1px solid rgba(65,50,180,0.12)",
            paddingBottom: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--pp-accent)",
              fontWeight: 700,
            }}
          >
            Case Summary
          </div>
          <h3 style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 700 }}>
            M.R. v. T.R. — Custody &amp; Coercive Control
          </h3>
          <div style={{ fontSize: 12, color: "var(--pp-muted)", marginTop: 4 }}>
            Reporting period: Sept 14, 2025 – Dec 8, 2025 · {INCIDENTS.length} incidents ·{" "}
            {EVIDENCE.length} evidence items
          </div>
        </div>
        <Section title="Overview">
          <p style={prose}>
            Petitioner documents a sustained pattern of emotional abuse, coercive control, and
            custody interference by Respondent over a four-month period, including one physical
            incident (Oct 19, 2025) and one financial interference incident (Nov 3, 2025).
          </p>
        </Section>
        <Section title="Patterns identified">
          <ul style={list}>
            {PATTERNS.map((p) => (
              <li key={p.title}>
                <strong>{p.title}.</strong> {p.body}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Incident index">
          <ol style={list}>
            {INCIDENTS.map((i) => (
              <li key={i.id}>
                <strong>
                  {formatDate(i.date)} — {i.location}.
                </strong>{" "}
                {i.abuse_types.join(", ")}.
              </li>
            ))}
          </ol>
        </Section>
        <Section title="Evidence index">
          <ol style={list}>
            {EVIDENCE.map((e) => (
              <li key={e.id}>
                <strong>{e.title}</strong> ({formatDate(e.date)}) — {e.note}
              </li>
            ))}
          </ol>
        </Section>
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid var(--pp-hairline)",
            display: "flex",
            gap: 8,
            alignItems: "center",
            fontSize: 12,
            color: "var(--safe)",
          }}
        >
          <CheckCircle2 size={14} /> Every incident in this packet links back to a dated entry in
          the survivor's record. PatternProof does not certify content or determine admissibility.
        </div>
      </Card>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4
        style={{
          margin: "0 0 6px",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--pp-accent)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {title}
      </h4>
      {children}
    </div>
  );
}

const prose: React.CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.65, color: "#2A2440" };
const list: React.CSSProperties = { ...prose, paddingLeft: 20, display: "grid", gap: 6 };
const demoButton: React.CSSProperties = {
  background: "white",
  color: "var(--pp-accent)",
  padding: "8px 14px",
  borderRadius: 18,
  border: "1px solid rgba(65,50,180,0.25)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
