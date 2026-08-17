import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getMyAdvocateRole } from "@/lib/advocate.functions";
import { ACCESS_DISCLAIMER } from "@/components/AccessDisclaimer";
import { OrgShell } from "@/components/org/OrgShell";
import orgCss from "@/styles/org-portal.css?url";

export const Route = createFileRoute("/_advocate")({
  head: () => ({
    meta: [
      { title: "PatternProof — DV organization portal" },
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

  return (
    <OrgShell
      accountLabel={profile?.org_name ?? profile?.full_name ?? null}
      onSignOut={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
    >
      <Outlet />
      <hr className="orgx-rule" />
      <p className="orgx-muted" style={{ fontSize: 12 }}>{ACCESS_DISCLAIMER}</p>
    </OrgShell>
  );
}
