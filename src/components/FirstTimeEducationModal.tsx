import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, Scale, FileText, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const KEY = "pp-first-time-education-v1";
const NAVY = "#1a2332";
const CREAM = "#F5F1E6";

export function FirstTimeEducationModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    if (localStorage.getItem(KEY)) return;
    // Small delay so dashboard paints first
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [user]);

  const dismiss = () => {
    localStorage.setItem(KEY, new Date().toISOString());
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto px-4 py-8"
      style={{ background: "rgba(26,35,50,0.65)" }}
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl"
        style={{ background: "var(--background)", boxShadow: "0 30px 80px -20px rgba(26,35,50,0.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-full p-2"
          style={{ background: "rgba(245,241,230,0.15)", color: CREAM }}
        >
          <X size={16} />
        </button>

        {/* Navy header */}
        <div className="px-8 py-8 md:px-10 md:py-10" style={{ background: NAVY, color: CREAM }}>
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[3px]" style={{ opacity: 0.65 }}>
            <Scale size={12} /> Welcome to Pattern-Proof
          </div>
          <h2 className="text-2xl font-semibold md:text-[28px]" style={{ letterSpacing: "-0.01em" }}>
            You're building a legal record. Here's how it works.
          </h2>
          <p className="mt-2 text-[14px]" style={{ opacity: 0.85 }}>
            This isn't a journal. Every entry, photo, and voice memo you add becomes potential evidence — organized, timestamped, and court-ready.
          </p>
        </div>

        {/* Three steps */}
        <div className="space-y-4 px-8 py-8 md:px-10">
          <Step n={1} icon={FileText} title="Document as it happens">
            Log incidents, upload screenshots, record voice memos. Be specific — dates, times, exact words. Vague entries weaken strong cases.
          </Step>
          <Step n={2} icon={Sparkles} title="Let patterns surface">
            Once you have a handful of entries, Pattern Analysis maps the behavior over time — frequency, escalation, recurring tactics. This is what courts read.
          </Step>
          <Step n={3} icon={Scale} title="Export when you need it">
            Court packets, attorney shares, and full evidence ZIPs — built from what you've documented, formatted for the court system you're walking into.
          </Step>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center rounded-xl px-5 py-2.5 text-[14px] font-semibold transition-transform hover:-translate-y-px"
              style={{ background: NAVY, color: CREAM, boxShadow: "0 8px 20px -8px rgba(26,35,50,0.4)" }}
            >
              Start documenting
            </button>
            <Link
              to="/court-systems"
              onClick={dismiss}
              className="text-[13px] font-semibold underline-offset-4 hover:underline"
              style={{ color: NAVY }}
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
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[13px] font-bold"
        style={{ background: `${NAVY}10`, color: NAVY }}
      >
        {n}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color: NAVY }} />
          <h3 className="text-[15px] font-semibold" style={{ color: NAVY }}>{title}</h3>
        </div>
        <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{children}</p>
      </div>
    </div>
  );
}