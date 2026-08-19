import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Copy, LogOut, Power } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { getMyOrgPartnerStats, setReferralCodeActive, type OrgPartnerStats } from "@/lib/org-portal.functions";

export const Route = createFileRoute("/org-portal")({
  head: () => ({
    meta: [
      { title: "Partner dashboard — PatternProof" },
      { name: "description", content: "Referral totals for PatternProof DV organization partners." },
      { property: "og:title", content: "Partner dashboard — PatternProof" },
      { property: "og:description", content: "Referral totals for PatternProof DV organization partners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
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
    try {
      await toggleFn({ data: { code, is_active: next } });
      toast.success(next ? "Link turned back on." : "Link turned off. New sign-ups won't be attributed to it.");
      load();
    } catch {
      toast.error("We couldn't change that link. Try again in a moment.");
    }
  };

  if (loading || (!stats && !error)) {
    return (
      <Shell>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Opening…</p>
      </Shell>
    );
  }

  if (error || !stats) {
    return (
      <Shell>
        <p style={{ fontSize: 14 }}>{error}</p>
        <Link to="/" style={{ fontSize: 13, color: "#33268C", fontWeight: 600 }}>Back to PatternProof</Link>
      </Shell>
    );
  }

  return (
    <Shell orgName={stats.org_name}>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
        Partner dashboard
      </h1>
      <p style={{ color: "var(--muted-foreground)", fontSize: 14, maxWidth: 620, marginBottom: 24 }}>
        Counts only. PatternProof never shows an organization who a survivor is or anything they
        have documented — no names, no records, no dates.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 28 }}>
        <Stat label="Referred, all time" value={stats.totals.all_time} />
        <Stat label="Last 7 days" value={stats.totals.last_7_days} />
        <Stat label="Last 30 days" value={stats.totals.last_30_days} />
        <Stat label="Last 90 days" value={stats.totals.last_90_days} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 32 }}>
        <Stat label={`Actively documenting (${stats.active_window_days}d)`} value={stats.totals.actively_documenting} />
        <Stat label="Quiet lately" value={stats.totals.inactive} />
        <Stat label="Signed up, not started" value={stats.totals.signed_up_only} />
      </div>

      <Section title="Your referral links">
        {stats.codes.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
            Nothing here yet — your referral link will appear once we finish setting up your organization.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {stats.codes.map((c) => {
              const url = `https://pattern-proof.tech/login?ref=${c.code}`;
              return (
                <div key={c.code} style={{ border: "1px solid var(--border)", borderRadius: 2, padding: 16, background: "#FFFFFF", display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <code style={{ fontSize: 13, background: "#F5F5F0", padding: "6px 10px", borderRadius: 2, overflowWrap: "anywhere" }}>{url}</code>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: c.is_active ? "var(--teal-dark)" : "var(--muted-foreground)" }}>
                      {c.is_active ? "Active" : "Turned off"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                    {c.referred_count} {c.referred_count === 1 ? "person" : "people"} signed up through this link
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard?.writeText(url); toast.success("Copied."); }}
                      style={btnStyle}
                    >
                      <Copy size={13} /> Copy link
                    </button>
                    <button type="button" onClick={() => toggle(c.code, !c.is_active)} style={btnStyle}>
                      <Power size={13} /> {c.is_active ? "Turn off" : "Turn back on"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Referred survivors">
        {stats.referred.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
            Nothing here yet — when someone signs up through your link, they'll show up as a count.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                <th style={{ padding: "8px 0" }}>Joined</th>
                <th style={{ padding: "8px 0" }}>Link</th>
                <th style={{ padding: "8px 0" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.referred.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 0" }}>{r.signed_up_month}</td>
                  <td style={{ padding: "10px 0" }}><code style={{ fontSize: 12 }}>{r.code}</code></td>
                  <td style={{ padding: "10px 0" }}>{STATUS_LABEL[r.status] ?? r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 12 }}>
          "Actively documenting" means at least one new entry in the last {stats.active_window_days} days.
          We never show what was written.
        </p>
      </Section>
    </Shell>
  );
}

const btnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px",
  borderRadius: 2, border: "1px solid var(--border)", background: "#FFFFFF",
  cursor: "pointer", fontSize: 13, fontWeight: 700,
};

function Shell({ children, orgName }: { children: React.ReactNode; orgName?: string | null }) {
  const navigate = useNavigate();
  return (
    <div data-persona="org" style={{ minHeight: "100vh", background: "#FAF8F4", color: "var(--foreground)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "#FFFFFF" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <BrandMark size={22} variant="advocate" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>PatternProof</span>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Partner</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {orgName && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{orgName}</span>}
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
            style={{ ...btnStyle, fontSize: 12 }}
          >
            <LogOut size={13} /> Sign out
          </button>
        </span>
      </header>
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 20px 72px" }}>{children}</main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 2, padding: 16, background: "#FFFFFF" }}>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 12 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}