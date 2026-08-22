import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { LogOut, Lock, LayoutGrid, Users, CreditCard, ShieldCheck, MessageSquare, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole, getAttorneyProfile } from "@/lib/attorney-portal.functions";
import { getClioAvailability, getClioStatus } from "@/lib/clio.functions";
import { useSubscription } from "@/hooks/useSubscription";
import attorneyCss from "@/styles/attorney.css?url";
import { BrandMark } from "@/components/BrandMark";
import { FocusModeProvider } from "@/components/survivor/focus-mode";

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<"attorney" | "collaborator" | null>(null);
  const [firmName, setFirmName] = useState<string | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const sub = useSubscription();

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/lawyer-signup", replace: true }); return; }
    let cancelled = false;
    setLoadError(null);
    getRole().then(async (r) => {
      if (cancelled) return;
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
          setFirmName(profile?.firm_name ?? profile?.full_name ?? null);
        } catch {
          setOnboarded(false);
        }
      }
      if (cancelled) return;
      setChecking(false);
    }).catch(() => {
      if (cancelled) return;
      // Never leave the portal stuck on "Opening portal…" — surface a retry.
      setLoadError("We couldn't reach your account just now.");
      setChecking(false);
    });
    return () => { cancelled = true; };
  }, [user, loading, getRole, getProfile, navigate, retryKey]);

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
      toast("Finish setting up your account to continue", {
        id: "attorney-onboarding-redirect",
        description: "We've brought you to setup — it only takes a moment.",
      });
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
      <div className="att-root" data-persona="attorney" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="att-eyebrow">Opening portal…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="att-root" data-persona="attorney" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", display: "grid", gap: 12, maxWidth: 420, padding: 24 }}>
          <span className="att-eyebrow">Portal unavailable</span>
          <p style={{ margin: 0 }}>{loadError} Check your connection and try again.</p>
          <div>
            <button
              type="button"
              className="att-btn att-btn-primary"
              onClick={() => { setLoadError(null); setChecking(true); setRetryKey((k) => k + 1); }}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="att-root att-cockpit att-shell" data-persona="attorney">
      <AttorneySidebar />
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <AttorneyTopBar firmName={firmName} />
        <SecurityBanner />
        <LegalDisclaimerBar />
        <AttorneyBreadcrumb />
        <main className="att-content">
          <FocusModeProvider accentColor="var(--att-navy)">
            <Outlet />
          </FocusModeProvider>
        </main>
        <footer className="att-footer">
        <span>PatternProof</span>
        <span>·</span>
        <span>attorney.pattern-proof.tech</span>
        <span>·</span>
        <span>Encrypted in transit · access logged</span>
        <span>·</span>
        <span>Session logged · {new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
        <span>·</span>
        <span>Matter opens, downloads & exports recorded</span>
        <span>·</span>
        <span>
          PatternProof organises the client&apos;s own records. It does not draw legal conclusions
          and is not legal advice.
        </span>
        <span>·</span>
          <a href="/privacy" style={{ color: "inherit", textDecoration: "underline" }}>Privacy Policy</a>
        </footer>
      </div>
    </div>
  );
}

function useClientIdFromPath(): string | null {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const m = pathname.match(/^\/clients\/([0-9a-f-]{36})/i);
  return m?.[1] ?? null;
}

/* ---------- persistent left sidebar ---------- */
const NAV_ITEMS = [
  { to: "/caseload", label: "Dashboard", icon: LayoutGrid },
  { to: "/clients", label: "Matters", icon: Users },
  { to: "/conflict-check", label: "Conflict check", icon: ScanSearch },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/trust", label: "Settings", icon: ShieldCheck },
  { to: "/attorney-feedback", label: "Feedback", icon: MessageSquare },
] as const;

function AttorneySidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => {
    if (to === "/clients") return pathname.startsWith("/clients");
    return pathname === to;
  };
  return (
    <aside className="att-sidebar">
      <Link to="/clients" className="att-sidebar-brand">
        <BrandMark size={26} variant="attorney" />
        <span>PatternProof</span>
      </Link>
      <div className="att-sidebar-section">Practice</div>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.label}
          to={item.to}
          className={`att-side-link ${isActive(item.to) ? "active" : ""}`}
        >
          <item.icon size={14} /> {item.label}
        </Link>
      ))}
      <div className="att-sidebar-foot">
        <ClioStatusChip />
        <span className="att-eyebrow">Attorney portal</span>
      </div>
    </aside>
  );
}

/**
 * Explicit, honest integration status. Clio is unverified beta and may be
 * unavailable — say so plainly rather than showing a silently dead control.
 */
function ClioStatusChip() {
  const statusFn = useServerFn(getClioStatus);
  const availabilityFn = useServerFn(getClioAvailability);
  const [label, setLabel] = useState("Clio · checking…");
  const [tone, setTone] = useState<"on" | "off">("off");

  useEffect(() => {
    let cancelled = false;
    Promise.all([availabilityFn({}), statusFn({})])
      .then(([avail, status]) => {
        if (cancelled) return;
        const connected = Boolean((status as { connected?: boolean } | null)?.connected);
        const available = Boolean((avail as { available?: boolean } | null)?.available);
        setTone(connected ? "on" : "off");
        setLabel(connected ? "Clio · connected (beta)" : available ? "Clio · not connected (beta)" : "Clio · unavailable (beta)");
      })
      .catch(() => { if (!cancelled) setLabel("Clio · not connected (beta)"); });
    return () => { cancelled = true; };
  }, [statusFn, availabilityFn]);

  return (
    <Link
      to="/billing"
      hash="clio"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10,
        fontSize: 11, letterSpacing: "0.02em", color: "inherit", textDecoration: "none",
      }}
      title="Clio Manage integration is an unverified beta"
    >
      <span
        aria-hidden
        style={{
          width: 7, height: 7, borderRadius: 999,
          background: tone === "on" ? "#5F8B67" : "rgba(255,255,255,0.45)",
          outline: tone === "on" ? "none" : "1px solid rgba(255,255,255,0.45)",
        }}
      />
      {label}
    </Link>
  );
}

/* ---------- minimal top bar ---------- */
function AttorneyTopBar({ firmName }: { firmName: string | null }) {
  const navigate = useNavigate();
  const clientId = useClientIdFromPath();
  const caseId = clientId ? `PP-${clientId.slice(0, 4).toUpperCase()}` : null;
  return (
    <div className="att-topbar">
      <div className="att-topbar-firm">
        <span>{firmName ?? "Your firm"}</span>
        {caseId && <span className="att-mono">Matter {caseId}</span>}
      </div>
      <button
        onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/lawyer-signup" }); }}
        className="att-btn-ghost"
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <LogOut size={13} /> Sign out
      </button>
    </div>
  );
}

/* ---------- security banner ---------- */
function SecurityBanner() {
  return <SecurityBannerInner />;
}

/**
 * Permanent, non-dismissible. Attorneys must never be able to hide the fact
 * that this tool organises a client's own records rather than assessing them.
 */
function LegalDisclaimerBar() {
  return (
    <div
      role="note"
      style={{
        borderBottom: "1px solid rgba(21,32,56,0.12)",
        background: "rgba(21,32,56,0.04)",
        color: "var(--att-navy)",
        fontSize: 11.5,
        lineHeight: 1.5,
        letterSpacing: "0.01em",
        padding: "7px 2rem",
        display: "flex",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <span style={{ maxWidth: 1280 }}>
        <strong style={{ fontWeight: 600 }}>No legal conclusions.</strong>{" "}
        PatternProof compiles and organises records supplied by the client. Summaries, pattern
        groupings, gap lists and flagged inconsistencies are generated from that material and are{" "}
        <strong style={{ fontWeight: 600 }}>not findings of fact, legal advice, or an opinion on
        the merits</strong>. Verify every item against its source before relying on it.
      </span>
    </div>
  );
}

function SecurityBannerInner() {
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
        This session is encrypted in transit. Matter ID: <span className="att-mono">{caseId}</span>.
        Matter opens, evidence downloads, and packet exports are recorded.
      </span>
      <button
        onClick={() => { sessionStorage.setItem("att-security-dismissed", "1"); setDismissed(true); }}
        className="att-btn-ghost"
        style={{ padding: "2px 8px", fontSize: 11, color: "var(--att-navy)" }}
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
