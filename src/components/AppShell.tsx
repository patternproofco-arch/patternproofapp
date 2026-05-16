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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { QuickExitButton } from "@/components/QuickExitButton";
import { AiSidekick } from "@/components/AiSidekick";
import { FloatingRecordButton } from "@/components/FloatingRecordButton";
import { useSettings } from "@/lib/settings-context";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/timeline", label: "Timeline", icon: Clock3 },
  { to: "/evidence", label: "Evidence", icon: Paperclip },
  { to: "/voice-notes", label: "Voice Notes", icon: Mic },
  { to: "/case-builder", label: "Case Builder", icon: Hammer },
  { to: "/court-packet", label: "Court Packet", icon: FileText },
  { to: "/escalation-detector", label: "Escalation Detector", icon: ShieldAlert },
  { to: "/attorney-portal", label: "Attorney Portal", icon: Briefcase },
  { to: "/opra-helper", label: "OPRA Helper", icon: FileSearch },
  { to: "/resources", label: "Resources", icon: HeartHandshake },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppShell() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await supabase.auth.signOut();
  };

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
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors"
                style={{
                  background: active ? "rgba(245,230,223,0.15)" : "transparent",
                  color: active ? "var(--sidebar-active)" : "var(--sidebar-inactive)",
                  fontWeight: active ? 700 : 600,
                }}
              >
                <Icon size={17} />
                {item.label}
              </Link>
            );
          })}
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
        {NAV.map((item) => {
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