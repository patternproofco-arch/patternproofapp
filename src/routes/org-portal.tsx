import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Copy, LogOut, Power } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { OrgTeamSettings } from "@/components/team/OrgTeamSettings";
import { ThreadGroup } from "@/components/ThreadConnector";
import {
  getMyOrgPartnerStats,
  setReferralCodeActive,
  NO_ORG_MEMBERSHIP_MESSAGE,
  type OrgPartnerStats,
} from "@/lib/org-portal.functions";

export const Route = createFileRoute("/org-portal")({
  head: () => ({
    meta: [
      { title: "Partner dashboard — PatternProof" },
      {
        name: "description",
        content: "Referral totals for PatternProof DV organization partners.",
      },
      { property: "og:title", content: "Partner dashboard — PatternProof" },
      {
        property: "og:description",
        content: "Referral totals for PatternProof DV organization partners.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OrgPortal,
});

function OrgPortal() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const statsFn = useServerFn(getMyOrgPartnerStats);
  const toggleFn = useServerFn(setReferralCodeActive);
  const [stats, setStats] = useState<OrgPartnerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsOrgSetup, setNeedsOrgSetup] = useState(false);

  const load = useCallback(() => {
    statsFn()
      .then((s) => {
        setStats(s);
        setError(null);
        setNeedsOrgSetup(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.message === NO_ORG_MEMBERSHIP_MESSAGE) {
          setNeedsOrgSetup(true);
          setError(null);
          return;
        }
        setError("We couldn't open your partner dashboard. Try again in a moment.");
      });
  }, [statsFn]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/signin", search: { redirect: "/org-portal" }, replace: true });
      return;
    }
    load();
  }, [user, loading, load, navigate]);

  const toggle = async (code: string, next: boolean) => {
    try {
      await toggleFn({ data: { code, is_active: next } });
      toast.success(
        next ? "Link turned back on." : "Link turned off. New sign-ups won't be attributed to it.",
      );
      load();
    } catch {
      toast.error("We couldn't change that link. Try again in a moment.");
    }
  };

  if (loading || (!stats && !error && !needsOrgSetup)) {
    return (
      <Shell>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Opening…</p>
      </Shell>
    );
  }

  if (needsOrgSetup) {
    return (
      <Shell>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
          Let's set up your organization.
        </h1>
        <p
          style={{
            color: "var(--muted-foreground)",
            fontSize: 14,
            maxWidth: 480,
            marginBottom: 20,
          }}
        >
          Your partner account is ready, but it isn't linked to an organization yet — that's
          expected for a brand-new advocate account. Set up your organization to get your referral
          link and see your dashboard.
        </p>
        <Link to="/org-signup" className="btn-primary" style={{ display: "inline-flex" }}>
          Set up your organization →
        </Link>
      </Shell>
    );
  }

  if (error || !stats) {
    return (
      <Shell>
        <p style={{ fontSize: 14 }}>{error}</p>
        <Link to="/" style={{ fontSize: 13, color: "var(--pp-accent-org)", fontWeight: 600 }}>
          Back to PatternProof
        </Link>
      </Shell>
    );
  }

  return (
    <Shell orgName={stats.org_name}>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
        Partner dashboard
      </h1>
      <p
        style={{ color: "var(--muted-foreground)", fontSize: 14, maxWidth: 620, marginBottom: 24 }}
      >
        Privacy-protected referral totals only. Counts are delayed seven days, shown in groups of
        five, and hidden for smaller cohorts. PatternProof never shows survivor identities, records,
        or dates.
      </p>

      <ThreadGroup
        persona="org"
        orientation="vertical-behind"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <Stat label="Referred, all time" value={stats.totals.all_time} />
        <Stat label="Last 30 days" value={stats.totals.last_30_days} />
        <Stat label="Last 90 days" value={stats.totals.last_90_days} />
      </ThreadGroup>

      <Section title="Your referral links">
        {stats.codes.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
            Nothing here yet — your referral link will appear once we finish setting up your
            organization.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {stats.codes.map((c) => {
              const url = `https://pattern-proof.tech/signin?ref=${c.code}`;
              return (
                <div
                  key={c.code}
                  style={{
                    boxShadow: "var(--pp-shadow-sm)",
                    borderRadius: 18,
                    padding: 16,
                    background: "var(--pp-card)",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <code
                      style={{
                        fontSize: 13,
                        background: "var(--pp-ground)",
                        padding: "6px 10px",
                        borderRadius: 18,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {url}
                    </code>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: c.is_active ? "var(--teal-dark)" : "var(--muted-foreground)",
                      }}
                    >
                      {c.is_active ? "Active" : "Turned off"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                    {c.referred_count === null
                      ? "Referral count hidden until the privacy threshold is met"
                      : `${c.referred_count}+ people signed up through this link`}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(url);
                        toast.success("Copied.");
                      }}
                      style={btnStyle}
                    >
                      <Copy size={13} /> Copy link
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(c.code, !c.is_active)}
                      style={btnStyle}
                    >
                      <Power size={13} /> {c.is_active ? "Turn off" : "Turn back on"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <OrgTeamSettings />
    </Shell>
  );
}

const btnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 18,
  boxShadow: "var(--pp-shadow-sm)",
  background: "var(--pp-card)",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
};

function Shell({ children, orgName }: { children: React.ReactNode; orgName?: string | null }) {
  const navigate = useNavigate();
  return (
    <div
      data-persona="org"
      style={{ minHeight: "100vh", background: "var(--pp-ground)", color: "var(--foreground)" }}
    >
      <PublicQuickExit />
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--pp-card)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <BrandMark size={22} variant="advocate" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>PatternProof</span>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Partner</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {orgName && (
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{orgName}</span>
          )}
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/signin" });
            }}
            style={{ ...btnStyle, fontSize: 12 }}
          >
            <LogOut size={13} /> Sign out
          </button>
        </span>
      </header>
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 20px 72px" }}>{children}</main>
      <footer
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "0 20px 32px",
          fontSize: 12,
          color: "var(--muted-foreground)",
        }}
      >
        <Link to="/org-feedback" style={{ color: "var(--pp-accent-org)", fontWeight: 600 }}>
          Give us feedback on this partner dashboard →
        </Link>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div
      style={{
        boxShadow: "var(--pp-shadow-sm)",
        borderRadius: 18,
        padding: 16,
        background: "var(--pp-card)",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
        {value === null ? "Hidden" : `${value}+`}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2
        style={{
          fontSize: 12,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: "var(--muted-foreground)",
          marginBottom: 12,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
