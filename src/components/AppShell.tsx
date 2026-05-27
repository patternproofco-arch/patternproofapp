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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { QuickExitButton } from "@/components/QuickExitButton";
import { AiSidekick } from "@/components/AiSidekick";
import { FloatingRecordButton } from "@/components/FloatingRecordButton";
import { useState, useEffect } from "react";
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
const ALL_ITEMS: Item[] = [HOME_ITEM, ...GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

export function AppShell() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
    background: active ? "rgba(245,230,223,0.15)" : "transparent",
    color: active ? "var(--sidebar-active)" : "var(--sidebar-inactive)",
    fontWeight: active ? 700 : 600,
  });

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--background)" }}>
      <QuickExitButton />
      {/* Mobile fixed top-left brand lockup — dark on cream background */}
      <div
        className="no-print fixed left-6 top-6 z-50 md:hidden"
        style={{ maxWidth: 140 }}
      >
        <BrandLogo variant="dark" maxWidth={140} withShadow />
      </div>
      {/* Desktop sidebar */}
      <aside
        className="no-print fixed left-0 top-0 hidden h-screen w-[210px] flex-col overflow-y-auto md:flex"
        style={{ background: "var(--sidebar)" }}
      >
        <div className="px-6 pt-6 pb-8">
          <BrandLogo variant="light" maxWidth={180} />
        </div>
        <nav className="flex-1 px-3">
          {/* Home — always one click from anywhere */}
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

          {/* Primary CTA — most-used action available from every route */}
          <Link
            to="/journal"
            className="mb-4 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-opacity hover:opacity-90"
            style={{
              background: "var(--primary)",
              color: "var(--sidebar)",
              letterSpacing: "0.02em",
            }}
          >
            <PenLine size={15} />
            Log incident
          </Link>

          {/* Attorney portal — elevated, navy/cream, distinct from journaling */}
          <Link
            to="/share-with-attorney"
            className="mb-5 flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition-transform hover:-translate-y-px"
            style={{
              background: "linear-gradient(135deg, #1A140E 0%, #2B2017 100%)",
              color: "#F5EAD0",
              boxShadow: "0 8px 22px -10px rgba(26,20,14,0.55)",
              border: "1px solid rgba(245,234,208,0.10)",
            }}
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-md"
              style={{ background: "rgba(245,241,230,0.12)" }}
            >
              <Briefcase size={14} />
            </div>
            <div className="flex flex-col leading-tight">
              <span>Attorney portal</span>
              <span className="text-[10px] font-normal" style={{ opacity: 0.7, letterSpacing: "1.5px", textTransform: "uppercase" }}>
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
                      color: "rgba(232,201,188,0.5)",
                      fontSize: "9px",
                      letterSpacing: "5px",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    {g.label}
                    <ChevronDown
                      size={11}
                      style={{
                        transition: "transform 200ms",
                        transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                      }}
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
            style={{ background: "rgba(168,216,185,0.08)", color: "var(--safe)", letterSpacing: "2px", fontWeight: 600 }}
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
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="no-print fixed bottom-0 left-0 right-0 z-40 flex overflow-x-auto border-t md:hidden"
        style={{ background: "var(--sidebar)", borderColor: "rgba(0,0,0,0.2)" }}
      >
        {ALL_ITEMS.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex min-w-[64px] flex-col items-center gap-1 py-2 text-[10px]"
              style={{
                color: active ? "var(--sidebar-active)" : "var(--sidebar-inactive)",
                fontWeight: active ? 700 : 600,
              }}
            >
              <Icon size={18} />
              <span className="truncate">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>

      <main className="print-page md:ml-[210px] pb-24 md:pb-12">
        <div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">
          <Outlet />
        </div>
      </main>
      <AiSidekick />
      <FloatingRecordButton />
    </div>
  );
}