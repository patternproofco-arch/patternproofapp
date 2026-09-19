import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  LogOut,
  Lock,
  LayoutGrid,
  Users,
  CreditCard,
  ShieldCheck,
  MessageSquare,
  ScanSearch,
  UserCog,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole, getAttorneyProfile } from "@/lib/attorney-portal.functions";
import { getClioAvailability, getClioStatus } from "@/lib/clio.functions";
import { useSubscription } from "@/hooks/useSubscription";
import attorneyCss from "@/styles/attorney.css?url";
import { BrandMark } from "@/components/BrandMark";
import { FocusModeProvider } from "@/components/survivor/focus-mode";
import { useMfaGate } from "@/hooks/use-mfa-gate";
import {
  attorneyPathExemptFromRequiredMfa,
  attorneyPathWithoutPortalChrome,
} from "@/lib/mfa";

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
  const mfaExempt = attorneyPathExemptFromRequiredMfa(pathname);
  const mfaChecking = useMfaGate(!loading && !!user && !mfaExempt, {
    requireEnrollment: true,
    enrollTo: "/trust",
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Signed-out / MFA deny must land on sign-in, not the public signup form.
      navigate({ to: "/signin", replace: true });
      return;
    }
    let cancelled = false;
    setLoadError(null);
    getRole()
      .then(async (r) => {
        if (cancelled) return;
        if (r.role !== "attorney" && r.role !== "collaborator") {
          navigate({ to: "/lawyer-signup", replace: true });
          return;
        }
        setUserRole(r.role);
        if (r.role === "collaborator") {
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
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("We couldn't reach your account just now.");
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading, getRole, getProfile, navigate, retryKey]);

  useEffect(() => {
    if (!(loading || checking || sub.loading || mfaChecking)) return;
    const timer = setTimeout(() => {
      setLoadError((prev) => prev ?? "This is taking longer than it should.");
    }, 15000);
    return () => clearTimeout(timer);
  }, [loading, checking, sub.loading, mfaChecking]);

  const billingPaths =
    pathname === "/subscribe" ||
    pathname === "/billing-return" ||
    pathname === "/setup" ||
    pathname === "/billing" ||
    pathname === "/trust" ||
    pathname === "/two-factor";
  const onSetup = pathname === "/setup";

  useEffect(() => {
    if (loading || checking || mfaChecking) return;
    if (!user) return;
    if (onboarded === false && !onSetup && pathname !== "/trust" && pathname !== "/two-factor") {
      toast("Finish setting up your account to continue", {
        id: "attorney-onboarding-redirect",
        description: "We've brought you to setup — it only takes a moment.",
      });
      navigate({ to: "/setup", replace: true });
    }
  }, [loading, checking, mfaChecking, onboarded, onSetup, navigate, user, pathname]);

  useEffect(() => {
    if (loading || checking || sub.loading || mfaChecking) return;
    if (!user) return;
    if (onboarded === false) return;
    if (userRole === "collaborator") return;
    if (!sub.isActive && !billingPaths) {
      navigate({ to: "/subscribe", replace: true });
    }
  }, [
    loading,
    checking,
    mfaChecking,
    sub.loading,
    sub.isActive,
    billingPaths,
    navigate,
    user,
    onboarded,
    userRole,
  ]);

  if (loadError) {
    return (
      <div
        className="att-root"
        data-persona="attorney"
        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div style={{ textAlign: "center", display: "grid", gap: 12, maxWidth: 420, padding: 24 }}>
          <span className="att-eyebrow">Portal unavailable</span>
          <p style={{ margin: 0 }}>{loadError} Check your connection and try again.</p>
          <div>
            <button
              type="button"
              className="att-btn att-btn-primary"
              onClick={() => {
                setLoadError(null);
                setChecking(true);
                setRetryKey((k) => k + 1);
                sub.refetch();
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || checking || sub.loading || mfaChecking) {
    return (
      <div
        className="att-root"
        data-persona="attorney"
        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span className="att-eyebrow">Opening portal…</span>
      </div>
    );
  }

  // MFA enroll / challenge setup: no caseload sidebar chrome.
  // A failed factor lookup must never look like an open attorney portal.
  if (attorneyPathWithoutPortalChrome(pathname)) {
    return (
      <div
        className="att-root"
        data-persona="attorney"
        data-mfa-shell="minimal"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}
      >
        <div style={{ width: "100%", maxWidth: 560 }}>
          <Outlet />
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
          <span>
            Session logged ·{" "}
            {new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </span>
          <span>·</span>
          <span>Matter opens, downloads & exports recorded</span>
          <span>·</span>
          <span>
            PatternProof organises the client's own records. It does not draw legal conclusions
            and is not legal advice.
          </span>
          <span>·</span>
          <a href="/privacy" style={{ color: "inherit", textDecoration: "underline" }}>
            Privacy Policy
          </a>
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

const NAV_ITEMS = [
  { to: "/caseload", label: "Dashboard", icon: LayoutGrid },
  { to: "/matters", label: "Matters", icon: FolderOpen },
  { to: "/clients", label: "Shared files", icon: Users },
  { to: "/conflict-check", label: "Conflict check", icon: ScanSearch },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/team", label: "Team", icon: UserCog },
  { to: "/trust", label: "Settings", icon: ShieldCheck },
  { to: "/attorney-feedback", label: "Feedback", icon: MessageSquare },
] as const;

function AttorneySidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => {
    if (to === "/clients") return pathname.startsWith("/clients");
    if (to === "/matters") return pathname.startsWith("/matters");
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
        setLabel(
          connected
            ? "Clio · connected (beta)"
            : available
              ? "Clio · not connected (beta)"
              : "Clio · unavailable (beta)",
        );
      })
      .catch(() => {
        if (!cancelled) setLabel("Clio · not connected (beta)");
      });
    return () => {
      cancelled = true;
    };
  }, [statusFn, availabilityFn]);

  return (
    <Link
      to="/billing"
      hash="clio"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 10,
        fontSize: 11,
        letterSpacing: "0.02em",
        color: "inherit",
        textDecoration: "none",
      }}
      title="Clio Manage integration is an unverified beta"
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: tone === "on" ? "var(--pp-confirmed)" : "rgba(255,255,255,0.45)",
          outline: tone === "on" ? "none" : "1px solid rgba(255,255,255,0.45)",
        }}
      />
      {label}
    </Link>
  );
}

function AttorneyTopBar({ firmName }: { firmName: string | null }) {
  const navigate = useNavigate();
  const clientId = useClientIdFromPath();
  const caseId = clientId ? `PP-${clientId.slice(0, 4).toUpperCase()}` : null;
  return (
    <div className="att-topbar pp-app-chrome">
      <div className="att-topbar-firm">
        <span>{firmName ?? "Your firm"}</span>
        {caseId && <span className="att-mono">Matter {caseId}</span>}
      </div>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/signin" });
        }}
        className="att-btn-ghost"
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <LogOut size={13} /> Sign out
      </button>
    </div>
  );
}

function SecurityBanner() {
  return <SecurityBannerInner />;
}

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
        <strong style={{ fontWeight: 600 }}>No legal conclusions.</strong> PatternProof compiles and
        organises records supplied by the client. Summaries, pattern groupings, gap lists and
        flagged inconsistencies are generated from that material and are{" "}
        <strong style={{ fontWeight: 600 }}>
          not findings of fact, legal advice, or an opinion on the merits
        </strong>
        . Verify every item against its source before relying on it.
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
        onClick={() => {
          sessionStorage.setItem("att-security-dismissed", "1");
          setDismissed(true);
        }}
        className="att-btn-ghost"
        style={{ padding: "2px 8px", fontSize: 11, color: "var(--att-navy)" }}
      >
        Dismiss
      </button>
    </div>
  );
}

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
          {p.to && i < parts.length - 1 ? (
            <Link to={p.to}>{p.label}</Link>
          ) : (
            <span style={{ color: "var(--att-text-2)" }}>{p.label}</span>
          )}
          {i < parts.length - 1 && <span className="att-breadcrumb-sep">/</span>}
        </span>
      ))}
    </div>
  );
}
