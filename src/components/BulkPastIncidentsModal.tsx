import { useState } from "react";
import { X, Loader2, ArrowLeft, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ABUSE_TYPES } from "@/lib/abuse-types";
import { extractMemoryAsIncident } from "@/lib/extract-memory.functions";
import { sanitizeLine } from "@/lib/dates";

type Step = "intro" | "window" | "recall" | "done";

interface SavedIncident {
  date: string;
  description: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const PROMPTS = [
  "What's ONE incident you'll never forget?",
  "What's another one that stands out?",
  "What's the moment you first felt unsafe?",
  "What's something that happened around a holiday or birthday?",
  "What's an incident others witnessed?",
  "What's something that happened at home that still bothers you?",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function BulkPastIncidentsModal({ open, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const extract = useServerFn(extractMemoryAsIncident);

  const [step, setStep] = useState<Step>("intro");
  const [relStart, setRelStart] = useState("");
  const [relEnd, setRelEnd] = useState(today());
  const [memory, setMemory] = useState("");
  const [promptIdx, setPromptIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<SavedIncident[]>([]);
  const [clarifying, setClarifying] = useState<string | null>(null);

  if (!open) return null;

  const close = () => {
    setStep("intro");
    setRelStart("");
    setRelEnd(today());
    setMemory("");
    setPromptIdx(0);
    setSaved([]);
    setClarifying(null);
    onClose();
  };

  const finishAndClose = () => {
    if (saved.length > 0) onSaved();
    close();
  };

  const saveMemory = async () => {
    if (!user) return;
    if (!memory.trim()) {
      toast("Write a sentence or two about what happened.");
      return;
    }
    setBusy(true);
    const r = await extract({
      data: {
        memory: memory.trim(),
        relationshipStart: relStart || undefined,
        relationshipEnd: relEnd || undefined,
      },
    });
    if (!r.ok) {
      setBusy(false);
      toast("We couldn't process that. You can try rephrasing or skip for now.");
      return;
    }
    const e = r.extracted as {
      date?: string;
      time?: string;
      location?: string;
      description?: string;
      abuse_types?: string[];
      witnesses?: string;
      emotional_impact?: string;
      clarifying_question?: string;
    };
    const date = typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : today();
    const types = Array.isArray(e.abuse_types)
      ? e.abuse_types.filter((t) => ABUSE_TYPES.some((a) => a.value === t))
      : [];
    const description = (e.description || memory.trim()).slice(0, 4000);
    const { error } = await supabase.from("incidents").insert({
      user_id: user.id,
      date,
      time: e.time || null,
      location: sanitizeLine(e.location || "") || null,
      description,
      abuse_types: types.length ? types : ["other"],
      witnesses: sanitizeLine(e.witnesses || "") || null,
      emotional_impact: e.emotional_impact || null,
    });
    setBusy(false);
    if (error) {
      toast("We couldn't save that. Try again in a moment.");
      return;
    }
    setSaved((s) => [...s, { date, description }]);
    setClarifying(e.clarifying_question?.trim() ? e.clarifying_question.trim() : null);
    setMemory("");
    setPromptIdx((i) => (i + 1) % PROMPTS.length);
    toast("Saved. Your record is safe.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-xl rounded-2xl p-6 shadow-2xl" style={{ background: "var(--card)" }}>
        <button onClick={close} aria-label="Close" className="absolute right-4 top-4 rounded-lg p-2 hover:bg-black/5">
          <X size={18} />
        </button>

        {step === "intro" && (
          <div className="space-y-5">
            <div className="label-eyebrow">Past incidents</div>
            <h2 className="font-serif text-[26px] leading-tight">
              You have memories scattered<br /><em>across years.</em>
            </h2>
            <p className="text-[14px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              We'll help you organize them — no pressure to be perfect.
              <br /><br />
              This will take time. You can do it all at once or come back anytime.
              <br /><br />
              Start with what you remember best, not what happened first. Your brain will fill in the rest as you go.
            </p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep("window")} className="btn-primary">Start</button>
              <button onClick={close} className="btn-ghost">Not now</button>
            </div>
          </div>
        )}

        {step === "window" && (
          <div className="space-y-4">
            <button onClick={() => setStep("intro")} className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              <ArrowLeft size={14} /> Back
            </button>
            <h2 className="font-serif text-[22px]">Before we start, let me help jog your memory.</h2>
            <div>
              <label className="label-eyebrow">When did the relationship start?</label>
              <input type="date" value={relStart} onChange={(e) => setRelStart(e.target.value)} className="input-pp mt-1" />
            </div>
            <div>
              <label className="label-eyebrow">When did you leave, or when is "now"?</label>
              <input type="date" value={relEnd} onChange={(e) => setRelEnd(e.target.value)} className="input-pp mt-1" />
            </div>
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Think about that span. We'll start with the biggest moments — the ones that come to mind without trying.
            </p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep("recall")} className="btn-primary">Continue</button>
            </div>
          </div>
        )}

        {step === "recall" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="label-eyebrow">Memory {saved.length + 1}</div>
              <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                {saved.length} saved
              </div>
            </div>
            <h2 className="font-serif text-[22px] leading-tight">{PROMPTS[promptIdx]}</h2>

            {clarifying && (
              <div className="rounded-xl p-3 text-[13px]" style={{ background: "rgba(106,146,214,0.15)" }}>
                <div className="flex items-start gap-2">
                  <Sparkles size={14} className="mt-0.5" style={{ color: "var(--accent)" }} />
                  <div>
                    <div className="font-semibold">One quick thing:</div>
                    <div>{clarifying}</div>
                    <div className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                      You can edit this incident later from the journal — or include the answer in your next memory.
                    </div>
                  </div>
                </div>
              </div>
            )}

            <textarea
              value={memory}
              onChange={(e) => setMemory(e.target.value)}
              className="input-pp min-h-[140px]"
              placeholder="In your own words. Don't worry about the exact date — describe what you remember and we'll structure it."
              disabled={busy}
            />

            <div className="flex flex-wrap gap-2">
              <button onClick={saveMemory} disabled={busy} className="btn-primary inline-flex items-center gap-2">
                {busy ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Check size={14} /> Save this memory</>}
              </button>
              <button onClick={() => { setMemory(""); setClarifying(null); setPromptIdx((i) => (i + 1) % PROMPTS.length); }} disabled={busy} className="btn-ghost">
                Different prompt
              </button>
              <button onClick={() => setStep("done")} disabled={busy} className="btn-ghost">
                Stop for now
              </button>
            </div>

            {saved.length > 0 && (
              <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                <div className="label-eyebrow mb-2">Saved in this session</div>
                <ul className="space-y-1.5 text-[13px]">
                  {saved.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-semibold" style={{ color: "var(--accent)" }}>{s.date}</span>
                      <span className="line-clamp-1">{s.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <h2 className="font-serif text-[22px]">
              {saved.length > 0 ? "Saved. Take a breath." : "That's okay. Come back when you're ready."}
            </h2>
            {saved.length > 0 && (
              <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
                You added {saved.length} {saved.length === 1 ? "incident" : "incidents"}. You can edit any of them from your journal — and add more anytime.
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={finishAndClose} className="btn-primary">Close</button>
              {saved.length > 0 && (
                <button onClick={() => setStep("recall")} className="btn-ghost">Keep going</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}