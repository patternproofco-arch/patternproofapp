import { Link } from "@tanstack/react-router";
import { CircleHelp, Settings } from "lucide-react";

/** At most two 44x44 header buttons: Help and Settings. */
export function HeaderTools() {
  return (
    <div className="pp-header-tools flex min-w-0 items-center">
      {/* Help opens Help & resources (Resources left the bottom nav). */}
      <Link
        to="/resources"
        aria-label="Help"
        title="Help & resources"
        className="grid h-11 w-11 place-items-center rounded-2xl"
        style={{ color: "var(--ink)" }}
      >
        <CircleHelp size={22} strokeWidth={1.5} />
      </Link>
      <Link
        to="/settings"
        aria-label="Settings"
        title="Settings"
        className="grid h-11 w-11 place-items-center rounded-2xl"
        style={{ color: "var(--ink)" }}
      >
        <Settings size={22} strokeWidth={1.5} />
      </Link>
    </div>
  );
}
