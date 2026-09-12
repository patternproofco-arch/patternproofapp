import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  LogOut,
  Settings,
  FileText,
  Shield,
  Home,
  Zap,
  AlertCircle,
  Menu,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import survivorCss from "@/styles/survivor.css?url";

export const Route = createFileRoute("/_survivor")({
  head: () => ({
    links: [{ rel: "stylesheet", href: survivorCss }],
    meta: [
      { title: "Survivor Portal — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SurvivorLayout,
});

function SurvivorLayout() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/", replace: true });
      return;
    }
    setChecking(false);
  }, [user, authLoading, navigate]);

  if (authLoading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  const navItems = [
    { label: "Home", icon: Home, href: "/survivor" },
    { label: "Timeline", icon: FileText, href: "/survivor/timeline" },
    { label: "Capture", icon: Zap, href: "/survivor/capture" },
    { label: "Settings", icon: Settings, href: "/survivor/settings" },
  ];

  return (
    <div className="survivor-app flex min-h-screen flex-col bg-background md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between border-b border-border bg-ground p-4">
        <div className="flex items-center gap-2">
          <BrandMark />
          <span className="font-semibold text-foreground">PatternProof</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 md:relative md:z-auto md:bg-transparent ${
          sidebarOpen ? "block" : "hidden md:block"
        }`}
        onClick={() => setSidebarOpen(false)}
      >
        <nav className="survivor-sidebar h-screen w-64 border-r border-border bg-ground p-6 overflow-y-auto md:sticky md:top-0">
          {/* Branding */}
          <div className="mb-8 hidden md:flex items-center gap-3">
            <BrandMark />
            <div className="flex-1">
              <div className="font-semibold text-foreground text-sm">PatternProof</div>
              <div className="text-xs text-muted-foreground">Survivor Portal</div>
            </div>
          </div>

          {/* Quick Info */}
          <div className="mb-8 rounded-lg bg-background p-3 border border-border/50">
            <div className="text-xs text-muted-foreground mb-1">Logged in as</div>
            <div className="text-sm font-medium text-foreground truncate">{user?.email}</div>
          </div>

          {/* Navigation */}
          <div className="space-y-2 mb-8">
            {navItems.map(({ label, icon: Icon, href }) => (
              <Link
                key={href}
                to={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  pathname === href
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{label}</span>
              </Link>
            ))}
          </div>

          {/* Quick Exit */}
          <div className="border-t border-border pt-6 mt-auto">
            <button
              data-quick-exit
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors font-medium"
            >
              <AlertCircle className="h-5 w-5" />
              <span>Quick Exit</span>
            </button>
          </div>

          {/* Sign Out */}
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/", replace: true });
            }}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors text-sm"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <main className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
