import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Copy, Power } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { OrgShell } from "@/components/org/OrgShell";
import { getMyOrgPartnerStats, setReferralCodeActive, type OrgPartnerStats } from "@/lib/org-portal.functions";
import orgCss from "@/styles/org-portal.css?url";

export const Route = createFileRoute("/org-portal")({
  head: () => ({
    meta: [
      { title: "PatternProof — Partner dashboard" },
      { name: "description", content: "Referral totals for PatternProof DV organization partners." },
      { property: "og:title", content: "PatternProof — Partner dashboard" },
      { property: "og:description", content: "Referral totals for PatternProof DV organization partners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "stylesheet", href: orgCss }],
  }),
  component: OrgPortal,
});

const STATUS_LABEL: Record<string, string> = {
  actively_documenting: "Actively documenting",
  inactive: "Quiet lately",
  signed_up: "Signed up",
};

function OrgPortal() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const statsFn = useServerFn(getMyOrgPartnerStats);
  const toggleFn = useServerFn(setReferralCodeActive);
  const [stats, setStats] = useState<OrgPartnerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(() => {
    statsFn()
      .then((s) => { setStats(s); setError(null); })
      .catch(() => setError("We couldn't open your partner dashboard. Try again in a moment."));
  }, [statsFn]);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login", search: { redirect: "/org-portal" }, replace: true }); return; }
    load();
  }, [user, loading, load, navigate]);

  const toggle = async (code: string, next: boolean) => {
    setConfirming(null);
    try {
      await toggleFn({ data: { code, is_active: next } });
      toast.success(next ? "Link turned back on." : "Link turned off. New sign-ups won't be attributed to it.");
      load();
    } catch {
      toast.error("We couldn't change that link. Try again in a moment.");
    }
  };

  const shell = (children: React.ReactNode) => (
    <OrgShell
      active="organization"
      showOrganization
      showSharedSurvivors={false}
      accountLabel={stats?.org_name ?? null}
      onSignOut={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
    >
      {children}
    </OrgShell>
  );

  if (loading || (!stats && !error)) {
    return shell(<p className="orgx-muted" style={{ fontSize: 13.5 }}>Opening…</p>);
  }

  if (error || !stats) {
    return shell(
      <>
        <p style={{ fontSize: 15 }}>{error}</p>
        <Link to="/" className="orgx-btn orgx-btn-quiet" style={{ marginTop: 14 }}>Back to PatternProof</Link>
      </>,
    );
  }

  return shell(
    <>
      <p className="orgx-eyebrow">Organization</p>
      <h1 style={{ fontSize: 42, margin: "8px 0 10px" }}>Partner dashboard</h1>
      <p className="orgx-muted" style={{ fontSize: 15, maxWidth: 640 }}>
        Counts only. PatternProof never shows an organization who a survivor is or anything they have documented —
        no names, no records, no dates.
      </p>

      <hr className="orgx-rule" />

      <h2 className="orgx-eyebrow" style={{ marginBottom: 16 }}>Referred, by period</h2>
      <div className="orgx-facts">
        <Metric label="All time" value={stats.totals.all_time} />
        <Metric label="Last 7 days" value={stats.totals.last_7_days} />
        <Metric label="Last 30 days" value={stats.totals.last_30_days} />
        <Metric label="Last 90 days" value={stats.totals.last_90_days} />
      </div>

      <hr className="orgx-rule" />

      <h2 className="orgx-eyebrow" style={{ marginBottom: 16 }}>Activity</h2>
      <div className="orgx-facts">
        <Metric label={`Actively documenting (${stats.active_window_days}d)`} value={stats.totals.actively_documenting} />
        <Metric label="Quiet lately" value={stats.totals.inactive} />
        <Metric label="Signed up, not started" value={stats.totals.signed_up_only} />
      </div>

      <hr className="orgx-rule" />

      <h2 style={{ fontSize: 26, marginBottom: 10 }}>Your referral links</h2>
      {stats.codes.length === 0 ? (
        <p className="orgx-muted" style={{ fontSize: 14.5 }}>
          Nothing here yet — your referral link will appear once we finish setting up your organization.
        </p>
      ) : (
        <div className="orgx-rowlist">
          {stats.codes.map((c) => {
            const url = `https://pattern-proof.tech/login?ref=${c.code}`;
            return (
              <div key={c.code} className="orgx-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
                  <code style={{ fontSize: 13.5, overflowWrap: "anywhere" }}>{url}</code>
                  <span className="orgx-muted" style={{ fontSize: 13 }}>
                    {c.is_active ? "Active" : "Turned off"} · {c.referred_count}{" "}
                    {c.referred_count === 1 ? "person" : "people"} signed up through this link
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="orgx-btn orgx-btn-quiet"
                    onClick={() => { navigator.clipboard?.writeText(url); toast.success("Copied."); }}
                  >
                    <Copy size={15} aria-hidden /> Copy link
                  </button>
                  {confirming === c.code ? (
                    <>
                      <button type="button" className="orgx-btn" onClick={() => toggle(c.code, !c.is_active)}>
                        {c.is_active ? "Yes, turn it off" : "Yes, turn it on"}
                      </button>
                      <button type="button" className="orgx-btn orgx-btn-quiet" onClick={() => setConfirming(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" className="orgx-btn orgx-btn-quiet" onClick={() => setConfirming(c.code)}>
                      <Power size={15} aria-hidden /> {c.is_active ? "Turn off" : "Turn back on"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <hr className="orgx-rule" />

      <h2 style={{ fontSize: 26, marginBottom: 10 }}>Referred sign-ups</h2>
      {stats.referred.length === 0 ? (
        <p className="orgx-muted" style={{ fontSize: 14.5 }}>
          Nothing here yet — when someone signs up through your link, they'll show up as a count.
        </p>
      ) : (
        <table className="orgx-table">
          <thead>
            <tr>
              <th scope="col">Joined</th>
              <th scope="col">Link</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {stats.referred.map((r, i) => (
              <tr key={i}>
                <td>{r.signed_up_month}</td>
                <td><code style={{ fontSize: 13 }}>{r.code}</code></td>
                <td>{STATUS_LABEL[r.status] ?? r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="orgx-muted" style={{ fontSize: 12.5, marginTop: 14 }}>
        "Actively documenting" means at least one new entry in the last {stats.active_window_days} days. We never show
        what was written, and these rows are not linked to any shared workspace.
      </p>
    </>,
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
