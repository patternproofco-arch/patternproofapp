import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { IncidentLite } from "@/components/IncidentCard";
import { WhyCourtsStruggleModal } from "@/components/WhyCourtsStruggleModal";
import { FirstTimeEducationModal } from "@/components/FirstTimeEducationModal";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

interface LatestPattern { summary: string; createdAt: string }

type NextStepKey = "incident" | "evidence" | "voice" | "case";

interface StepDef {
  key: NextStepKey;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  to: "/journal" | "/evidence" | "/voice-notes" | "/case-builder";
}

const STEPS: StepDef[] = [
  {
    key: "incident",
    eyebrow: "Your next step",
    title: "Log your first incident",
    body: "Start small. A simple note about today can be the foundation for your protection later. Your words are encrypted and yours alone.",
    cta: "Begin logging",
    to: "/journal",
  },
  {
    key: "evidence",
    eyebrow: "Your next step",
    title: "Add a piece of evidence",
    body: "A screenshot, message, photo, or document. Anything that helps tell the story. Take it at your pace.",
    cta: "Upload evidence",
    to: "/evidence",
  },
  {
    key: "voice",
    eyebrow: "Your next step",
    title: "Record a voice note",
    body: "Sometimes it's easier to speak than to write. Your recordings stay private and encrypted.",
    cta: "Record a note",
    to: "/voice-notes",
  },
  {
    key: "case",
    eyebrow: "Your next step",
    title: "Shape your case",
    body: "Pull your records together into something a court can read. There's no rush — only when you're ready.",
    cta: "Open case builder",
    to: "/case-builder",
  },
];

function Dashboard() {
  const { user } = useAuth();
  const [counts, setCounts] = useState({ incidents: 0, evidence: 0, voiceNotes: 0, months: 0 });
  const [hasCase, setHasCase] = useState(false);
  const [pattern, setPattern] = useState<LatestPattern | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [recent, allInc, ev, vn, caseRow, pat] = await Promise.all([
        supabase.from("incidents").select("id,date,abuse_types,description,location").eq("user_id", user.id).order("date", { ascending: false }).limit(3),
        supabase.from("incidents").select("date", { count: "exact" }).eq("user_id", user.id).order("date", { ascending: true }).limit(1),
        supabase.from("evidence").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("voice_notes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("cases").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("pattern_analyses").select("analysis,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
      ]);
      // recent is fetched but no longer rendered; keep query for warm-cache parity
      void (recent.data as IncidentLite[] | null);
      const earliestDate = allInc.data?.[0]?.date ?? null;
      setHasCase((caseRow.count ?? 0) > 0);
      const patRow = pat.data?.[0] as { analysis: { pattern_summary?: string }; created_at: string } | undefined;
      if (patRow?.analysis?.pattern_summary) {
        setPattern({ summary: patRow.analysis.pattern_summary, createdAt: patRow.created_at });
      }
      const months = earliestDate
        ? Math.max(1, Math.round((Date.now() - new Date(earliestDate).getTime()) / (1000 * 60 * 60 * 24 * 30)))
        : 0;
      setCounts({ incidents: allInc.count ?? 0, evidence: ev.count ?? 0, voiceNotes: vn.count ?? 0, months });
      setLoaded(true);
    })();
  }, [user]);

  // Pick the single next step (one focal action at a time).
  const completed: Record<NextStepKey, boolean> = {
    incident: counts.incidents > 0,
    evidence: counts.evidence > 0,
    voice: counts.voiceNotes > 0,
    case: hasCase,
  };
  const doneCount = Object.values(completed).filter(Boolean).length;
  const nextStep = STEPS.find((s) => !completed[s.key]) ?? STEPS[STEPS.length - 1];

  return (
    <div className="min-h-[calc(100vh-5rem)]">
      <WhyCourtsStruggleModal />
      <FirstTimeEducationModal />

      <div
        className="flex flex-col lg:flex-row"
        style={{ opacity: loaded ? 1 : 0, transition: "opacity 600ms ease" }}
      >
        {/* Left: focal Next Step */}
        <section className="flex flex-1 flex-col justify-center px-6 py-10 md:px-12 lg:w-[58%] lg:px-20 lg:py-16">
          <header className="mb-10 max-w-xl">
            <h1 className="font-serif text-[36px] leading-[1.15] md:text-[44px]">
              You're building your case,
              <br />
              <em>one record at a time.</em>
            </h1>
            <p className="mt-4 italic" style={{ color: "var(--primary)", fontFamily: "var(--font-display)" }}>
              Deep breaths. You are in a safe space.
            </p>
          </header>

          <ProgressDots done={doneCount} total={STEPS.length} />

          <NextStepCard step={nextStep} />

          <div className="mt-5 text-[10px]" style={{ color: "var(--muted-foreground)", letterSpacing: "0.22em", textTransform: "uppercase" }}>
            {doneCount} of {STEPS.length} steps completed
          </div>
        </section>

        {/* Right: quiet atmosphere — stats + pattern prompt */}
        <aside
          className="flex flex-1 flex-col justify-center px-6 py-10 md:px-12 lg:w-[42%] lg:px-20 lg:py-16"
          style={{ background: "rgba(228, 220, 204, 0.38)", borderLeft: "1px solid var(--border)" }}
        >
          <div className="max-w-sm space-y-12">
            <div className="grid grid-cols-2 gap-y-10 gap-x-8">
              <Stat value={counts.incidents} label="Incidents" />
              <Stat value={counts.evidence} label="Evidence" />
              <Stat value={counts.voiceNotes} label="Voice notes" />
              <Stat value={counts.months} label={counts.months === 1 ? "Month secured" : "Months secured"} />
            </div>

            <PatternPanel pattern={pattern} incidentCount={counts.incidents} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-serif text-[34px] leading-none" style={{ color: "var(--foreground)" }}>{value}</div>
      <div className="mt-2 text-[10px]" style={{ color: "var(--muted-foreground)", letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

function ProgressDots({ done, total }: { done: number; total: number }) {
  // Show next step dot in primary too, so the active step glows softly.
  const activeIndex = Math.min(done, total - 1);
  return (
    <div className="mb-5 flex items-center gap-2.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="block h-2 w-2 rounded-full transition-colors"
          style={{ background: i <= activeIndex ? "var(--primary)" : "var(--linen)" }}
        />
      ))}
    </div>
  );
}

function NextStepCard({ step }: { step: StepDef }) {
  return (
    <Link
      to={step.to}
      className="group block max-w-xl rounded-3xl transition-all duration-500 hover:-translate-y-0.5"
      style={{
        background: "var(--linen)",
        padding: "40px",
        border: "1px solid rgba(42, 37, 32, 0.05)",
        boxShadow: "0 30px 60px -30px rgba(42, 37, 32, 0.18), 0 12px 32px -16px rgba(42, 37, 32, 0.08)",
      }}
    >
      <span className="label-eyebrow" style={{ color: "var(--primary)" }}>{step.eyebrow}</span>
      <h2 className="mt-4 font-serif text-[28px] leading-tight">{step.title}</h2>
      <p className="mt-5 text-[15px] leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.78 }}>
        {step.body}
      </p>
      <span
        className="btn-primary mt-8 inline-flex items-center gap-2 text-[14px]"
      >
        {step.cta} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function PatternPanel({ pattern, incidentCount }: { pattern: LatestPattern | null; incidentCount: number }) {
  if (pattern) {
    return (
      <div
        className="rounded-2xl p-7"
        style={{ background: "var(--background)", border: "1px solid var(--border)" }}
      >
        <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "rgba(122,148,121,0.14)" }}>
          <Sparkles size={14} style={{ color: "var(--primary)" }} />
        </div>
        <h3 className="font-serif text-[18px]">Latest pattern</h3>
        <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          {pattern.summary}
        </p>
        <Link to="/patterns" className="mt-4 inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--primary)", fontWeight: 500 }}>
          Open analysis <ArrowRight size={13} className="inline" />
        </Link>
      </div>
    );
  }
  return (
    <div
      className="rounded-2xl p-7"
      style={{ background: "var(--background)", border: "1px solid var(--border)" }}
    >
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "rgba(122,148,121,0.14)" }}>
        <Sparkles size={14} style={{ color: "var(--primary)" }} />
      </div>
      <h3 className="font-serif text-[18px]">Pattern analysis</h3>
      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
        {incidentCount < 2
          ? "Once you have a few entries, we'll begin gently surfacing patterns and escalation markers."
          : "Ready to see what your records reveal?"}
      </p>
    </div>
  );
}