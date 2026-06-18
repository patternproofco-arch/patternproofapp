import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { X, Scale, FileText, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const KEY = "pp-first-time-education-v1";
const HEADER_BG = "var(--panel)";
const WHITE = "#FFFFFF";

export function FirstTimeEducationModal() {
  const { user } = useAuth();
  const userId = user?.id;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    // Don't intrude during the onboarding flow
    if (pathname.startsWith("/onboarding")) return;
    if (localStorage.getItem(KEY)) return;
    // Small delay so dashboard paints first
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [userId, pathname]);

  const dismiss = () => {
    localStorage.setItem(KEY, new Date().toISOString());
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto px-4 py-8"
      style={{ background: "rgba(31,26,20,0.65)" }}
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl"
        style={{ background: "var(--card)", boxShadow: "0 30px 80px -20px rgba(31,26,20,0.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-full p-2"
          style={{ background: "rgba(255,252,241,0.15)", color: WHITE }}
        >
          <X size={18} />
        </button>

        {/* Warm dark header */}
        <div className="px-8 py-8 md:px-10 md:py-10" style={{ background: HEADER_BG, color: WHITE }}>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[3px]" style={{ color: "rgba(255,255,255,0.75)" }}>
            <Scale size={14} /> Welcome to P4TTERN PR00F
          </div>
          <h2 className="text-[26px] font-bold md:text-[30px]" style={{ letterSpacing: "-0.01em", color: WHITE }}>
            You're building a legal record. Here's how it works.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "rgba(255,255,255,0.92)" }}>
            This isn't a journal. Every entry, photo, and voice memo you add becomes potential evidence — organized, timestamped, and court-ready.
          </p>
        </div>

        {/* Three steps */}
        <div className="space-y-5 px-8 py-8 md:px-10">
          <Step n={1} icon={FileText} title="Document as it happens">
            Log incidents, upload screenshots, record voice memos. Be specific — dates, times, exact words. Vague entries weaken strong cases.
          </Step>
          <Step n={2} icon={Sparkles} title="Let patterns surface">
            Once you have a handful of entries, Pattern Analysis maps the behavior over time — frequency, escalation, recurring tactics. This is what courts read.
          </Step>
          <Step n={3} icon={Scale} title="Export when you need it">
            Court packets, attorney shares, and full evidence ZIPs — built from what you've documented, formatted for the court system you're walking into.
          </Step>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center rounded-xl px-5 py-2.5 text-[15px] font-bold transition-transform hover:-translate-y-px"
              style={{ background: "var(--panel)", color: WHITE, boxShadow: "0 8px 20px -8px rgba(31,26,20,0.4)" }}
            >
              Start documenting
            </button>
            <Link
              to="/court-systems"
              onClick={dismiss}
              className="text-[14px] font-bold underline-offset-4 hover:underline"
              style={{ color: "var(--panel)" }}
            >
              Learn how courts evaluate evidence →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, icon: Icon, title, children }: { n: number; icon: typeof FileText; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-[14px] font-bold"
        style={{ background: "rgba(47,38,28,0.08)", color: "var(--panel)" }}
      >
        {n}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color: "var(--panel)" }} />
          <h3 className="text-[16px] font-bold" style={{ color: "var(--foreground)" }}>{title}</h3>
        </div>
        <p className="mt-1 text-[15px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{children}</p>
      </div>
    </div>
  );
}