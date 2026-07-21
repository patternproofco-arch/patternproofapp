import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, Sparkles, BookOpen, Clock, ChevronDown, PenLine, List } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ABUSE_TYPES, typeColor, typeLabel } from "@/lib/abuse-types";
import { IncidentCard, type IncidentLite } from "@/components/IncidentCard";
import { useServerFn } from "@tanstack/react-start";
import { extractIncidentFromImage } from "@/lib/extract-incident.functions";
import { sanitizeLine } from "@/lib/dates";
import { AddFromJournalModal } from "@/components/AddFromJournalModal";
import { BulkPastIncidentsModal } from "@/components/BulkPastIncidentsModal";
import { CognitiveClose } from "@/components/CognitiveClose";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface FullIncident extends IncidentLite {
  time: string | null;
  witnesses: string | null;
  emotional_impact: string | null;
  source?: string | null;
  confirmed_at?: string | null;
}

export const Route = createFileRoute("/_authenticated/journal")({
  component: JournalPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function JournalPage() {
  const { user } = useAuth();
  const extractIncident = useServerFn(extractIncidentFromImage);
  const [list, setList] = useState<FullIncident[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiFilled, setAiFilled] = useState(false);
  const [form, setForm] = useState({
    date: today(),
    time: "",
    location: "",
    description: "",
    abuse_types: [] as string[],
    witnesses: "",
    emotional_impact: "",
  });
  const [busy, setBusy] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("incidents")
      .select("id,date,time,location,description,abuse_types,witnesses,emotional_impact,source,confirmed_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("date", { ascending: false });
    setList((data as FullIncident[] | null) ?? []);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const reset = () => {
    setForm({ date: today(), time: "", location: "", description: "", abuse_types: [], witnesses: "", emotional_impact: "" });
    setEditingId(null);
    setAiFilled(false);
  };

  const toggleType = (t: string) => {
    setForm((f) => ({ ...f, abuse_types: f.abuse_types.includes(t) ? f.abuse_types.filter((x) => x !== t) : [...f.abuse_types, t] }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.description.trim() || form.abuse_types.length === 0) {
      toast("Add a description and at least one type.");
      return;
    }
    setBusy(true);
    const payload = {
      user_id: user.id,
      date: form.date,
      time: form.time || null,
      location: sanitizeLine(form.location) || null,
      description: form.description,
      abuse_types: form.abuse_types,
      witnesses: sanitizeLine(form.witnesses) || null,
      emotional_impact: form.emotional_impact || null,
    };
    const insertPayload = aiFilled
      ? { ...payload, source: "ai_extracted" as const, confirmed_at: null }
      : { ...payload, source: "survivor" as const, confirmed_at: new Date().toISOString() };
    const { error } = editingId
      ? await supabase.from("incidents").update(payload).eq("id", editingId).eq("user_id", user.id)
      : await supabase.from("incidents").insert(insertPayload);
    setBusy(false);
    if (error) { toast("We couldn't save that. Try again in a moment."); return; }
    toast("Saved. Your record is safe.");
    reset();
    load();
  };

  const edit = (i: FullIncident) => {
    setEditingId(i.id);
    setLogOpen(true);
    setForm({
      date: i.date,
      time: i.time ?? "",
      location: i.location ?? "",
      description: i.description,
      abuse_types: i.abuse_types,
      witnesses: i.witnesses ?? "",
      emotional_impact: i.emotional_impact ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = (id: string) => {
    setConfirmDelete(id);
  };

  const doRemove = async () => {
    if (!user || !confirmDelete) return;
    const id = confirmDelete;
    setConfirmDelete(null);
    const { error } = await supabase
      .from("incidents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) { toast("We couldn't remove that. Try again in a moment."); return; }
    // Optimistically hide
    setList((prev) => prev.filter((i) => i.id !== id));
    toast("Removed.", {
      action: {
        label: "Undo",
        onClick: async () => {
          await supabase.from("incidents").update({ deleted_at: null }).eq("id", id).eq("user_id", user.id);
          load();
        },
      },
      duration: 8000,
    });
  };

  const confirmRecord = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("incidents")
      .update({ confirmed_at: new Date().toISOString(), source: "survivor" })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) { toast("We couldn't confirm that. Try again in a moment."); return; }
    toast("Confirmed.");
    load();
  };

  const autofillFromImage = async (f: File | null) => {
    if (!user || !f) return;
    setAiBusy(true);
    const ext = f.name.split(".").pop() ?? "bin";
    const key = `${user.id}/journal-ai/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const up = await supabase.storage.from("evidence-files").upload(key, f);
    if (up.error) { setAiBusy(false); toast("We couldn't read that image. Try another."); return; }
    const signed = await supabase.storage.from("evidence-files").createSignedUrl(key, 600);
    if (!signed.data?.signedUrl) { setAiBusy(false); toast("We couldn't read that image."); return; }
    const r = await extractIncident({ data: { signedUrl: signed.data.signedUrl, mimeType: f.type || "image/png" } });
    setAiBusy(false);
    if (!r.ok) { toast("We couldn't pull details from that image. You can still type it out."); return; }
    const e = r.extracted as Partial<typeof form> & { abuse_types?: string[] };
    setForm((prev) => ({
      date: e.date || prev.date,
      time: e.time || prev.time,
      location: e.location || prev.location,
      description: e.description || prev.description,
      abuse_types: Array.isArray(e.abuse_types) && e.abuse_types.length ? e.abuse_types : prev.abuse_types,
      witnesses: e.witnesses || prev.witnesses,
      emotional_impact: e.emotional_impact || prev.emotional_impact,
    }));
    setAiFilled(true);
    toast("Filled in what I could. Please review every field before saving.");
  };

  return (
    <div>
      <div className="label-eyebrow">Your journal</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Log what happened.
        <br />
        <em>In your own words.</em>
      </h1>

      <div className="mt-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setJournalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition-colors hover:brightness-95"
            style={{ background: "#ECE6DB", color: "#3D3832", border: "1px solid rgba(42,37,32,0.08)" }}
          >
            <BookOpen size={15} />
            Add from Journal Entry
          </button>
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition-colors hover:brightness-95"
            style={{ background: "#ECE6DB", color: "#3D3832", border: "1px solid rgba(42,37,32,0.08)" }}
          >
            <Clock size={15} />
            Add Multiple Past Incidents
          </button>
        </div>
        <p className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          Upload a journal page, or recall older incidents one memory at a time.
        </p>
      </div>

      {/* Primary CTAs — single-button entry points. Form/list stay concealed until tapped. */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => { setLogOpen((v) => !v); if (!logOpen) setTimeout(() => window.scrollTo({ top: window.scrollY + 80, behavior: "smooth" }), 50); }}
          aria-expanded={logOpen}
          className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold transition-all hover:brightness-95"
          style={{
            background: "var(--primary)",
            color: "#FFFFFF",
            boxShadow: "0 6px 18px -6px rgba(122,148,121,0.55)",
          }}
        >
          <PenLine size={17} />
          {editingId ? "Edit incident" : "Log Incident"}
          <ChevronDown size={16} style={{ transition: "transform 200ms", transform: logOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
        </button>
        <button
          type="button"
          onClick={() => setListOpen((v) => !v)}
          aria-expanded={listOpen}
          className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold transition-all hover:brightness-95"
          style={{
            background: "#E5E2DA",
            color: "#2A2520",
            border: "1px solid rgba(42,37,32,0.10)",
          }}
        >
          <List size={17} />
          All Incidents {list.length > 0 && <span className="opacity-80">· {list.length}</span>}
          <ChevronDown size={16} style={{ transition: "transform 200ms", transform: listOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
        </button>
      </div>

      <div className="collapse-shell mt-6" data-open={logOpen} aria-hidden={!logOpen}>
        <div className="collapse-inner">
        <section
          className="card-pp"
          style={{ background: "var(--linen)", borderLeft: "4px solid var(--primary)" }}
        >
          <form onSubmit={submit} className="space-y-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed p-3 text-[12px]" style={{ borderColor: "var(--border)" }}>
            <Sparkles size={14} style={{ color: "var(--accent)" }} />
            <span className="flex-1">
              {aiBusy ? "Reading your image…" : "Upload a screenshot (text, email, photo) and I'll draft the fields for you to review."}
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" className="hidden"
              disabled={aiBusy}
              onChange={(e) => { const f = e.target.files?.[0] ?? null; e.currentTarget.value = ""; autofillFromImage(f); }} />
          </label>
          {aiFilled && (
            <div className="rounded-xl p-2 text-[11px]" style={{ background: "rgba(106,146,214,0.15)", color: "var(--foreground)" }}>
              AI-drafted — please edit anything that isn't quite right.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-eyebrow">Date</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-pp mt-1" />
            </div>
            <div>
              <label className="label-eyebrow">Time</label>
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="input-pp mt-1" />
            </div>
          </div>

          <div>
            <label className="label-eyebrow">Location</label>
            <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input-pp mt-1" placeholder="Where it happened" />
          </div>

          <div>
            <label className="label-eyebrow">What happened</label>
            <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-pp mt-1" placeholder="Describe what happened in your own words. There is no wrong way to write this." />
          </div>

          <div>
            <label className="label-eyebrow">Type</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ABUSE_TYPES.map((t) => {
                const on = form.abuse_types.includes(t.value);
                return (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => toggleType(t.value)}
                    className="rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
                    style={{
                      background: on ? t.color : "transparent",
                      color: on ? "#fff" : "var(--foreground)",
                      border: `1.5px solid ${t.color}`,
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label-eyebrow">Witnesses</label>
            <input type="text" value={form.witnesses} onChange={(e) => setForm({ ...form, witnesses: e.target.value })} className="input-pp mt-1" placeholder="Names of anyone who was present or nearby" />
          </div>

          <div>
            <label className="label-eyebrow">How did this affect you</label>
            <textarea value={form.emotional_impact} onChange={(e) => setForm({ ...form, emotional_impact: e.target.value })} className="input-pp mt-1" placeholder="Optional — your emotional state, physical impact, or anything else that felt important" />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? "Saving…" : editingId ? "Save changes" : "Save This Record"}
            </button>
            {editingId && <button type="button" onClick={reset} className="btn-ghost">Cancel</button>}
          </div>
        </form>
        </section>
        </div>
      </div>

      <div className="collapse-shell mt-6" data-open={listOpen} aria-hidden={!listOpen}>
        <div className="collapse-inner">
        <section
          className="card-pp"
          style={{ background: "var(--accent-powder)", borderLeft: "4px solid var(--accent-powder-ink)" }}
        >
          {list.length === 0 ? (
            <div className="card-pp">
              <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
                Nothing here yet — when you're ready, this is a safe place to start.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {list.map((i) => (
                <IncidentCard
                  key={i.id}
                  incident={i}
                   onConfirm={confirmRecord}
                  actions={
                    <>
                      <button onClick={() => edit(i)} aria-label="Edit" className="rounded-lg p-2 hover:bg-black/5"><Pencil size={15} /></button>
                      <button onClick={() => remove(i.id)} aria-label="Remove" className="rounded-lg p-2 hover:bg-black/5"><Trash2 size={15} /></button>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </section>
        </div>
      </div>
      <div className="hidden">{typeLabel("other")}{typeColor("other")}</div>
      <AddFromJournalModal open={journalOpen} onClose={() => setJournalOpen(false)} onSaved={load} />
      <BulkPastIncidentsModal open={bulkOpen} onClose={() => setBulkOpen(false)} onSaved={load} />
      <ConfirmDialog
        open={!!confirmDelete}
        title="Remove this record?"
        body="It will be hidden right away. You'll see an Undo option for a few seconds after."
        confirmLabel="Remove"
        cancelLabel="Keep"
        onConfirm={doRemove}
        onCancel={() => setConfirmDelete(null)}
      />
      <CognitiveClose
        title="See your entries on a timeline"
        body="One date next to another is where the pattern starts to show. Take a look when you're ready."
        cta="Open timeline"
        to="/timeline"
      />
    </div>
  );
}