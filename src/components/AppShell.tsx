import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BookOpen,
  Clock3,
  Paperclip,
  Mic,
  Hammer,
  FileText,
  Lock,
  LogOut,
  ShieldAlert,
  Briefcase,
  FileSearch,
  HeartHandshake,
  Settings as SettingsIcon,
  Scale,
  ChevronDown,
  MessageCircle,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { QuickExitButton } from "@/components/QuickExitButton";
import { AiSidekick } from "@/components/AiSidekick";
import { FloatingRecordButton } from "@/components/FloatingRecordButton";
import { useSettings } from "@/lib/settings-context";
import { useState, useEffect } from "react";

type Item = { to: string; label: string; icon: typeof LayoutDashboard };
type Group = { label: string | null; key: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: null, key: "main",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/journal", label: "Journal", icon: BookOpen },
      { to: "/timeline", label: "Timeline", icon: Clock3 },
      { to: "/evidence", label: "Evidence", icon: Paperclip },
      { to: "/communications", label: "Communications", icon: MessageCircle },
      { to: "/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "My Case", key: "case",
    items: [
      { to: "/voice-notes", label: "Voice Notes", icon: Mic },
      { to: "/patterns", label: "Patterns", icon: Sparkles },
      { to: "/case-builder", label: "Case Builder", icon: Hammer },
      { to: "/court-packet", label: "Court Packet", icon: FileText },
    ],
  },
  {
    label: "Tools", key: "tools",
    items: [
      { to: "/legal-documents", label: "Legal Documents", icon: Scale },
      { to: "/escalation-detector", label: "Escalation Detector", icon: ShieldAlert },
      { to: "/attorney-portal", label: "Attorney Portal", icon: Briefcase },
      { to: "/opra-helper", label: "OPRA Helper", icon: FileSearch },
    ],
  },
  {
    label: "Support", key: "support",
    items: [
      { to: "/resources", label: "Resources", icon: HeartHandshake },
    ],
  },
];

const SETTINGS_ITEM: Item = { to: "/settings", label: "Settings", icon: SettingsIcon };
const ALL_ITEMS: Item[] = [...GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

export function AppShell() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Group open/closed state — auto-expand the group containing the active route.
  const [open, setOpen] = useState<Record<string, boolean>>({
    main: true, case: true, tools: true, support: true,
  });
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
      {/* Desktop sidebar */}
      <aside
        className="no-print fixed left-0 top-0 hidden h-screen w-[210px] flex-col overflow-y-auto md:flex"
        style={{ background: "var(--sidebar)" }}
      >
        <div className="px-6 pt-7 pb-8">
          <div className="font-serif text-[22px] font-bold" style={{ color: "var(--sidebar-active)" }}>
            {settings.disguiseName}
          </div>
        </div>
        <nav className="flex-1 px-3">
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