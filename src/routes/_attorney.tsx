import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Scale, Users, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/attorney-portal.functions";

export const Route = createFileRoute("/_attorney")({
  component: AttorneyLayout,
});

function AttorneyLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const getRole = useServerFn(getMyRole);
  const [checking, setChecking] = useState(true);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/lawyer-signup", replace: true }); return; }
    getRole().then((r) => {
      if (r.role !== "attorney") navigate({ to: "/lawyer-signup", replace: true });
      else setChecking(false);
    }).catch(() => navigate({ to: "/lawyer-signup", replace: true }));
  }, [user, loading, getRole, navigate]);

  if (loading || checking) {
    return <div className="flex min-h-screen items-center justify-center label-eyebrow">Opening portal…</div>;
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--sidebar)" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <Link to="/clients" className="flex items-center gap-2" style={{ color: "var(--sidebar-active)" }}>
            <Scale size={18} />
            <span className="font-serif text-[18px] font-bold">PatternProof · Counsel</span>
          </Link>
          <nav className="flex items-center gap-4 text-[13px]" style={{ color: "var(--sidebar-active)" }}>
            <Link to="/clients" className={`inline-flex items-center gap-1 ${pathname.startsWith("/clients") ? "font-bold" : ""}`}>
              <Users size={14} /> Clients
            </Link>
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/lawyer-signup" }); }}
              className="inline-flex items-center gap-1"
            >
              <LogOut size={14} /> Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}