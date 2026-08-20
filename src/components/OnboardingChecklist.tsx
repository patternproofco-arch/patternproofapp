import { Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";

export interface ChecklistCounts {
  incidents: number;
  evidence: number;
  voiceNotes: number;
  hasCase: boolean;
}

type Step = {
  done: boolean;
  title: string;
  body: string;
  to: "/journal" | "/evidence" | "/voice-notes" | "/case-builder";
};

export function OnboardingChecklist({ counts }: { counts: ChecklistCounts }) {
  const steps: Step[] = [
    {
      done: counts.incidents > 0,
      title: "Log your first incident",
      body: "Whatever happened, in your own words.",
      to: "/journal",
    },
    {
      done: counts.evidence > 0,
      title: "Upload a piece of evidence",
      body: "A screenshot, photo, message, or document.",
      to: "/evidence",
    },
    {
      done: counts.voiceNotes > 0,
      title: "Record a voice note",
      body: "Sometimes it's easier to speak than to write.",
      to: "/voice-notes",
    },
    {
      done: counts.hasCase,
      title: "Shape your case",
      body: "Pull your records together when you're ready.",
      to: "/case-builder",
    },
  ];

  return (
    <div className="card-pp">
      <div className="label-eyebrow">Where to start</div>
      <h2 className="mt-2 font-serif text-[22px]">A gentle path forward.</h2>
      <p className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        Take it at your pace. Every step matters.
      </p>
      <ol className="mt-5 space-y-3">
        {steps.map((s) => (
          <li key={s.to}>
            <Link
              to={s.to}
              className="flex items-center gap-4 p-3 transition-shadow"
              style={{
                borderRadius: "var(--pp-r-lg)",
                background: "var(--pp-card)",
                boxShadow: s.done ? "var(--pp-shadow-in-sm)" : "var(--pp-shadow-sm)",
              }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: s.done ? "var(--accent)" : "var(--pp-card)",
                  boxShadow: s.done ? "none" : "var(--pp-shadow-in-sm)",
                  color: s.done ? "var(--pp-accent-fg)" : "var(--foreground)",
                }}
              >
                {s.done && <Check size={15} />}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="font-serif text-[15px]"
                  style={{
                    textDecoration: s.done ? "line-through" : "none",
                    opacity: s.done ? 0.6 : 1,
                  }}
                >
                  {s.title}
                </div>
                <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  {s.body}
                </div>
              </div>
              <span
                className="text-[12px] font-semibold whitespace-nowrap"
                style={{ color: "var(--accent)" }}
              >
                {s.done ? "Done" : "Start"} <ArrowRight size={12} className="inline" />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
