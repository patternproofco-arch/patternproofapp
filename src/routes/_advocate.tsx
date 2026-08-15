import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Building2, BookOpen, Clock, Home, LogOut, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getMyAdvocateRole } from "@/lib/advocate.functions";
import { ACCESS_DISCLAIMER } from "@/components/AccessDisclaimer";
import { BrandMark } from "@/components/BrandMark";
import { quickExit } from "@/lib/quick-exit";
import orgCss from "@/styles/org-portal.css?url";

export const Route = createFileRoute("/_advocate")({
  head: () => ({
    meta: [
      { title: "PatternProof — Advocate access" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "stylesheet", href: orgCss }],
  }),
  component: AdvocateLayout,
});

function AdvocateLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const roleFn = useServerFn(getMyAdvocateRole);
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<{ full_name: string; org_name: string | null; email: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login", search: { redirect: "/advocate-cases" }, replace: true }); return; }
    roleFn()
      .then((r) => {
        if (!r.isAdvocate) { navigate({ to: "/", replace: true }); return; }
        setProfile(r.profile);
        setChecking(false);
      })
      .catch(() => navigate({ to: "/", replace: true }));
  }, [user, loading, roleFn, navigate]);

  if (loading || checking) {
    return (
      <div className="orgx" data-persona="org" style={{ display: "grid", placeItems: "center" }}>
        <span className="orgx-muted" style={{ fontSize: 13 }}>Opening…</span>
      </div>
    );
  }

  const accountLabel = profile?.org_name ?? profile?.full_name ?? null;
  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); };

  return (
    <div className="orgx" data-persona="org">
      <div className="orgx-layout">
        <nav className="orgx-rail" aria-label="DV organization navigation">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "4px 14px 22px" }}>
            <BrandMark size={26} />
            <span style={{ display: "grid", lineHeight: 1.2 }}>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 20 }}>PatternProof</span>
              <span className="orgx-muted" style={{ fontSize: 11.5 }}>DV organization workspace</span>
            </span>
          </span>

          <div className="orgx-rail-scroll">
            <Link to="/org-portal" className="orgx-navitem">
              <Home size={18} strokeWidth={1.7} aria-hidden />
              <span>Home</span>
            </Link>
            <Link to="/advocate-cases" className="orgx-navitem" activeProps={{ "aria-current": "page" }}>
              <Users size={18} strokeWidth={1.7} aria-hidden />
              <span>Shared survivors</span>
            </Link>
            <PilotItem icon={Clock} label="Follow-up" />
            <PilotItem icon={BookOpen} label="Resources" />
            <PilotItem icon={Building2} label="Organization" />
          </div>

          <div className="orgx-rail-foot">
            <Link to="/privacy" className="orgx-navitem">
              <ShieldCheck size={18} strokeWidth={1.7} aria-hidden />
              <span>Privacy</span>
            </Link>
            <button
              type="button"
              className="orgx-navitem"
              onClick={() => quickExit()}
              title="Signs you out of PatternProof and leaves for another site. It cannot clear browser history or stop device monitoring."
            >
              <LogOut size={18} strokeWidth={1.7} aria-hidden />
              <span>Quick Exit</span>
            </button>
            <button type="button" className="orgx-navitem" onClick={signOut}>
              <LogOut size={18} strokeWidth={1.7} aria-hidden />
              <span>Sign out</span>
            </button>
            {accountLabel ? (
              <span className="orgx-muted" style={{ fontSize: 12, padding: "6px 14px" }}>{accountLabel}</span>
            ) : null}
          </div>
        </nav>

        <main className="orgx-main">
          <Outlet />
          <hr className="orgx-rule" />
          <p className="orgx-muted" style={{ fontSize: 12 }}>{ACCESS_DISCLAIMER}</p>
        </main>
      </div>
    </div>
  );
}

function PilotItem({ icon: Icon, label }: { icon: typeof Clock; label: string }) {
  return (
    <span className="orgx-navitem" data-inert="true" aria-disabled="true">
      <Icon size={18} strokeWidth={1.7} aria-hidden />
      <span>{label}</span>
      <span style={{ marginLeft: "auto", fontSize: 11 }} className="orgx-muted">Coming during the pilot</span>
    </span>
  );
}
