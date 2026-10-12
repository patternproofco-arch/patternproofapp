import { useMemo, useState } from "react";
import { Download, FileText, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AttorneyWorkQueue } from "@/components/attorney/AttorneyWorkQueue";
import { BinderExhibits } from "@/components/BinderExhibits";
import { CourtTimeline } from "@/components/CourtTimeline";
import { DemoCard, demoButtonStyle } from "@/components/demo/DemoPortalShell";
import { buildBinderEntries } from "@/lib/binder";
import {
  EARLY_HOURS_LABEL,
  MATRIX_NOTES,
  buildFrequencyMatrix,
  rangeLine,
  summaryLine,
} from "@/lib/frequency-matrix";
import { pleadingParagraph } from "@/lib/pleading";
import {
  DEMO_ATTORNEY_CLIENTS,
  DEMO_FIRM,
  DEMO_MATRIX_MESSAGES,
  DEMO_WORK_QUEUE,
  getDemoAttorneyClient,
} from "@/lib/demo/fixtures-attorney";
import { DEMO_ONLY_TOAST } from "@/lib/demo/portals";

type BinderTab = "timeline" | "exhibits" | "pleading" | "matrix";

/**
 * Fictional attorney portal. Read-only, fixture data only. The work queue is the real
 * component in `linkMode="demo"`, so it never links into the signed-in attorney portal.
 */
export function DemoAttorneyPortal() {
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [tab, setTab] = useState<BinderTab>("timeline");
  const client = openClientId ? getDemoAttorneyClient(openClientId) : undefined;

  const open = (clientId: string, view: "binder" | "client") => {
    setOpenClientId(clientId);
    setTab(view === "binder" ? "exhibits" : "timeline");
  };

  return (
    <div className="att-root" data-persona="attorney" style={{ background: "transparent" }}>
      <div style={{ display: "grid", gap: 20 }}>
        <DemoCard title="Caseload (fictional)">
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--pp-muted)" }}>
            {DEMO_FIRM.attorney} · {DEMO_FIRM.name}. Contact details are placeholders:{" "}
            {DEMO_FIRM.email} · {DEMO_FIRM.phone}.
          </p>
          <AttorneyWorkQueue cards={DEMO_WORK_QUEUE} linkMode="demo" onOpenDemoClient={open} />
          <div style={{ display: "grid", gap: 8 }}>
            {DEMO_ATTORNEY_CLIENTS.map((c) => (
              <button
                key={c.clientId}
                type="button"
                onClick={() => open(c.clientId, "client")}
                aria-pressed={openClientId === c.clientId}
                style={{
                  ...demoButtonStyle,
                  justifyContent: "space-between",
                  width: "100%",
                  textAlign: "left",
                  background:
                    openClientId === c.clientId ? "var(--pp-ground-hi)" : "var(--pp-card)",
                }}
              >
                <span>
                  {c.displayName} · {c.matter}
                </span>
                <span style={{ fontSize: 12, color: "var(--pp-muted)" }}>
                  Shared since {c.sharedSince}
                </span>
              </button>
            ))}
          </div>
        </DemoCard>

        {client ? (
          <DemoBinder key={client.clientId} clientId={client.clientId} tab={tab} setTab={setTab} />
        ) : (
          <DemoCard>
            <p style={{ margin: 0, fontSize: 14, color: "var(--pp-muted)" }}>
              Choose a fictional client above to open their sample binder.
            </p>
          </DemoCard>
        )}
      </div>
    </div>
  );
}

function DemoBinder({
  clientId,
  tab,
  setTab,
}: {
  clientId: string;
  tab: BinderTab;
  setTab: (t: BinderTab) => void;
}) {
  const client = getDemoAttorneyClient(clientId)!;
  const entries = useMemo(
    () => buildBinderEntries(client.incidents, client.evidence, client.requests),
    [client],
  );
  const tabs: Array<[BinderTab, string]> = [
    ["timeline", "Chronology"],
    ["exhibits", "Exhibits"],
    ["pleading", "Declaration-format chronology"],
    ["matrix", "Message frequency"],
  ];
  return (
    <DemoCard title={`Binder · ${client.displayName}`}>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--pp-muted)" }}>
        {client.matter}. Placeholder contact: {client.contactEmail} · {client.contactPhone}.
      </p>
      <div
        role="tablist"
        aria-label="Binder sections"
        style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
      >
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            style={{
              ...demoButtonStyle,
              background: tab === key ? "var(--pp-accent)" : "var(--pp-card)",
              color: tab === key ? "var(--pp-accent-fg)" : "var(--pp-ink)",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        {tab === "timeline" && <CourtTimeline entries={entries} />}
        {tab === "exhibits" &&
          (entries.length ? (
            <BinderExhibits entries={entries} />
          ) : (
            <p style={{ fontSize: 14, color: "var(--pp-muted)" }}>Nothing shared yet.</p>
          ))}
        {tab === "pleading" && (
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8, fontSize: 14 }}>
            {entries.map((e, i) => (
              <li key={`${e.kind}-${e.id}`}>{pleadingParagraph(e, i + 1)}</li>
            ))}
          </ol>
        )}
        {tab === "matrix" && <DemoMatrix />}
      </div>
      <DemoDisabledActions />
    </DemoCard>
  );
}

function DemoMatrix() {
  const matrix = useMemo(() => buildFrequencyMatrix(DEMO_MATRIX_MESSAGES, { sources: [] }), []);
  const range = rangeLine(matrix);
  return (
    <div style={{ fontSize: 13 }}>
      <p style={{ margin: "0 0 6px" }}>{summaryLine(matrix)}</p>
      {range ? <p style={{ margin: "0 0 10px", color: "var(--pp-muted)" }}>{range}</p> : null}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={th}>Period</th>
              {matrix.columns.map((c) => (
                <th key={c.key} style={th}>
                  {c.label}
                </th>
              ))}
              <th style={th}>Total</th>
              <th style={th}>{EARLY_HOURS_LABEL}</th>
            </tr>
          </thead>
          <tbody>
            {[...matrix.rows, ...matrix.appendixRows].map((r) => (
              <tr key={r.key}>
                <td style={td}>{r.label}</td>
                {r.counts.map((n, i) => (
                  <td key={i} style={{ ...td, textAlign: "right" }}>
                    {n}
                  </td>
                ))}
                <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{r.total}</td>
                <td style={{ ...td, textAlign: "right" }}>{r.earlyHours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "var(--pp-muted)", fontSize: 12 }}>
        {MATRIX_NOTES.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}

const th = {
  textAlign: "left" as const,
  borderBottom: "1px solid var(--pp-muted)",
  padding: "4px 6px",
};
const td = { borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "4px 6px" };

function DemoDisabledActions() {
  const stub = () => toast.info(DEMO_ONLY_TOAST);
  return (
    <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 8 }}>
      <button type="button" style={demoButtonStyle} onClick={stub} aria-disabled="true">
        <Download size={14} /> Download binder (demo only)
      </button>
      <button type="button" style={demoButtonStyle} onClick={stub} aria-disabled="true">
        <FileText size={14} /> Export PDF (demo only)
      </button>
      <button type="button" style={demoButtonStyle} onClick={stub} aria-disabled="true">
        <Send size={14} /> Send to case software (demo only)
      </button>
      <button type="button" style={demoButtonStyle} onClick={stub} aria-disabled="true">
        <Share2 size={14} /> Request a file (demo only)
      </button>
    </div>
  );
}
