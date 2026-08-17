import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getMyOrgPartnerStats, type OrgPartnerStats } from "@/lib/org-portal.functions";

export const Route = createFileRoute("/_advocate/org/reports")({
  component: Reports,
});

function Reports() {
  const statsFn = useServerFn(getMyOrgPartnerStats);
  const [stats, setStats] = useState<OrgPartnerStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => { statsFn().then(setStats).catch(() => setFailed(true)); }, [statsFn]);

  return (
    <>
      <p className="orgx-eyebrow">Reporting</p>
      <h1 style={{ margin: "8px 0 10px" }}>Reports</h1>
      <p className="orgx-muted" style={{ fontSize: 15, maxWidth: 660 }}>
        Programme-level counts for your own reporting. These figures are de-identified — no names, no
        record contents, and nothing that could be traced back to one person.
      </p>

      {failed ? (
        <div className="orgx-empty" style={{ marginTop: 24 }}>
          We couldn't load your figures. Try again in a moment.
        </div>
      ) : !stats ? (
        <p className="orgx-muted" style={{ fontSize: 14, marginTop: 26 }}>Loading…</p>
      ) : (
        <>
          <hr className="orgx-rule" />
          <h2 className="orgx-eyebrow" style={{ marginBottom: 14 }}>Reached PatternProof through your links</h2>
          <div className="orgx-facts">
            <Metric label="All time" value={stats.totals.all_time} />
            <Metric label="Last 7 days" value={stats.totals.last_7_days} />
            <Metric label="Last 30 days" value={stats.totals.last_30_days} />
            <Metric label="Last 90 days" value={stats.totals.last_90_days} />
          </div>

          <hr className="orgx-rule" />
          <h2 className="orgx-eyebrow" style={{ marginBottom: 14 }}>Engagement</h2>
          <div className="orgx-facts">
            <Metric label={`Actively documenting (${stats.active_window_days}d)`} value={stats.totals.actively_documenting} />
            <Metric label="Quiet lately" value={stats.totals.inactive} />
            <Metric label="Signed up, not started" value={stats.totals.signed_up_only} />
          </div>
          <p className="orgx-muted" style={{ fontSize: 12.5, marginTop: 16 }}>
            Exportable reports aren't available yet. For now these counts are read here only.
          </p>
        </>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="orgx-fact">
      <div className="orgx-metric-value">{value}</div>
      <div className="orgx-fact-label" style={{ marginTop: 4 }}>{label}</div>
    </div>
  );
}
