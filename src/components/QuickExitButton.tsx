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
      title="Quick exit"
      className="no-print fixed right-3 top-3 z-[9999] rounded-full p-2 transition-colors hover:bg-black/10"
      style={{ color: "#B57E60" }}
    >
      <X size={20} strokeWidth={2.5} />
    </button>
  );
}