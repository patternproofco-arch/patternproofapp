import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, Users, Clock, FileWarning, ChevronRight, UserMinus, Scale } from "lucide-react";
import { getCaseloadOverview, getFirmConflictFlags } from "@/lib/attorney-portal.functions";
import { PortalStatHero } from "@/components/shared/PortalStatHero";
import { RecentActivityList, type ActivityRow } from "@/components/shared/RecentActivityList";
import { portalTheme } from "@/components/shared/portal-theme";

export const Route = createFileRoute("/_attorney/caseload")({
  head: () => ({
    meta: [
      { title: "Caseload capacity — PatternProof" },
      { name: "description", content: "Aggregate view of clients needing attention across your active caseload." },
      { property: "og:title", content: "Caseload capacity — PatternProof" },
      { property: "og:description", content: "Aggregate view of clients needing attention across your active caseload." },
    ],
  }),
  component: CaseloadPage,
});

type Overview = Awaited<ReturnType<typeof getCaseloadOverview>>;
type Conflicts = Awaited<ReturnType<typeof getFirmConflictFlags>>;

function CaseloadPage() {
  const fetcher = useServerFn(getCaseloadOverview);
  const conflictFetcher = useServerFn(getFirmConflictFlags);
  const [data, setData] = useState<Overview | null>(null);
  const [conflicts, setConflicts] = useState<Conflicts | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetcher().then(setData).catch((e) => setErr(e?.message ?? "Could not load caseload."));
    conflictFetcher().then(setConflicts).catch(() => setConflicts({ firm_id: null, flags: [] }));
  }, [fetcher, conflictFetcher]);

  if (err) return <div style={{ padding: 16, fontSize: 13, color: "var(--att-text-2)" }}>{err}</div>;
  if (!data) return <div style={{ padding: 16, fontSize: 13, color: "var(--att-text-2)" }}>Loading caseload…</div>;

  const { totals, clients, disengaged_clients } = data;

  const t = portalTheme("attorney");

  // Triage first: everything that needs the attorney's attention is assembled
  // before the general caseload stats.
  const attention: ActivityRow[] = [
    ...disengaged_clients.map((c) => ({
      id: `dis-${c.link_id}`,
      icon: UserMinus,
      title: `Client ${c.client_user_id.slice(0, 8)} — no incident or evidence added in 30 days`,
      timestamp: c.last_activity_at ? formatDate(c.last_activity_at) : "no recorded activity",
      to: "/clients/$clientId",
      params: { clientId: c.client_user_id },
      highlight: true,
    })),
    ...((conflicts?.firm_id ? conflicts.flags : []).map((f, i) => ({
      id: `cf-${i}`,
      icon: Scale,
      title: `Client ${f.my_client_id.slice(0, 8)} and Client ${f.other_client_id.slice(0, 8)} (${f.other_attorney_name}) both reference a similar name — "${f.my_matched_name}" v "${f.other_matched_name}"`,
      timestamp: "worth a conflict check",
      to: "/clients/$clientId",
      params: { clientId: f.my_client_id },
      highlight: true,
    }))),
  ];

  if (totals.clients_with_unreviewed_severity_indicators > 0) {
    attention.push({
      id: "unreviewed-severity",
      icon: AlertTriangle,
      title: `${totals.clients_with_unreviewed_severity_indicators} client${totals.clients_with_unreviewed_severity_indicators === 1 ? "" : "s"} with unreviewed severity indicators`,
      timestamp: "needs review",
      highlight: true,
    });
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <PortalStatHero
        variant="attorney"
        eyebrow="Overview"
        heading="Caseload capacity"
        value={totals.active_client_count}
        label={totals.active_client_count === 1 ? "active client" : "active clients"}
        message="Aggregate view across every active client — items needing attention appear first. Counts reflect documentation activity only; they are not clinical or forensic assessments."
      />

      <RecentActivityList
        variant="attorney"
        title="Needs your attention"
        rows={attention}
        emptyMessage="Nothing needs attention right now."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <Kpi icon={<Users size={14} />} label="Active clients" value={totals.active_client_count} />
        <Kpi icon={<FileWarning size={14} />} label="Unconfirmed AI drafts" value={totals.total_unconfirmed_ai_drafts} tone={totals.total_unconfirmed_ai_drafts ? "warn" : undefined} />
        <Kpi icon={<Clock size={14} />} label="Disengaged (30d)" value={totals.disengaged_client_count} tone={totals.disengaged_client_count ? "warn" : undefined} />
        <Kpi icon={<AlertTriangle size={14} />} label="Clients w/ unreviewed severity" value={totals.clients_with_unreviewed_severity_indicators} tone={totals.clients_with_unreviewed_severity_indicators ? "warn" : undefined} />
      </div>

      <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: t.muted }}>All clients</div>

      <div style={{ border: "1px solid var(--att-border)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(140px,1.4fr) 1fr 0.8fr 0.8fr 0.8fr 32px", gap: 8, padding: "10px 14px", background: "var(--att-surface-2, #f7f7f5)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--att-text-2)" }}>
          <div>Client</div>
          <div>Last activity</div>
          <div>Unconfirmed AI</div>
          <div>Disengaged</div>
          <div>Unreviewed severity</div>
          <div />
        </div>
        {clients.length === 0 && (
          <div style={{ padding: 20, fontSize: 13, color: "var(--att-text-2)" }}>No active clients yet.</div>
        )}
        {clients.map((c) => {
          const attention = c.unconfirmed_ai_draft_count > 0 || c.disengaged_30d || c.unreviewed_severity_indicator_count > 0;
          return (
            <Link
              key={c.link_id}
              to="/clients/$clientId"
              params={{ clientId: c.client_user_id }}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(140px,1.4fr) 1fr 0.8fr 0.8fr 0.8fr 32px",
                gap: 8,
                padding: "12px 14px",
                borderTop: "1px solid var(--att-border)",
                alignItems: "center",
                fontSize: 13,
                textDecoration: "none",
                color: "inherit",
                background: attention ? "rgba(231, 123, 86, 0.05)" : "transparent",
                borderLeft: attention ? "3px solid var(--att-accent)" : "3px solid transparent",
              }}
            >
              <div style={{ fontWeight: 600 }}>Client {c.client_user_id.slice(0, 8)}</div>
              <div style={{ color: "var(--att-text-2)" }}>{c.last_activity_at ? formatDate(c.last_activity_at) : "—"}</div>
              <Chip value={c.unconfirmed_ai_draft_count} warn={c.unconfirmed_ai_draft_count > 0} />
              <Chip value={c.disengaged_30d ? "Yes" : "—"} warn={c.disengaged_30d} />
              <Chip value={c.unreviewed_severity_indicator_count} warn={c.unreviewed_severity_indicator_count > 0} />
              <ChevronRight size={14} style={{ opacity: 0.5 }} />
            </Link>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: "var(--att-text-2)", maxWidth: 640 }}>
        Documentation activity is a workflow signal, not a legal or clinical assessment. "Disengaged" means
        no incidents or evidence were added by the survivor in the last 30 days — it does not imply anything
        about their situation.
      </p>
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone?: "warn" }) {
  return (
    <div style={{
      border: "1px solid var(--att-border)",
      borderRadius: 2,
      padding: 14,
      background: tone === "warn" ? "rgba(231, 123, 86, 0.06)" : "transparent",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--att-text-2)" }}>
        {icon}<span>{label}</span>
      </div>
      <div style={{ fontFamily: "\"Space Grotesk\", system-ui, sans-serif", fontSize: 26, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function Chip({ value, warn }: { value: number | string; warn?: boolean }) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 32,
      padding: "2px 8px",
      borderRadius: 2,
      fontSize: 12,
      fontWeight: 600,
      background: warn ? "rgba(231, 123, 86, 0.15)" : "transparent",
      color: warn ? "var(--att-accent)" : "var(--att-text-2)",
      width: "fit-content",
    }}>{value}</div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}