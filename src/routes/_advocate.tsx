import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getMyAdvocateRole } from "@/lib/advocate.functions";
import { AccessDisclaimerBar } from "@/components/AccessDisclaimer";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/_advocate")({
  head: () => ({
    meta: [
      { title: "Advocate access — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
    ],
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
      <div data-persona="org" style={{ minHeight: "100vh", background: "var(--background)", display: "grid", placeItems: "center" }}>
        <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Opening…</span>
      </div>
    );
  }

  return (
    <div data-persona="org" style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <header
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, padding: "12px 20px", borderBottom: "1px solid var(--border)",
        }}
      >
        <Link to="/advocate-cases" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "inherit" }}>
          <BrandMark size={22} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>PatternProof</span>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Advocate access</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {profile?.org_name ?? profile?.full_name ?? ""}
          </span>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
            className="btn-ghost inline-flex items-center gap-1 text-[12px]"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </header>
      <AccessDisclaimerBar persona="org" />
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 20px 64px" }}>
        <Outlet />
      </main>
    </div>
  );
}