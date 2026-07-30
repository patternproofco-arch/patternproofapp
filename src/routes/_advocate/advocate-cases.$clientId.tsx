import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { getAdvocateCase } from "@/lib/advocate.functions";
import { ACCESS_DISCLAIMER } from "@/components/AccessDisclaimer";

export const Route = createFileRoute("/_advocate/advocate-cases/$clientId")({
  component: AdvocateCaseView,
});

type CaseData = Awaited<ReturnType<typeof getAdvocateCase>>;
type Tab = "timeline" | "evidence" | "case" | "access";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "timeline", label: "Timeline" },
  { id: "evidence", label: "Evidence" },
  { id: "case", label: "Case summary" },
  { id: "access", label: "Your access" },
];

function AdvocateCaseView() {
  const { clientId } = Route.useParams();
  const getCase = useServerFn(getAdvocateCase);
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("timeline");

  useEffect(() => {
    getCase({ data: { clientId } })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "We couldn't open this case."));
  }, [getCase, clientId]);

  if (error) {
    return (
      <div className="card-pp" style={{ padding: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>This case isn't open to you right now</h1>
        <p style={{ fontSize: 13.5, color: "var(--muted-foreground)" }}>
          Access may have been withdrawn by the survivor. Anything you already exported stays with you; live access has ended.
        </p>
        <Link to="/advocate-cases" className="btn-ghost text-[13px]" style={{ marginTop: 12, display: "inline-block" }}>
          Back to cases
        </Link>
      </div>
    );
  }
  if (!data) return <p style={{ fontSize: 13 }}>Loading…</p>;

  const label = data.case?.case_name?.trim() || data.case?.other_party?.trim() || "Case";

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{label}</h1>
          <p style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>
            Read-only · {data.incidents.length} entries · {data.evidence.length} evidence items
          </p>
        </div>
        <button onClick={() => exportPacket(data, label)} className="btn-pp inline-flex items-center gap-2">
          <Download size={14} /> Export packet
        </button>
      </div>

      <nav className="mb-6 mt-5 flex flex-wrap gap-x-5 gap-y-2" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="text-[13px]"
            style={{
              color: tab === t.id ? "var(--foreground)" : "var(--muted-foreground)",
              fontWeight: tab === t.id ? 700 : 500,
              paddingBottom: 6, marginBottom: -9,
              borderBottom: tab === t.id ? "2px solid var(--pp-accent-org)" : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "timeline" && <TimelineTab data={data} />}
      {tab === "evidence" && <EvidenceTab data={data} />}
      {tab === "case" && <CaseTab data={data} />}
      {tab === "access" && <AccessTab data={data} />}
    </>
  );
}

function TimelineTab({ data }: { data: CaseData }) {
  if (data.incidents.length === 0) {
    return <p style={{ fontSize: 13.5, color: "var(--muted-foreground)" }}>No entries were shared with you.</p>;
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {data.incidents.map((i) => (
        <div key={i.id} className="card-pp" style={{ padding: 16, borderLeft: "3px solid var(--pp-accent-org)" }}>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {i.date}{i.time ? ` · ${i.time}` : ""}{i.location ? ` · ${i.location}` : ""}
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 6, whiteSpace: "pre-wrap" }}>{i.description}</p>
          {(i.abuse_types ?? []).length > 0 && (
            <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 8 }}>
              Tagged: {(i.abuse_types ?? []).join(", ")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EvidenceTab({ data }: { data: CaseData }) {
  if (data.evidence.length === 0) {
    return <p style={{ fontSize: 13.5, color: "var(--muted-foreground)" }}>No evidence was shared with you.</p>;
  }
  return (
    <>
      <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>
        Evidence is listed for context only. Original files stay with the survivor.
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        {data.evidence.map((e) => (
          <div key={e.id} className="card-pp" style={{ padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{e.title}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {e.date ?? "Date not set"}{e.file_type ? ` · ${e.file_type}` : ""}
            </div>
            {e.description && <p style={{ fontSize: 13, marginTop: 6, lineHeight: 1.55 }}>{e.description}</p>}
          </div>
        ))}
      </div>
    </>
  );
}

function CaseTab({ data }: { data: CaseData }) {
  const c = data.case;
  if (!c) return <p style={{ fontSize: 13.5, color: "var(--muted-foreground)" }}>No case summary has been built yet.</p>;
  const row = (l: string, v: string | null | undefined) =>
    v ? (
      <div style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.7 }}>
        <span style={{ color: "var(--muted-foreground)", minWidth: 130 }}>{l}</span>
        <span>{v}</span>
      </div>
    ) : null;
  return (
    <div className="card-pp" style={{ padding: 18 }}>
      {row("Other party", c.other_party)}
      {row("Relationship", c.relationship_type)}
      {row("Jurisdiction", c.jurisdiction)}
      {row("Case types", (c.case_types ?? []).join(", ") || null)}
      {c.pattern_summary && (
        <>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 14 }}>Summary written by the survivor</div>
          <p style={{ fontSize: 14, lineHeight: 1.65, marginTop: 4, whiteSpace: "pre-wrap" }}>{c.pattern_summary}</p>
        </>
      )}
      <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 16 }}>{ACCESS_DISCLAIMER}</p>
    </div>
  );
}

function AccessTab({ data }: { data: CaseData }) {
  const c = data.consent;
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString() : null);
  const row = (l: string, v: string) => (
    <div style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.7 }}>
      <span style={{ color: "var(--muted-foreground)", minWidth: 150 }}>{l}</span>
      <span>{v}</span>
    </div>
  );
  return (
    <div className="card-pp" style={{ padding: 18, borderLeft: "3px solid var(--pp-accent-org)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Access granted to you</div>
      {row("Granted", fmt(c.granted_at) ?? "—")}
      {row("Entries", c.include_all_incidents ? "All journal entries" : `${c.scoped_incident_count ?? 0} selected entries`)}
      {row("Evidence", c.include_all_evidence ? "All evidence items" : `${c.scoped_evidence_count ?? 0} selected items`)}
      {row("Pattern grouping", c.include_patterns ? "Included" : "Not shared")}
      {row("Scope", c.case_scoped ? "Single case" : "All of this person's cases")}
      {row(
        "Date window",
        c.date_range_start || c.date_range_end
          ? `${fmt(c.date_range_start) ?? "any"} — ${fmt(c.date_range_end) ?? "any"}`
          : "No date limit",
      )}
      {row("Expires", c.expires_at ? (fmt(c.expires_at) as string) : "No expiry set")}
      <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 12, lineHeight: 1.6 }}>
        The survivor may withdraw this access at any time. When she does, live access ends immediately — this page will
        stop opening. Anything you already exported stays on your own computer and is yours to handle under your
        organization's records policy.
      </p>
    </div>
  );
}

function exportPacket(data: CaseData, label: string) {
  try {
    const lines: string[] = [];
    lines.push(`PROFESSIONAL-REVIEW PACKET — ${label}`);
    lines.push(`Exported ${new Date().toLocaleString()}`);
    lines.push("");
    lines.push(ACCESS_DISCLAIMER);
    lines.push("");
    if (data.case) {
      lines.push("CASE SUMMARY");
      if (data.case.other_party) lines.push(`Other party: ${data.case.other_party}`);
      if (data.case.relationship_type) lines.push(`Relationship: ${data.case.relationship_type}`);
      if (data.case.jurisdiction) lines.push(`Jurisdiction: ${data.case.jurisdiction}`);
      if (data.case.pattern_summary) { lines.push(""); lines.push(data.case.pattern_summary); }
      lines.push("");
    }
    lines.push(`TIMELINE (${data.incidents.length})`);
    for (const i of data.incidents) {
      lines.push("");
      lines.push(`${i.date}${i.time ? ` ${i.time}` : ""}${i.location ? ` — ${i.location}` : ""}`);
      lines.push(i.description ?? "");
      if ((i.abuse_types ?? []).length) lines.push(`Tagged: ${(i.abuse_types ?? []).join(", ")}`);
    }
    lines.push("");
    lines.push(`EVIDENCE LIST (${data.evidence.length})`);
    for (const e of data.evidence) {
      lines.push(`- ${e.title}${e.date ? ` (${e.date})` : ""}${e.file_type ? ` [${e.file_type}]` : ""}`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `professional-review-packet-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    toast("We couldn't build that export. Try again in a moment.");
  }
}