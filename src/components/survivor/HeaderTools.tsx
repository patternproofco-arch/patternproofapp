import { Link, useNavigate } from "@tanstack/react-router";
import { CircleHelp, Settings } from "lucide-react";
import { useSettings } from "@/lib/settings-context";
import { OPEN_GUIDE_EVENT } from "@/components/survivor/GuideHelper";

/** At most two 44x44 header buttons: Help and Settings. */
export function HeaderTools() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  return (
    <div className="pp-header-tools flex min-w-0 items-center">
      <button
        type="button"
        aria-label="Help"
        title="Help"
        className="grid h-11 w-11 place-items-center rounded-2xl"
        style={{ color: "var(--ink)" }}
        onClick={() => {
          // The Guide is opt-in; without it, Help opens the support page.
          if (settings.guideEnabled) window.dispatchEvent(new Event(OPEN_GUIDE_EVENT));
          else void navigate({ to: "/support" });
        }}
      >
        <CircleHelp size={22} strokeWidth={1.5} />
      </button>
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
