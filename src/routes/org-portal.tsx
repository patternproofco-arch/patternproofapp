import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BarChart3, ClipboardList, Clock, Share2, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { OrgShell } from "@/components/org/OrgShell";
import { getMyOrgPartnerStats, type OrgPartnerStats } from "@/lib/org-portal.functions";
import { listAdvocateClients } from "@/lib/advocate.functions";
import orgCss from "@/styles/org-portal.css?url";

export const Route = createFileRoute("/org-portal")({
  head: () => ({
    meta: [
      { title: "PatternProof — DV organization portal" },
      { name: "description", content: "Referral and consent overview for PatternProof DV organization partners." },
      { property: "og:title", content: "PatternProof — DV organization portal" },
      { property: "og:description", content: "Referral and consent overview for PatternProof DV organization partners." },
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

type Clients = Awaited<ReturnType<typeof listAdvocateClients>>["clients"];

const TILES = [
  { to: "/advocate-cases", icon: Users, title: "Clients", hint: "Workspaces shared with you" },
  { to: "/org/referrals", icon: Share2, title: "Referrals", hint: "Your links and their counts" },
  { to: "/org/record-requests", icon: ClipboardList, title: "Record requests", hint: "Ask for specific records" },
  { to: "/org/consent", icon: ShieldCheck, title: "Consent centre", hint: "Receipts and what's in force" },
  { to: "/org/follow-ups", icon: Clock, title: "Follow-ups", hint: "Warm handoffs you've offered" },
  { to: "/org/reports", icon: BarChart3, title: "Reports", hint: "De-identified programme counts" },
] as const;

function OrgPortal() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const statsFn = useServerFn(getMyOrgPartnerStats);
  const clientsFn = useServerFn(listAdvocateClients);
  const [stats, setStats] = useState<OrgPartnerStats | null>(null);
  const [clients, setClients] = useState<Clients>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login", search: { redirect: "/org-portal" }, replace: true }); return; }
    statsFn()
      .then((s) => { setStats(s); setError(null); })
      .catch(() => setError("We couldn't open your dashboard. Try again in a moment."));
    clientsFn().then((r) => setClients(r.clients)).catch(() => setClients([]));
  }, [user, loading, statsFn, clientsFn, navigate]);

  const shell = (children: React.ReactNode) => (
    <OrgShell
      active="home"
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

  const activeShares = clients.filter((c) => c.status === "active").length;
  const orgName = stats.org_name?.trim();

  return shell(
    <>
      <p className="orgx-eyebrow">DV organization portal</p>
      <h1 style={{ margin: "8px 0 8px" }}>{orgName ? `Welcome, ${orgName}` : "Welcome"}</h1>
      <p className="orgx-muted" style={{ fontSize: 15, maxWidth: 660 }}>
        Referral and consent status in one place. Nothing a survivor documents appears here unless they
        have chosen to share it with you.
      </p>

      <div className="orgx-summary" style={{ marginTop: 22 }}>
        <p className="orgx-eyebrow" style={{ marginBottom: 12 }}>Where things stand</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 18 }}>
          <div>
            <div className="orgx-metric-value">{stats.totals.last_30_days}</div>
            <div className="orgx-fact-label" style={{ marginTop: 3 }}>Reached us via your links (30 days)</div>
          </div>
          <div>
            <div className="orgx-metric-value">{activeShares}</div>
            <div className="orgx-fact-label" style={{ marginTop: 3 }}>Workspaces shared with you now</div>
          </div>
          <div>
            <div className="orgx-metric-value" style={{ fontSize: 20, fontWeight: 600 }}>Not enabled</div>
            <div className="orgx-fact-label" style={{ marginTop: 3 }}>Requests waiting on approval</div>
          </div>
        </div>
        <p className="orgx-muted" style={{ fontSize: 12.5, margin: "16px 0 0" }}>
          {stats.codes.length === 0
            ? "Your referral link isn't set up yet — email us and we'll create one for your organization."
            : "Record requests aren't switched on yet, so there's no figure to report here — this isn't a count of zero."}
        </p>
      </div>

      <h2 className="orgx-eyebrow" style={{ margin: "30px 0 14px" }}>Go to</h2>
      <div className="orgx-tiles">
        {TILES.map(({ to, icon: Icon, title, hint }) => (
          <Link key={to} to={to} className="orgx-tile">
            <span className="orgx-tile__icon"><Icon size={18} strokeWidth={1.8} aria-hidden /></span>
            <span className="orgx-tile__title">{title}</span>
            <span className="orgx-tile__hint">{hint}</span>
          </Link>
        ))}
      </div>

      <h2 className="orgx-eyebrow" style={{ margin: "34px 0 14px" }}>Recent activity</h2>
      {stats.referred.length === 0 && clients.length === 0 ? (
        <div className="orgx-empty">
          Nothing here yet — activity appears once someone arrives through your link or shares a workspace with you.
        </div>
      ) : (
        <div className="orgx-rowlist">
          {clients.slice(0, 4).map((c) => (
            <div key={c.id} className="orgx-row">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 500 }}>{c.case_label ?? "Shared workspace"}</div>
                <div className="orgx-muted" style={{ fontSize: 12.5 }}>
                  Shared {new Date(c.created_at).toLocaleDateString()}
                </div>
              </div>
              <span className="orgx-chip" data-tone={c.status === "active" ? "active" : "ended"}>
                {c.status === "active" ? "In force" : "Withdrawn"}
              </span>
            </div>
          ))}
          {stats.referred.slice(0, 4).map((r, i) => (
            <div key={`r-${i}`} className="orgx-row">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 500 }}>Someone signed up through {r.code}</div>
                <div className="orgx-muted" style={{ fontSize: 12.5 }}>{r.signed_up_month}</div>
              </div>
              <span className="orgx-chip" data-tone={r.status === "actively_documenting" ? "active" : undefined}>
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="orgx-muted" style={{ fontSize: 12.5, marginTop: 18 }}>
        Referral rows are counts only — no names, no dates of birth, and nothing they have written.
      </p>
    </>,
  );
}
