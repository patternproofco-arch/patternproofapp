import { Link } from "@tanstack/react-router";
import { Search, Sparkles, Settings as SettingsIcon, LifeBuoy, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ITEMS = [
  { to: "/search", label: "Search", Icon: Search },
  { to: "/agent", label: "PatternProof Agent", Icon: Sparkles },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
  { to: "/support", label: "Support", Icon: LifeBuoy },
] as const;

/**
 * Account-level tools. Kept out of the five main destinations so the tab bar
 * stays quiet — nothing here is gated or removed, just relocated.
 */
export function UtilityBar() {
  return (
    <div className="no-print flex items-center gap-1">
      {ITEMS.map(({ to, label, Icon }) => (
        <Link
          key={to}
          to={to}
          aria-label={label}
          title={label}
          className="grid h-9 w-9 place-items-center rounded-[2px]"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Icon size={17} strokeWidth={1.75} />
        </Link>
      ))}
      <button
        type="button"
        onClick={() => { void supabase.auth.signOut(); }}
        aria-label="Sign out"
        title="Sign out"
        className="grid h-9 w-9 place-items-center rounded-[2px]"
        style={{ color: "var(--muted-foreground)" }}
      >
        <LogOut size={17} strokeWidth={1.75} />
      </button>
    </div>
  );
}
