import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { LogOut, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole, getAttorneyProfile } from "@/lib/attorney-portal.functions";
import { useSubscription } from "@/hooks/useSubscription";
import attorneyCss from "@/styles/attorney.css?url";
import { Logo } from "@/components/Logo";

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
  const getProfile = useServerFn(getAttorneyProfile);
  const [checking, setChecking] = useState(true);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<"attorney" | "collaborator" | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const sub = useSubscription();

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/lawyer-signup", replace: true }); return; }
    getRole().then(async (r) => {
      if (r.role !== "attorney" && r.role !== "collaborator") {
        navigate({ to: "/lawyer-signup", replace: true });
        return;
      }
      setUserRole(r.role);
      if (r.role === "collaborator") {
        // Collaborators inherit the lead attorney's onboarding and subscription.
        setOnboarded(true);
      } else {
        try {
          const { profile } = await getProfile();
          setOnboarded(profile?.onboarded === true);
        } catch {
          setOnboarded(false);
        }
      }
      setChecking(false);
    }).catch(() => navigate({ to: "/lawyer-signup", replace: true }));
  }, [user, loading, getRole, getProfile, navigate]);

  // Hard paywall: any non-billing route requires an active subscription.
  // /subscribe, /billing-return, and /setup are reachable without one.
  const billingPaths =
    pathname === "/subscribe" ||
    pathname === "/billing-return" ||
    pathname === "/setup" ||
    pathname === "/billing" ||
    pathname === "/trust";
  const onSetup = pathname === "/setup";

  // Force onboarding before anything else if attorney hasn't completed it.
  useEffect(() => {
    if (loading || checking) return;
    if (!user) return;
    if (onboarded === false && !onSetup) {
      navigate({ to: "/setup", replace: true });
    }
  }, [loading, checking, onboarded, onSetup, navigate, user]);

  useEffect(() => {
    if (loading || checking || sub.loading) return;
    if (!user) return;
    if (onboarded === false) return; // onboarding takes priority over paywall
    // Collaborators bypass the paywall — the lead attorney pays for the seat.
    if (userRole === "collaborator") return;
    if (!sub.isActive && !billingPaths) {
      navigate({ to: "/subscribe", replace: true });
    }
  }, [loading, checking, sub.loading, sub.isActive, billingPaths, navigate, user, onboarded, userRole]);

  if (loading || checking || sub.loading) {
    return (
      <div className="att-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="att-eyebrow">Opening portal…</span>
      </div>
    );
  }

  return (
    <div className="att-root att-cockpit">
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
        <span>·</span>
        <a href="/privacy" style={{ color: "inherit", textDecoration: "underline" }}>Privacy Policy</a>
      </footer>
    </div>
  );
}

/* ---------- top nav ---------- */
const CASE_TABS = [
  { key: "overview", label: "Case File", to: "/clients/$clientId" },
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
      <Link to="/clients" className="att-nav-brand" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <Logo variant="attorney" size={36} />
        <span style={{ opacity: 0.55, fontSize: 13 }}>· Attorney Portal</span>
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
          <>
            <Link to="/clients" className={`att-nav-tab ${pathname === "/clients" ? "active" : ""}`}>Clients</Link>
            <Link to="/billing" className={`att-nav-tab ${pathname === "/billing" ? "active" : ""}`}>Billing</Link>
            <Link to="/trust" className={`att-nav-tab ${pathname === "/trust" ? "active" : ""}`}>Trust</Link>
          </>
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
    { label: "PatternProof", to: "/clients" },
    { label: "Attorney Portal", to: "/clients" },
  ];
  if (clientId) {
    parts.push({ label: `Client PP-${clientId.slice(0, 4).toUpperCase()}` });
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
