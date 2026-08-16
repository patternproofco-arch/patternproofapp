import { Link } from "@tanstack/react-router";
import { Search, Sparkles, Settings as SettingsIcon, LifeBuoy, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const ITEMS = [
  { to: "/agent", label: "PatternProof Agent", Icon: Sparkles },
  { to: "/settings", label: "Safety & privacy settings", Icon: ShieldCheck },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
  { to: "/support", label: "Support", Icon: LifeBuoy },
] as const;

/**
 * Top utility row: search, account-level tools and sign out. Nothing here is
 * gated or removed — it simply sits above the workspace instead of in the rail.
 */
export function UtilityBar() {
  const { user } = useAuth();
  const initial = (user?.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="no-print flex flex-1 items-center justify-end gap-1">
      <Link to="/search" className="pp-search mr-auto" aria-label="Search your records">
        <Search size={15} strokeWidth={2} />
        <span className="truncate">Search your records</span>
      </Link>

      {ITEMS.map(({ to, label, Icon }) => (
        <Link key={label} to={to} aria-label={label} title={label} className="pp-iconbtn">
          <Icon size={17} strokeWidth={1.9} />
        </Link>
      ))}

      <button
        type="button"
        onClick={() => { void supabase.auth.signOut(); }}
        aria-label="Sign out"
        title="Sign out"
        className="pp-iconbtn"
      >
        <LogOut size={17} strokeWidth={1.9} />
      </button>

      <span className="pp-avatar ml-1" title={user?.email ?? "Account"} aria-hidden>
        {initial}
      </span>
    </div>
  );
}
