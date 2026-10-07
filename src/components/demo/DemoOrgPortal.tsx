import { useMemo } from "react";
import { Download, CheckCircle2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { DemoCard, demoButtonStyle } from "@/components/demo/DemoPortalShell";
import { deriveGrantMetrics } from "@/lib/grant-report-derive";
import {
  DEFAULT_TEMPLATE,
  SECTION_LABEL,
  VALUE_STATE_LABEL,
  resolveRow,
  type ResolvedRow,
  type Section,
} from "@/lib/grant-report-model";
import {
  DEMO_ORG,
  DEMO_ORG_FOLLOW_UPS,
  DEMO_ORG_LINKS,
  DEMO_ORG_REFERRALS,
  DEMO_ORG_REFERRAL_SOURCES,
  DEMO_ORG_STAFF,
} from "@/lib/demo/fixtures-org";
import { DEMO_ONLY_TOAST } from "@/lib/demo/portals";

/**
 * Fictional organization partner portal. Simplified fixture UI: the live GrantReport,
 * OrgOversight, and OrgTeamSettings components are NOT mounted here (they call server
 * functions). Numbers come from the pure deriveGrantMetrics helper over fixture rows.
 */
export function DemoOrgPortal() {
  const { derived, caveats } = useMemo(
    () =>
      deriveGrantMetrics({
        links: DEMO_ORG_LINKS,
        followUps: DEMO_ORG_FOLLOW_UPS,
        referrals: DEMO_ORG_REFERRALS,
        from: DEMO_ORG.periodFrom,
        to: DEMO_ORG.periodTo,
        timeZone: DEMO_ORG.timeZone,
      }),
    [],
  );
  const rows = useMemo(
    () => DEFAULT_TEMPLATE.rows.map((spec) => resolveRow(spec, derived, undefined)),
    [derived],
  );
  const bySection = useMemo(() => {
    const m = new Map<Section, ResolvedRow[]>();
    for (const r of rows) m.set(r.section, [...(m.get(r.section) ?? []), r]);
    return [...m.entries()];
  }, [rows]);

  const stats: Array<[string, number | null | undefined]> = [
    ["Survivors who shared records this quarter", derived.clients_who_shared_records],
    ["Referrals recorded", derived.referrals_recorded],
    ["Follow-ups recorded", derived.follow_ups_created],
    ["Follow-ups completed", derived.follow_ups_completed],
  ];
  const stub = () => toast.info(DEMO_ONLY_TOAST);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <DemoCard title={DEMO_ORG.name}>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--pp-muted)" }}>
          Sample quarter {DEMO_ORG.periodFrom} to {DEMO_ORG.periodTo}. Placeholder contact:{" "}
          {DEMO_ORG.contactEmail} · {DEMO_ORG.phone}.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {stats.map(([label, value]) => (
            <div
              key={label}
              style={{
                background: "var(--pp-ground-hi)",
                boxShadow: "var(--pp-shadow-in-sm)",
                borderRadius: 18,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {typeof value === "number" ? value : "Unknown"}
              </div>
              <div style={{ fontSize: 12, color: "var(--pp-muted)" }}>{label}</div>
            </div>
          ))}
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--pp-muted)" }}>
          Counts of fictional records only. Survivors choose what to share.
        </p>
      </DemoCard>

      <DemoCard title="Referral sources (fictional)">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, display: "grid", gap: 4 }}>
          {DEMO_ORG_REFERRAL_SOURCES.map((r) => (
            <li key={r.label}>
              {r.label}: {r.count}
            </li>
          ))}
        </ul>
      </DemoCard>

      <DemoCard title="Team (fictional, read-only)">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, display: "grid", gap: 4 }}>
          {DEMO_ORG_STAFF.map((s) => (
            <li key={s.email}>
              {s.name} · {s.role} · {s.email}
            </li>
          ))}
        </ul>
        <button
          type="button"
          style={{ ...demoButtonStyle, marginTop: 12 }}
          onClick={stub}
          aria-disabled="true"
        >
          <UserPlus size={14} /> Invite staff (demo only)
        </button>
      </DemoCard>

      <DemoCard title="Grant report preview (fictional)">
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--pp-muted)" }}>
          {DEFAULT_TEMPLATE.name}. {DEFAULT_TEMPLATE.description}
        </p>
        <div style={{ display: "grid", gap: 16 }}>
          {bySection.map(([section, sectionRows]) => (
            <div key={section}>
              <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700 }}>
                {SECTION_LABEL[section]}
              </h3>
              <div style={{ display: "grid", gap: 6 }}>
                {sectionRows.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      gap: 8,
                      fontSize: 13,
                      padding: "6px 10px",
                      borderRadius: 12,
                      background: "var(--pp-ground-hi)",
                    }}
                  >
                    <span>{r.label}</span>
                    <span>
                      <strong>{r.display}</strong>{" "}
                      <span style={{ color: "var(--pp-muted)", fontSize: 12 }}>
                        · {VALUE_STATE_LABEL[r.state]}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {caveats.length ? (
          <ul
            style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--pp-muted)" }}
          >
            {caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : null}
        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" style={demoButtonStyle} onClick={stub} aria-disabled="true">
            <CheckCircle2 size={14} /> Approve report (demo only)
          </button>
          <button type="button" style={demoButtonStyle} onClick={stub} aria-disabled="true">
            <Download size={14} /> Export CSV (demo only)
          </button>
        </div>
      </DemoCard>
    </div>
  );
}
