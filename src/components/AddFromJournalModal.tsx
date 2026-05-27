import { useState } from "react";
import { Sparkles, Upload, X, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ABUSE_TYPES, typeColor, typeLabel } from "@/lib/abuse-types";
import { ocrJournalImage, splitJournalIntoIncidents } from "@/lib/extract-journal-page.functions";
import { sanitizeLine } from "@/lib/dates";

type Step = "upload" | "review-text" | "pick" | "saving";

interface DraftIncident {
  date: string;
  time: string;
  location: string;
  description: string;
  abuse_types: string[];
  witnesses: string;
  emotional_impact: string;
  selected: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

function normalize(raw: unknown): DraftIncident {
  const r = (raw ?? {}) as Record<string, unknown>;
  const types = Array.isArray(r.abuse_types) ? (r.abuse_types as string[]).filter((t) => ABUSE_TYPES.some((a) => a.value === t)) : [];
  return {
    date: typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : today(),
    time: typeof r.time === "string" ? r.time : "",
    location: typeof r.location === "string" ? r.location : "",
    description: typeof r.description === "string" ? r.description : "",
    abuse_types: types.length ? types : ["other"],
    witnesses: typeof r.witnesses === "string" ? r.witnesses : "",
    emotional_impact: typeof r.emotional_impact === "string" ? r.emotional_impact : "",
    selected: true,
  };
}

export function AddFromJournalModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const ocr = useServerFn(ocrJournalImage);
  const split = useServerFn(splitJournalIntoIncidents);
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<DraftIncident[]>([]);

  if (!open) return null;

  const close = () => {
    setStep("upload");
    setText("");
    setDrafts([]);
    setBusy(false);
    onClose();
  };

  const handleUpload = async (f: File | null) => {
    if (!user || !f) return;
    setBusy(true);
    try {
      const ext = f.name.split(".").pop() ?? "bin";
      const key = `${user.id}/journal-page/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
      const up = await supabase.storage.from("evidence-files").upload(key, f);
      if (up.error) { toast("We couldn't read that image. Try another."); return; }
      const signed = await supabase.storage.from("evidence-files").createSignedUrl(key, 600);
      if (!signed.data?.signedUrl) { toast("We couldn't read that image."); return; }
      const r = await ocr({ data: { signedUrl: signed.data.signedUrl, mimeType: f.type || "image/jpeg" } });
      if (!r.ok) { toast("We couldn't read the writing on that page. Try a clearer photo, or type it in below."); setText(""); setStep("review-text"); return; }
      setText(r.text);
      setStep("review-text");
    } finally {
      setBusy(false);
    }
  };

  const extractIncidents = async () => {
    if (!text.trim()) { toast("Add some text first."); return; }
    setBusy(true);
    const r = await split({ data: { text } });
    setBusy(false);
    if (!r.ok || !r.incidents.length) {
      toast("We couldn't break that into incidents. You can edit the text and try again.");
      return;
    }
    setDrafts(r.incidents.map(normalize));
    setStep("pick");
  };

  const toggleDraft = (i: number) => {
    setDrafts((d) => d.map((x, idx) => idx === i ? { ...x, selected: !x.selected } : x));
  };

  const updateDraft = (i: number, patch: Partial<DraftIncident>) => {
    setDrafts((d) => d.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  };

  const toggleType = (i: number, t: string) => {
    setDrafts((d) => d.map((x, idx) => {
      if (idx !== i) return x;
      return { ...x, abuse_types: x.abuse_types.includes(t) ? x.abuse_types.filter((y) => y !== t) : [...x.abuse_types, t] };
    }));
  };

  const saveAll = async () => {
    if (!user) return;
    const selected = drafts.filter((d) => d.selected && d.description.trim());
    if (!selected.length) { toast("Pick at least one incident to save."); return; }
    setStep("saving");
    const rows = selected.map((d) => ({
      user_id: user.id,
      date: d.date,
      time: d.time || null,
      location: sanitizeLine(d.location) || null,
      description: d.description,
      abuse_types: d.abuse_types.length ? d.abuse_types : ["other"],
      witnesses: sanitizeLine(d.witnesses) || null,
      emotional_impact: d.emotional_impact || null,
    }));
    const { error } = await supabase.from("incidents").insert(rows);
    if (error) {
      toast("We couldn't save those. Try again in a moment.");
      setStep("pick");
      return;
    }
    toast(`Saved ${rows.length} ${rows.length === 1 ? "record" : "records"}. Your entries are safe.`);
    onSaved();
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="card-pp max-h-[92vh] w-full max-w-3xl overflow-hidden p-0 sm:rounded-2xl flex flex-col">
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            {step !== "upload" && step !== "saving" && (
              <button onClick={() => setStep(step === "pick" ? "review-text" : "upload")} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Back">
                <ArrowLeft size={16} />
              </button>
            )}
            <Sparkles size={16} style={{ color: "var(--accent)" }} />
            <h2 className="font-serif text-[18px]">Add from journal entry</h2>
          </div>
          <button onClick={close} aria-label="Close" className="rounded-lg p-1.5 hover:bg-black/5"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-[14px]" style={{ color: "var(--foreground)" }}>
                Take a photo of your handwritten journal page or typed notes. We'll read it and help you turn it into clean, separate incident records.
              </p>
              <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                Bad quality? Take another. We just need to read it.
              </p>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:bg-black/5"
                style={{ borderColor: "var(--border)" }}>
                {busy ? <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} /> : <Upload size={28} style={{ color: "var(--accent)" }} />}
                <span className="text-[14px] font-semibold">{busy ? "Reading your page…" : "Upload a photo of your page"}</span>
                <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>JPG, PNG, HEIC, or PDF</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" className="hidden"
                  disabled={busy}
                  onChange={(e) => { const f = e.target.files?.[0] ?? null; e.currentTarget.value = ""; handleUpload(f); }} />
              </label>
              <button
                type="button"
                onClick={() => { setText(""); setStep("review-text"); }}
                className="w-full text-center text-[12px] underline"
                style={{ color: "var(--muted-foreground)" }}
              >
                Or paste / type the entry instead
              </button>
            </div>
          )}

          {step === "review-text" && (
            <div className="space-y-3">
              <div>
                <h3 className="font-serif text-[16px]">Here's what we found</h3>
                <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Edit anything that's wrong — typos, missing words, unclear spots.</p>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={12}
                className="input-pp w-full font-mono text-[13px]"
                placeholder="Your journal entry…"
              />
              <div className="flex justify-end gap-2">
                <button onClick={extractIncidents} disabled={busy || !text.trim()} className="btn-primary">
                  {busy ? "Reading…" : "Find incidents in this entry"}
                </button>
              </div>
            </div>
          )}

          {step === "pick" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-serif text-[16px]">We found {drafts.length} {drafts.length === 1 ? "incident" : "incidents"}</h3>
                <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Check the ones you want to save. Edit any details before saving.</p>
              </div>
              <div className="space-y-3">
                {drafts.map((d, i) => (
                  <div key={i} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: d.selected ? "var(--card)" : "transparent", opacity: d.selected ? 1 : 0.55 }}>
                    <label className="flex cursor-pointer items-start gap-2">
                      <input type="checkbox" checked={d.selected} onChange={() => toggleDraft(i)} className="mt-1" />
                      <div className="flex-1">
                        <div className="text-[12px] font-semibold" style={{ color: "var(--muted-foreground)" }}>Incident {i + 1}</div>
                      </div>
                    </label>
                    {d.selected && (
                      <div className="mt-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="label-eyebrow">Date</label>
                            <input type="date" value={d.date} onChange={(e) => updateDraft(i, { date: e.target.value })} className="input-pp mt-1" />
                          </div>
                          <div>
                            <label className="label-eyebrow">Time</label>
                            <input type="time" value={d.time} onChange={(e) => updateDraft(i, { time: e.target.value })} className="input-pp mt-1" />
                          </div>
                        </div>
                        <div>
                          <label className="label-eyebrow">Location</label>
                          <input type="text" value={d.location} onChange={(e) => updateDraft(i, { location: e.target.value })} className="input-pp mt-1" placeholder="Where it happened" />
                        </div>
                        <div>
                          <label className="label-eyebrow">What happened</label>
                          <textarea value={d.description} onChange={(e) => updateDraft(i, { description: e.target.value })} rows={3} className="input-pp mt-1" />
                        </div>
                        <div>
                          <label className="label-eyebrow">Type</label>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {ABUSE_TYPES.map((t) => {
                              const on = d.abuse_types.includes(t.value);
                              return (
                                <button type="button" key={t.value} onClick={() => toggleType(i, t.value)}
                                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                                  style={{ background: on ? t.color : "transparent", color: on ? "#fff" : "var(--foreground)", border: `1.5px solid ${t.color}` }}>
                                  {t.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                    {!d.selected && (
                      <div className="mt-1 ml-6 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                        {d.date} — {d.description.slice(0, 100)}{d.description.length > 100 ? "…" : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="hidden">{typeLabel("other")}{typeColor("other")}</div>
            </div>
          )}

          {step === "saving" && (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
              <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>Saving your records…</p>
            </div>
          )}
        </div>

        {step === "pick" && (
          <div className="flex items-center justify-between gap-2 border-t px-5 py-3" style={{ borderColor: "var(--border)" }}>
            <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              {drafts.filter((d) => d.selected).length} selected
            </span>
            <button onClick={saveAll} className="btn-primary">Save selected records</button>
          </div>
        )}
      </div>
    </div>
  );
}