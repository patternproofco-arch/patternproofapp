import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PenLine,
  Paperclip,
  Mic,
  Clock3,
  Sparkles,
  TrendingUp,
  Briefcase,
  FileText,
  Hammer,
  BookMarked,
  HeartHandshake,
  LifeBuoy,
  Lock,
  LogOut,
  Settings as SettingsIcon,
  ChevronDown,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AiSidekick } from "@/components/AiSidekick";
import { FloatingRecordButton } from "@/components/FloatingRecordButton";
import { useState, useEffect } from "react";
import { useSettings } from "@/lib/settings-context";
import { BrandLogo } from "@/components/BrandLogo";

type Item = { to: string; label: string; icon: typeof LayoutDashboard };
type Group = { label: string | null; key: string; items: Item[] };

const HOME_ITEM: Item = { to: "/dashboard", label: "Home", icon: LayoutDashboard };

const GROUPS: Group[] = [
  {
    label: "Document", key: "document",
    items: [
      { to: "/journal", label: "Log incident", icon: PenLine },
      { to: "/evidence", label: "Upload evidence", icon: Paperclip },
      { to: "/voice-notes", label: "Voice memo", icon: Mic },
    ],
  },
  {
    label: "Patterns", key: "patterns",
    items: [
      { to: "/timeline", label: "My timeline", icon: Clock3 },
      { to: "/patterns", label: "Pattern insights", icon: Sparkles },
      { to: "/escalation-detector", label: "Behavior trends", icon: TrendingUp },
    ],
  },
  {
    label: "Prepare", key: "prepare",
    items: [
      { to: "/share-with-attorney", label: "Share with attorney", icon: Briefcase },
      { to: "/court-packet", label: "Court summaries", icon: FileText },
      { to: "/case-builder", label: "Evidence packets", icon: Hammer },
    ],
  },
  {
    label: "Resources", key: "resources",
    items: [
      { to: "/why-courts-struggle", label: "Coercive control", icon: BookMarked },
      { to: "/court-systems", label: "Court system guide", icon: HeartHandshake },
      { to: "/legal-documents", label: "My legal documents", icon: FileText },
      { to: "/resources", label: "Safety planning", icon: LifeBuoy },
    ],
  },
];

const SETTINGS_ITEM: Item = { to: "/settings", label: "Settings", icon: SettingsIcon };

export function AppShell() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [navOpen, setNavOpen] = useState(false);
  const { settings } = useSettings();
  // Close drawer on route change
  useEffect(() => { setNavOpen(false); }, [pathname]);

  // Quick-exit: discreet "Exit safely" link + double-Esc shortcut.
  const exit = () => {
    const url = settings.exitUrl || "https://weather.com";
    try { window.history.replaceState(null, "", "/"); } catch { /* ignore */ }
    window.location.replace(url);
  };
  useEffect(() => {
    let last = 0;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const now = Date.now();
        if (now - last < 500) exit();
        last = now;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.exitUrl]);

  // Group open/closed state — collapsed by default, persisted in localStorage,
  // auto-expand only the group containing the active route.
  const STORAGE_KEY = "pp.sidebar.groups";
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = {
      document: false, patterns: false, prepare: false, resources: false,
    };
    if (typeof window === "undefined") return base;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...base, ...JSON.parse(raw) };
    } catch {}
    return base;
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
    } catch {}
  }, [open]);
  useEffect(() => {
    for (const g of GROUPS) {
      if (g.items.some((i) => pathname === i.to || pathname.startsWith(i.to + "/"))) {
        setOpen((o) => (o[g.key] ? o : { ...o, [g.key]: true }));
      }
    }
  }, [pathname]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const itemClass = (active: boolean) => ({
    background: active ? "rgba(122,148,121,0.18)" : "transparent",
    color: active ? "var(--sidebar-active)" : "var(--sidebar-inactive)",
    fontWeight: active ? 600 : 400,
    borderLeft: active ? "2px solid var(--primary)" : "2px solid transparent",
    paddingLeft: active ? "10px" : "12px",
  });

  const SidebarInner = (
    <>
      <div className="px-6 pt-6 pb-8">
        <BrandLogo variant="light" maxWidth={180} />
      </div>
      <nav className="flex-1 px-3">
        {(() => {
          const active = pathname === HOME_ITEM.to;
          const Icon = HOME_ITEM.icon;
          return (
            <Link
              to={HOME_ITEM.to}
              className="mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors"
              style={itemClass(active)}
            >
              <Icon size={17} />
              {HOME_ITEM.label}
            </Link>
          );
        })()}

        <Link
          to="/journal"
          className="mb-4 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-opacity hover:opacity-90"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)", letterSpacing: "0.02em" }}
        >
          <PenLine size={15} />
          Log incident
        </Link>

        <Link
          to="/share-with-attorney"
          className="mb-5 flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition-transform hover:-translate-y-px"
          style={{
            background: "rgba(122,148,121,0.16)",
            color: "var(--sidebar-active)",
            boxShadow: "0 6px 18px -10px rgba(0,0,0,0.35)",
            border: "1px solid rgba(122,148,121,0.30)",
          }}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: "rgba(122,148,121,0.35)", color: "#fff" }}>
            <Briefcase size={14} />
          </div>
          <div className="flex flex-col leading-tight">
            <span>Attorney portal</span>
            <span className="text-[10px] font-normal" style={{ opacity: 0.65, letterSpacing: "1.8px", textTransform: "uppercase" }}>
              Share &amp; collaborate
            </span>
          </div>
        </Link>

        {GROUPS.map((g, idx) => {
          const isOpen = open[g.key];
          return (
            <div key={g.key} className={idx === 0 ? "mb-3" : "mb-3 mt-3"}>
              {g.label && (
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}
                  className="mb-1 flex w-full items-center justify-between px-3 py-1.5"
                  style={{
                    color: "rgba(247,243,236,0.50)",
                    fontSize: "10px",
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  {g.label}
                  <ChevronDown
                    size={11}
                    style={{ transition: "transform 200ms", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                  />
                </button>
              )}
              <div
                style={{
                  maxHeight: isOpen ? `${g.items.length * 44 + 8}px` : "0px",
                  overflow: "hidden",
                  transition: "max-height 200ms ease",
                }}
              >
                {g.items.map((item) => {
                  const active = pathname === item.to || pathname.startsWith(item.to + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors"
                      style={itemClass(active)}
                    >
                      <Icon size={17} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="mt-4">
          {(() => {
            const active = pathname === SETTINGS_ITEM.to;
            const Icon = SETTINGS_ITEM.icon;
            return (
              <Link
                to={SETTINGS_ITEM.to}
                className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors"
                style={itemClass(active)}
              >
                <Icon size={17} />
                {SETTINGS_ITEM.label}
              </Link>
            );
          })()}
        </div>
      </nav>
      <div className="px-5 pb-6 pt-3">
        <div
          className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[11px]"
          style={{ background: "rgba(122,148,121,0.18)", color: "#BBD0BA", letterSpacing: "2px", fontWeight: 600 }}
        >
          <Lock size={13} />
          END-TO-END ENCRYPTED
        </div>
        {user && (
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-[12px]"
            style={{ color: "var(--sidebar-inactive)" }}
          >
            <LogOut size={13} /> Sign out
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--background)" }}>
      {/* Universal minimal top bar — logo + lock + Exit safely + hamburger */}
      <div
        className="no-print fixed left-0 right-0 top-0 z-40 flex items-center justify-between px-5 py-4 md:px-10"
        style={{ background: "var(--background)" }}
      >
        <BrandLogo variant="dark" maxWidth={150} />
        <div className="flex items-center gap-4 md:gap-6">
          <span
            className="hidden items-center gap-1.5 text-[11px] sm:flex"
            style={{ color: "var(--muted-foreground)", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}
            title="End-to-end encrypted — only you can see this"
          >
            <Lock size={11} /> Private
          </span>
          <button
            type="button"
            onClick={exit}
            className="flex items-center gap-1 text-[12px] transition-opacity hover:opacity-70"
            style={{ color: "var(--muted-foreground)", fontWeight: 500 }}
            aria-label="Exit safely — double-press Escape"
            title="Exit safely — double-press Escape"
          >
            Exit safely <ArrowUpRight size={12} />
          </button>
          <button
            type="button"
            aria-label={navOpen ? "Close menu" : "Open menu"}
            onClick={() => setNavOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:opacity-80"
            style={{ color: "var(--foreground)" }}
          >
            {navOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Slide-out drawer (used on every viewport) */}
      {navOpen && (
        <div
          className="no-print fixed inset-0 z-50"
          onClick={() => setNavOpen(false)}
          style={{ background: "rgba(42,37,32,0.45)" }}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-0 flex h-full w-[280px] flex-col overflow-y-auto"
            style={{ background: "var(--sidebar)", boxShadow: "8px 0 24px -8px rgba(0,0,0,0.4)" }}
          >
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setNavOpen(false)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ color: "var(--sidebar-inactive)" }}
            >
              <X size={20} />
            </button>
            {SidebarInner}
          </aside>
        </div>
      )}

      <main className="print-page pt-16 md:pt-20">
        <Outlet />
      </main>
      <AiSidekick />
      <FloatingRecordButton />
    </div>
  );
}