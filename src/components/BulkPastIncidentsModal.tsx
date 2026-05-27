import { useState } from "react";
import { X, Loader2, ArrowLeft, Sparkles, Check, Heart, MapPin, CalendarDays, Leaf } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ABUSE_TYPES } from "@/lib/abuse-types";
import { extractMemoryAsIncident } from "@/lib/extract-memory.functions";
import { sanitizeLine } from "@/lib/dates";

type Step = "intro" | "grounding" | "window" | "mode" | "recall" | "season" | "location" | "lifeevents" | "done";
type Mode = "biggest" | "season" | "location" | "lifeevents";

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

const SEASONS = ["Winter", "Spring", "Summer", "Fall"] as const;
const LOCATIONS = ["Kitchen", "Bedroom", "Car", "Work", "His house", "Other"];
const LIFE_ANCHORS = [
  "When a child was born",
  "Around a graduation or new job",
  "When he lost a job or money got tight",
  "When you almost left",
  "Around a custody hearing",
  "The worst time you remember",
];

const MILESTONES: Record<number, string> = {
  3: "Three down. The pattern is starting to show.",
  5: "Five saved. You're building real evidence.",
  10: "Ten incidents. That's a timeline, not a single bad day.",
  20: "Twenty incidents. Take a breath — the rest can wait.",
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function BulkPastIncidentsModal({ open, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const extract = useServerFn(extractMemoryAsIncident);

  const [step, setStep] = useState<Step>("intro");
  const [mode, setMode] = useState<Mode>("biggest");
  const [relStart, setRelStart] = useState("");
  const [relEnd, setRelEnd] = useState(today());
  const [memory, setMemory] = useState("");
  const [promptIdx, setPromptIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<SavedIncident[]>([]);
  const [clarifying, setClarifying] = useState<string | null>(null);
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [seasonYear, setSeasonYear] = useState<number>(new Date().getFullYear());
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);

  if (!open) return null;

  const close = () => {
    setStep("intro");
    setMode("biggest");
    setRelStart("");
    setRelEnd(today());
    setMemory("");
    setPromptIdx(0);
    setSaved([]);
    setClarifying(null);
    setActiveLocation(null);
    setActiveAnchor(null);
    onClose();
  };

  const finishAndClose = () => {
    if (saved.length > 0) onSaved();
    close();
  };

  const currentContext = (): string | undefined => {
    if (mode === "season") return `Context: ${SEASONS[seasonIdx]} ${seasonYear}.`;
    if (mode === "location" && activeLocation) return `Context: incident at "${activeLocation}".`;
    if (mode === "lifeevents" && activeAnchor) return `Context: around the time of "${activeAnchor}".`;
    return undefined;
  };

  const saveMemory = async () => {
    if (!user) return;
    if (!memory.trim()) {
      toast("Write a sentence or two about what happened.");
      return;
    }
    setBusy(true);
    const ctxLine = currentContext();
    const memoryWithCtx = ctxLine ? `${ctxLine}\n\n${memory.trim()}` : memory.trim();
    const r = await extract({
      data: {
        memory: memoryWithCtx,
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
    const locationFromMode = mode === "location" && activeLocation && activeLocation !== "Other" ? activeLocation : null;
    const { error } = await supabase.from("incidents").insert({
      user_id: user.id,
      date,
      time: e.time || null,
      location: sanitizeLine(e.location || locationFromMode || "") || null,
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
    const next = [...saved, { date, description }];
    setSaved(next);
    setClarifying(e.clarifying_question?.trim() ? e.clarifying_question.trim() : null);
    setMemory("");
    if (mode === "biggest") setPromptIdx((i) => (i + 1) % PROMPTS.length);
    const milestone = MILESTONES[next.length];
    toast(milestone || "Saved. Your record is safe.");
  };

  const SavedList = () =>
    saved.length === 0 ? null : (
      <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
        <div className="label-eyebrow mb-2">Saved in this session ({saved.length})</div>
        <ul className="space-y-1.5 text-[13px] max-h-32 overflow-auto">
          {saved.slice(-6).map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-semibold" style={{ color: "var(--accent)" }}>{s.date}</span>
              <span className="line-clamp-1">{s.description}</span>
            </li>
          ))}
        </ul>
      </div>
    );

  const ModeSwitcher = () => (
    <div className="flex flex-wrap gap-2 pt-1">
      <button onClick={() => setStep("mode")} className="btn-ghost text-[12px]">Switch approach</button>
      <button onClick={() => setStep("done")} className="btn-ghost text-[12px]">Stop for now</button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-xl rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-auto" style={{ background: "var(--card)" }}>
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
              <button onClick={() => setStep("grounding")} className="btn-primary">Start</button>
              <button onClick={close} className="btn-ghost">Not now</button>
            </div>
          </div>
        )}

        {step === "grounding" && (
          <div className="space-y-4">
            <button onClick={() => setStep("intro")} className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              <ArrowLeft size={14} /> Back
            </button>
            <div className="flex items-center gap-2">
              <Heart size={18} style={{ color: "var(--accent)" }} />
              <h2 className="font-serif text-[22px]">You're about to recall hard things. That's brave.</h2>
            </div>
            <ul className="space-y-2 text-[14px]" style={{ color: "var(--foreground)" }}>
              <li>• Make sure you're somewhere safe.</li>
              <li>• A trusted person nearby is optional — but allowed.</li>
              <li>• You can pause anytime. There is no deadline.</li>
              <li>• These memories matter. We're just organizing them.</li>
            </ul>
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>Take a breath. Ready?</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={() => setStep("window")} className="btn-primary">Yes, start</button>
              <button onClick={close} className="btn-ghost">I need a break</button>
            </div>
          </div>
        )}

        {step === "window" && (
          <div className="space-y-4">
            <button onClick={() => setStep("grounding")} className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
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
              <button onClick={() => setStep("mode")} className="btn-primary">Continue</button>
            </div>
          </div>
        )}

        {step === "mode" && (
          <div className="space-y-4">
            <h2 className="font-serif text-[22px]">How do you want to remember?</h2>
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Trauma memory doesn't run in order. Pick whichever anchor feels easiest right now — you can switch any time.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => { setMode("biggest"); setStep("recall"); }}
                className="text-left rounded-xl border p-3 hover:bg-black/5"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2 font-semibold"><Sparkles size={14} /> Biggest moments</div>
                <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Start with what you'll never forget.</div>
              </button>
              <button
                onClick={() => { setMode("season"); setSeasonIdx(0); setSeasonYear(new Date().getFullYear()); setStep("season"); }}
                className="text-left rounded-xl border p-3 hover:bg-black/5"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2 font-semibold"><Leaf size={14} /> By season</div>
                <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Walk year by year, season by season.</div>
              </button>
              <button
                onClick={() => { setMode("location"); setActiveLocation(null); setStep("location"); }}
                className="text-left rounded-xl border p-3 hover:bg-black/5"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2 font-semibold"><MapPin size={14} /> By location</div>
                <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Trauma is location-coded. Start at the kitchen.</div>
              </button>
              <button
                onClick={() => { setMode("lifeevents"); setActiveAnchor(null); setStep("lifeevents"); }}
                className="text-left rounded-xl border p-3 hover:bg-black/5"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2 font-semibold"><CalendarDays size={14} /> By life events</div>
                <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Anchor to dates you do remember.</div>
              </button>
            </div>
            <SavedList />
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
            </div>
            <ModeSwitcher />
            <SavedList />
          </div>
        )}

        {step === "season" && (
          <div className="space-y-4">
            <div className="label-eyebrow">By season</div>
            <h2 className="font-serif text-[22px] leading-tight">
              {SEASONS[seasonIdx]} {seasonYear}
            </h2>
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              What happened that {SEASONS[seasonIdx].toLowerCase()}? Take your time. Even small incidents count.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                type="number"
                value={seasonYear}
                onChange={(e) => setSeasonYear(Number(e.target.value) || seasonYear)}
                className="input-pp w-28"
              />
              <div className="flex gap-1">
                {SEASONS.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => setSeasonIdx(i)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] ${i === seasonIdx ? "bg-black/10 font-semibold" : "hover:bg-black/5"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={memory}
              onChange={(e) => setMemory(e.target.value)}
              className="input-pp min-h-[120px]"
              placeholder={`What you remember from ${SEASONS[seasonIdx]} ${seasonYear}…`}
              disabled={busy}
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={saveMemory} disabled={busy} className="btn-primary inline-flex items-center gap-2">
                {busy ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Check size={14} /> Save</>}
              </button>
              <button
                onClick={() => {
                  const ni = (seasonIdx + 1) % 4;
                  setSeasonIdx(ni);
                  if (ni === 0) setSeasonYear((y) => y - 1);
                  setMemory("");
                  setClarifying(null);
                }}
                disabled={busy}
                className="btn-ghost"
              >
                Next season
              </button>
            </div>
            {clarifying && (
              <div className="rounded-xl p-3 text-[13px]" style={{ background: "rgba(106,146,214,0.15)" }}>
                <div className="font-semibold">One quick thing:</div>
                <div>{clarifying}</div>
              </div>
            )}
            <ModeSwitcher />
            <SavedList />
          </div>
        )}

        {step === "location" && (
          <div className="space-y-4">
            <div className="label-eyebrow">By location</div>
            {!activeLocation ? (
              <>
                <h2 className="font-serif text-[22px]">Where did it happen most?</h2>
                <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                  Pick a place. We'll focus there together.
                </p>
                <div className="flex flex-wrap gap-2">
                  {LOCATIONS.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => setActiveLocation(loc)}
                      className="px-3 py-2 rounded-lg border text-[13px] hover:bg-black/5"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <MapPin size={12} className="inline mr-1" />{loc}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="font-serif text-[22px]">Think about every time something happened in the {activeLocation.toLowerCase()}.</h2>
                <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                  Start with what comes first. We'll keep going.
                </p>
                <textarea
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                  className="input-pp min-h-[120px]"
                  placeholder={`What happened in the ${activeLocation.toLowerCase()}…`}
                  disabled={busy}
                />
                <div className="flex flex-wrap gap-2">
                  <button onClick={saveMemory} disabled={busy} className="btn-primary inline-flex items-center gap-2">
                    {busy ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Check size={14} /> Save</>}
                  </button>
                  <button onClick={() => { setActiveLocation(null); setMemory(""); setClarifying(null); }} disabled={busy} className="btn-ghost">
                    Different location
                  </button>
                </div>
                {clarifying && (
                  <div className="rounded-xl p-3 text-[13px]" style={{ background: "rgba(106,146,214,0.15)" }}>
                    <div className="font-semibold">One quick thing:</div>
                    <div>{clarifying}</div>
                  </div>
                )}
              </>
            )}
            <ModeSwitcher />
            <SavedList />
          </div>
        )}

        {step === "lifeevents" && (
          <div className="space-y-4">
            <div className="label-eyebrow">By life events</div>
            {!activeAnchor ? (
              <>
                <h2 className="font-serif text-[22px]">Use dates you do remember.</h2>
                <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                  Pick an anchor. What happened around that time?
                </p>
                <div className="flex flex-col gap-2">
                  {LIFE_ANCHORS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setActiveAnchor(a)}
                      className="text-left px-3 py-2 rounded-lg border text-[13px] hover:bg-black/5"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="font-serif text-[22px] leading-tight">Around "{activeAnchor.toLowerCase()}" — what happened?</h2>
                <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                  Before, during, or just after. Whatever surfaces first.
                </p>
                <textarea
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                  className="input-pp min-h-[120px]"
                  placeholder="What you remember…"
                  disabled={busy}
                />
                <div className="flex flex-wrap gap-2">
                  <button onClick={saveMemory} disabled={busy} className="btn-primary inline-flex items-center gap-2">
                    {busy ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Check size={14} /> Save</>}
                  </button>
                  <button onClick={() => { setActiveAnchor(null); setMemory(""); setClarifying(null); }} disabled={busy} className="btn-ghost">
                    Different anchor
                  </button>
                </div>
                {clarifying && (
                  <div className="rounded-xl p-3 text-[13px]" style={{ background: "rgba(106,146,214,0.15)" }}>
                    <div className="font-semibold">One quick thing:</div>
                    <div>{clarifying}</div>
                  </div>
                )}
              </>
            )}
            <ModeSwitcher />
            <SavedList />
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <h2 className="font-serif text-[22px]">
              {saved.length > 0 ? "Saved. Take a breath." : "That's okay. Come back when you're ready."}
            </h2>
            {saved.length > 0 && (
              <>
                <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
                  You added {saved.length} {saved.length === 1 ? "incident" : "incidents"}. You can edit any of them from your journal — and add more anytime.
                </p>
                <p className="text-[13px]" style={{ color: "var(--foreground)" }}>
                  The pattern is becoming clearer with every entry. That's the story courts need to hear.
                </p>
              </>
            )}
            <div className="flex gap-2">
              <button onClick={finishAndClose} className="btn-primary">Close</button>
              {saved.length > 0 && (
                <button onClick={() => setStep("mode")} className="btn-ghost">Keep going</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}