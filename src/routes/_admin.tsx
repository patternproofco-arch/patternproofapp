import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { LogOut, Search, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getMyAdminStatus } from "@/lib/admin-console.functions";

export const Route = createFileRoute("/_admin")({
  head: () => ({
    meta: [
      { title: "Staff console — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const statusFn = useServerFn(getMyAdminStatus);
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/signin", replace: true });
      return;
    }
    statusFn()
      .then((r) => {
        if (!r.isAdmin) {
          navigate({ to: "/", replace: true });
          return;
        }
        setAllowed(true);
        setChecking(false);
      })
      .catch(() => navigate({ to: "/", replace: true }));
  }, [user, loading, statusFn, navigate]);

  if (loading || checking || !allowed) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#14161c" }}>
        <span style={{ fontSize: 13, color: "#9aa0ac" }}>Checking staff access…</span>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#14161c",
        color: "#e6e8ec",
        fontFamily: "'Public Sans', system-ui, sans-serif",
        fontSize: 13,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: "1px solid #262a33",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontWeight: 700, letterSpacing: "0.01em" }}>PatternProof · Staff console</span>
          <nav style={{ display: "flex", gap: 14 }}>
            <Link
              to="/admin-console"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#9aa0ac" }}
              activeProps={{ style: { color: "#e6e8ec" } }}
            >
              <Search size={13} /> Account lookup
            </Link>
            <Link
              to="/admin/org-requests"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#9aa0ac" }}
              activeProps={{ style: { color: "#e6e8ec" } }}
            >
              <Users size={13} /> Partner requests
            </Link>
          </nav>
        </div>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/signin" });
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "1px solid #262a33",
            borderRadius: 6,
            padding: "6px 10px",
            color: "#9aa0ac",
            cursor: "pointer",
          }}
        >
          <LogOut size={13} /> Sign out
        </button>
      </header>
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px 64px" }}>
        <Outlet />
      </main>
    </div>
  );
}
