import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useSettings } from "@/lib/settings-context";

export function QuickExitButton() {
  const { settings } = useSettings();
  const lastEsc = useRef(0);

  const exit = () => {
    const url = settings.exitUrl || "https://weather.com";
    try {
      window.history.replaceState(null, "", "/");
    } catch {
      /* ignore */
    }
    window.location.replace(url);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const now = Date.now();
        if (now - lastEsc.current < 500) exit();
        lastEsc.current = now;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.exitUrl]);

  return (
    <button
      onClick={exit}
      aria-label="Quick exit"
      title="Quick exit — double-press Esc"
      className="no-print fixed right-4 top-4 z-[9999] inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-all hover:scale-105"
      style={{
        background: "var(--sidebar)",
        color: "var(--sidebar-active)",
        boxShadow: "0 4px 14px rgba(31,26,20,0.18)",
        letterSpacing: "0.04em",
      }}
    >
      <span>Leave</span>
      <X size={14} strokeWidth={2.5} />
    </button>
  );
}