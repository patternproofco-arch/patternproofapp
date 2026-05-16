import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, Lock } from "lucide-react";
import { useRecording } from "@/lib/recording-context";
import { useSettings } from "@/lib/settings-context";
import { toast } from "sonner";

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function FloatingRecordButton() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { settings, update } = useSettings();
  const { isRecording, elapsed, start, stop } = useRecording();
  const [menuOpen, setMenuOpen] = useState(false);
  const longPress = useRef<number | undefined>(undefined);
  const fired = useRef(false);

  // Hide on routes where button shouldn't render
  const hideOnRoutes = pathname === "/onboarding" || pathname.startsWith("/login") || pathname.startsWith("/attorney/");

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.("[data-record-menu]") && !t.closest?.("[data-record-btn]")) setMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("touchstart", close);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("touchstart", close); };
  }, [menuOpen]);

  if (hideOnRoutes || !settings.quickRecordVisible) return null;

  const onPointerDown = () => {
    fired.current = false;
    if (isRecording) return;
    longPress.current = window.setTimeout(() => {
      fired.current = true;
      setMenuOpen(true);
    }, 1000);
  };
  const onPointerUp = () => {
    if (longPress.current) { clearTimeout(longPress.current); longPress.current = undefined; }
  };
  const onPointerLeave = onPointerUp;

  const handleClick = async () => {
    if (fired.current) { fired.current = false; return; }
    if (settings.quickRecordFrozen) return;
    if (isRecording) {
      await stop();
      // already on /live-recording page; it will pick up pending
      if (!pathname.startsWith("/live-recording")) navigate({ to: "/live-recording" });
      return;
    }
    const ok = await start();
    if (!ok) { toast("We couldn't access the microphone."); return; }
    if (!pathname.startsWith("/live-recording")) navigate({ to: "/live-recording" });
  };

  const frozen = settings.quickRecordFrozen;
  const bg = frozen ? "#B57E60" : isRecording ? "#C4674A" : "#E77B56";

  return (
    <>
      {/* Elapsed timer above button while recording */}
      {isRecording && (
        <div
          className="no-print fixed z-[95] hidden rounded-full px-3 py-1 text-[12px] font-semibold md:block"
          style={{
            background: "#4E3B31",
            color: "#F5E6DF",
            left: "16px",
            bottom: "84px",
          }}
        >
          {fmt(elapsed)}
        </div>
      )}

      {/* Mobile: timer centered above mobile button */}
      {isRecording && (
        <div
          className="no-print fixed z-[95] rounded-full px-3 py-1 text-[12px] font-semibold md:hidden"
          style={{
            background: "#4E3B31",
            color: "#F5E6DF",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: "140px",
          }}
        >
          {fmt(elapsed)}
        </div>
      )}

      {/* Long-press menu */}
      {menuOpen && (
        <div
          data-record-menu
          className="no-print fixed z-[96] w-[180px] rounded-2xl p-2"
          style={{
            background: "#DEB896",
            border: "1px solid rgba(78,59,49,0.2)",
            boxShadow: "0 6px 20px rgba(78,59,49,0.18)",
            left: "16px",
            bottom: "84px",
          }}
        >
          <button
            onClick={() => { update({ quickRecordFrozen: !frozen }); setMenuOpen(false); }}
            className="block w-full rounded-lg px-3 py-2 text-left text-[13px]"
            style={{ color: "#2A1A10" }}
          >
            {frozen ? "Unfreeze" : "Freeze"}
          </button>
          <button
            onClick={() => { update({ quickRecordVisible: false }); setMenuOpen(false); toast("Quick record button hidden. Turn it back on in Settings."); }}
            className="block w-full rounded-lg px-3 py-2 text-left text-[13px]"
            style={{ color: "#2A1A10" }}
          >
            Hide
          </button>
          <button
            onClick={() => setMenuOpen(false)}
            className="block w-full rounded-lg px-3 py-2 text-left text-[13px]"
            style={{ color: "#6B3520" }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* The button — desktop bottom-left, mobile centered above tab bar */}
      <button
        data-record-btn
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        onMouseDown={onPointerDown}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerLeave}
        onTouchStart={onPointerDown}
        onTouchEnd={onPointerUp}
        onClick={handleClick}
        className={`no-print fixed z-[94] flex h-14 w-14 items-center justify-center rounded-full ${isRecording ? "pulse-rec" : ""}`}
        style={{
          background: bg,
          color: "#fff",
          left: "16px",
          bottom: "16px",
          boxShadow: "0 4px 14px rgba(78,59,49,0.25)",
        }}
      >
        <Mic size={22} />
        {frozen && (
          <span
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: "#4E3B31", color: "#F5E6DF" }}
          >
            <Lock size={11} />
          </span>
        )}
      </button>

      {/* Mobile reposition override */}
      <style>{`
        @media (max-width: 767px) {
          [data-record-btn] {
            left: 50% !important;
            transform: translateX(-50%);
            bottom: 80px !important;
          }
          [data-record-menu] {
            left: 50% !important;
            transform: translateX(-50%);
            bottom: 150px !important;
          }
        }
      `}</style>
    </>
  );
}