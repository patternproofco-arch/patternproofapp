import { createFileRoute, Link, Outlet, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { LogOut, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/attorney-portal.functions";
import attorneyCss from "@/styles/attorney.css?url";

export const Route = createFileRoute("/_attorney")({
  head: () => ({
    links: [{ rel: "stylesheet", href: attorneyCss }],
    meta: [
      { title: "Attorney Portal — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AttorneyLayout,
});

function AttorneyLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const getRole = useServerFn(getMyRole);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/lawyer-signup", replace: true }); return; }
    getRole().then((r) => {
      if (r.role !== "attorney") navigate({ to: "/lawyer-signup", replace: true });
      else setChecking(false);
    }).catch(() => navigate({ to: "/lawyer-signup", replace: true }));
  }, [user, loading, getRole, navigate]);

  if (loading || checking) {
    return (
      <div className="att-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="att-eyebrow">Opening portal…</span>
      </div>
    );
  }

  return (
    <div className="att-root">
      <AttorneyTopNav />
      <SecurityBanner />
      <AttorneyBreadcrumb />
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 2rem 0" }}>
        <Outlet />
      </main>
      <footer className="att-footer">
        <span>PatternProof</span>
        <span>·</span>
        <span>attorney.pattern-proof.tech</span>
        <span>·</span>
        <span>Encrypted &amp; confidential</span>
        <span>·</span>
        <span>Session logged · {new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
        <span>·</span>
        <span>All access recorded for chain of custody</span>
      </footer>
    </div>
  );
}

/* ---------- top nav ---------- */
const CASE_TABS = [
  { key: "overview",  label: "Overview",  to: "/clients/$clientId" },
  { key: "timeline",  label: "Timeline",  to: "/clients/$clientId/timeline" },
  { key: "patterns",  label: "Patterns",  to: "/clients/$clientId/patterns" },
  { key: "evidence",  label: "Evidence",  to: "/clients/$clientId/evidence" },
  { key: "export",    label: "Export",    to: "/clients/$clientId/export" },
] as const;

function useClientIdFromPath(): string | null {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const m = pathname.match(/^\/clients\/([0-9a-f-]{36})/i);
  return m?.[1] ?? null;
}

function AttorneyTopNav() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const clientId = useClientIdFromPath();
  const caseId = clientId ? `PP-${clientId.slice(0, 4).toUpperCase()}` : null;

  const onCase = !!clientId;

  return (
    <nav className="att-nav">
      <Link to="/clients" className="att-nav-brand">
        <span className="att-nav-brand-mark" aria-hidden />
        <span>PATTERN PROOF</span>
        <span style={{ opacity: 0.55, fontSize: 13, marginLeft: 6 }}>· Attorney Portal</span>
      </Link>

      <div className="att-nav-tabs">
        {onCase && clientId ? (
          CASE_TABS.map((t) => {
            const href = t.to.replace("$clientId", clientId);
            const active = t.key === "overview"
              ? pathname === `/clients/${clientId}`
              : pathname.startsWith(href);
            return (
              <Link
                key={t.key}
                to={t.to}
                params={{ clientId }}
                className={`att-nav-tab ${active ? "active" : ""}`}
              >
                {t.label}
              </Link>
            );
          })
        ) : (
          <Link to="/clients" className={`att-nav-tab ${pathname === "/clients" ? "active" : ""}`}>Clients</Link>
        )}
      </div>

      <div className="att-nav-meta">
        {caseId && (
          <span>Case ID: <span className="att-mono">{caseId}</span></span>
        )}
        <button
          onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/lawyer-signup" }); }}
          className="att-nav-tab"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </nav>
  );
}

/* ---------- security banner ---------- */
function SecurityBanner() {
  const clientId = useClientIdFromPath();
  const caseId = clientId ? `PP-${clientId.slice(0, 4).toUpperCase()}` : "—";
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setDismissed(sessionStorage.getItem("att-security-dismissed") === "1");
  }, []);
  if (dismissed) return null;
  return (
    <div className="att-security-banner">
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Lock size={12} />
        This session is encrypted. Case ID: <span className="att-mono">{caseId}</span>.
        All access is recorded for chain of custody.
      </span>
      <button
        onClick={() => { sessionStorage.setItem("att-security-dismissed", "1"); setDismissed(true); }}
        className="att-btn-ghost"
        style={{ padding: "2px 8px", fontSize: 11, color: "#1E40AF" }}
      >
        Dismiss
      </button>
    </div>
  );
}

/* ---------- breadcrumb ---------- */
function AttorneyBreadcrumb() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const clientId = useClientIdFromPath();
  const parts: Array<{ label: string; to?: string }> = [
    { label: "Pattern Proof", to: "/clients" },
    { label: "Attorney Portal", to: "/clients" },
  ];
  if (clientId) {
    parts.push({ label: `Client PP-${clientId.slice(0, 4).toUpperCase()}`, to: `/clients/${clientId}` });
    const tab = CASE_TABS.find((t) => {
      const href = t.to.replace("$clientId", clientId);
      return t.key === "overview" ? pathname === href : pathname.startsWith(href);
    });
    if (tab && tab.key !== "overview") parts.push({ label: tab.label });
  } else if (pathname === "/clients") {
    parts.push({ label: "Clients" });
  }
  return (
    <div className="att-breadcrumb">
      {parts.map((p, i) => (
        <span key={i}>
          {p.to && i < parts.length - 1 ? <Link to={p.to}>{p.label}</Link> : <span style={{ color: "var(--att-text-2)" }}>{p.label}</span>}
          {i < parts.length - 1 && <span className="att-breadcrumb-sep">/</span>}
        </span>
      ))}
    </div>
  );
}

// Silence "imported but unused" if useParams not needed (kept for future).
export { useParams as _useParams };