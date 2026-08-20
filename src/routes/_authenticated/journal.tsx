import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pencil,
  Trash2,
  Sparkles,
  BookOpen,
  Clock,
  ChevronDown,
  PenLine,
  List,
  Mic,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ABUSE_TYPES, typeColor, typeLabel } from "@/lib/abuse-types";
import { IncidentCard, type IncidentLite } from "@/components/IncidentCard";
import { useServerFn } from "@tanstack/react-start";
import { extractIncidentFromImage } from "@/lib/extract-incident.functions";
import { findPossibleContradictions, type ContradictionPair } from "@/lib/contradictions.functions";
import { sanitizeLine } from "@/lib/dates";
import { AddFromJournalModal } from "@/components/AddFromJournalModal";
import { BulkPastIncidentsModal } from "@/components/BulkPastIncidentsModal";
import { CognitiveClose } from "@/components/CognitiveClose";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { checkUploadSize } from "@/lib/upload-limits";
import { FocusRegion } from "@/components/survivor/focus-mode";
import { HubTabs, ARCHIVE_TABS } from "@/components/HubTabs";

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

type Precision =
  | "exact"
  | "approximate_month"
  | "range"
  | "before_anchor"
  | "after_anchor"
  | "unknown";

const PRECISION_OPTIONS: { value: Precision; label: string }[] = [
  { value: "exact", label: "Exact date" },
  { value: "approximate_month", label: "Approximate (month/year)" },
  { value: "range", label: "Date range" },
  { value: "before_anchor", label: "Before another event" },
  { value: "after_anchor", label: "After another event" },
  { value: "unknown", label: "Not sure — skip for now" },
];

const PRECISION_HELP: Record<Precision, string> = {
  exact: "Recorded as Confirmed. The thread runs taut.",
  approximate_month: "Tie it to the month you're sure of. Recorded as Approximate.",
  range: "Give an earliest and latest possible date. Recorded as Approximate.",
  before_anchor: "Tied to something else you remember. Recorded as Approximate.",
  after_anchor: "Tied to something else you remember. Recorded as Approximate.",
  unknown: "Log it undated. Recorded as Unknown — you can add a date later.",
};

// Best-effort sortable date derived from a non-exact entry, so timeline
// ordering still works. Never displayed as a bare date — UI always uses the
// precision-aware label.
function deriveSortDate(
  p: Precision,
  form: {
    date: string;
    date_range_start: string;
    date_range_end: string;
    approx_month: string;
    anchor_date: string;
  },
): string | null {
  if (p === "exact") return form.date || null;
  if (p === "approximate_month") return form.approx_month ? `${form.approx_month}-15` : null;
  if (p === "range") return form.date_range_start || form.date_range_end || null;
  if (p === "before_anchor") return form.anchor_date ? form.anchor_date : null;
  if (p === "after_anchor") return form.anchor_date ? form.anchor_date : null;
  return null;
}

function JournalPage() {
  const { user } = useAuth();
  const extractIncident = useServerFn(extractIncidentFromImage);
  const findContradictions = useServerFn(findPossibleContradictions);
  const [list, setList] = useState<FullIncident[]>([]);
  const [contradictions, setContradictions] = useState<ContradictionPair[]>([]);
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
    date_precision: "exact" as Precision,
    approx_month: "",
    date_range_start: "",
    date_range_end: "",
    anchor_incident_id: "",
    anchor_label: "",
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
      .select(
        "id,date,time,location,description,abuse_types,witnesses,emotional_impact,source,confirmed_at,date_precision,date_range_start,date_range_end,anchor_incident_id,anchor_label",
      )
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("date", { ascending: false, nullsFirst: false });
    setList((data as FullIncident[] | null) ?? []);
    findContradictions()
      .then((r) => setContradictions(r.contradictions ?? []))
      .catch(() => setContradictions([]));
  }, [user, findContradictions]);

  useEffect(() => {
    load();
  }, [load]);

  // Files the survivor attaches while writing an entry. They're uploaded and
  // linked to the incident only once the entry itself saves successfully.
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);

  const addAttachments = (files: FileList | null) => {
    if (!files?.length) return;
    const next: File[] = [];
    for (const f of Array.from(files)) {
      const problem = checkUploadSize(f);
      if (problem) {
        setAttachError(problem);
        continue;
      }
      next.push(f);
    }
    if (next.length) setAttachError(null);
    setAttachments((p) => [...p, ...next]);
  };

  const uploadAttachments = async (incidentId: string): Promise<string | null> => {
    if (!user || attachments.length === 0) return null;
    let ok = 0;
    for (const f of attachments) {
      const key = `${user.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("evidence-files").upload(key, f);
      if (upErr) continue;
      const { error: rowErr } = await supabase.from("evidence").insert({
        user_id: user.id,
        title: f.name,
        date: form.date || today(),
        file_url: key,
        file_type: f.type || "application/octet-stream",
        original_filename: f.name,
        bytes: f.size,
        mime: f.type || null,
        linked_incident_id: incidentId,
        review_status: "confirmed",
      });
      if (!rowErr) ok += 1;
    }
    if (ok === attachments.length) {
      return `Saved. Your record and ${ok} file${ok === 1 ? "" : "s"} are safe.`;
    }
    return `Saved. ${ok} of ${attachments.length} files attached — you can add the rest from Evidence.`;
  };

  const reset = () => {
    setForm({
      date: today(),
      time: "",
      location: "",
      description: "",
      abuse_types: [],
      witnesses: "",
      emotional_impact: "",
      date_precision: "exact",
      approx_month: "",
      date_range_start: "",
      date_range_end: "",
      anchor_incident_id: "",
      anchor_label: "",
    });
    setEditingId(null);
    setAiFilled(false);
    setAttachments([]);
    setAttachError(null);
  };

  const toggleType = (t: string) => {
    setForm((f) => ({
      ...f,
      abuse_types: f.abuse_types.includes(t)
        ? f.abuse_types.filter((x) => x !== t)
        : [...f.abuse_types, t],
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.description.trim() || form.abuse_types.length === 0) {
      toast("Add a description and at least one type.");
      return;
    }
    setBusy(true);
    // Anchor incident lookup: if the user picked an existing incident, capture
    // its date so we can order this record chronologically near the anchor.
    const anchor = form.anchor_incident_id
      ? list.find((i) => i.id === form.anchor_incident_id)
      : null;
    const anchorDate = anchor?.date ?? "";
    const sortDate = deriveSortDate(form.date_precision, {
      date: form.date,
      date_range_start: form.date_range_start,
      date_range_end: form.date_range_end,
      approx_month: form.approx_month,
      anchor_date: anchorDate,
    });
    const payload = {
      user_id: user.id,
      date: sortDate, // sort helper; UI renders precision-aware label instead
      time: form.time || null,
      location: sanitizeLine(form.location) || null,
      description: form.description,
      abuse_types: form.abuse_types,
      witnesses: sanitizeLine(form.witnesses) || null,
      emotional_impact: form.emotional_impact || null,
      date_precision: form.date_precision,
      date_range_start: form.date_precision === "range" ? form.date_range_start || null : null,
      date_range_end: form.date_precision === "range" ? form.date_range_end || null : null,
      anchor_incident_id:
        form.date_precision === "before_anchor" || form.date_precision === "after_anchor"
          ? form.anchor_incident_id || null
          : null,
      anchor_label:
        form.date_precision === "before_anchor" || form.date_precision === "after_anchor"
          ? sanitizeLine(form.anchor_label) || null
          : null,
    };
    const insertPayload = {
      ...payload,
      // Preserve provenance when the draft started from an AI extraction, but
      // pressing Save after review IS confirmation — otherwise the record is
      // silently filtered out of attorney shares and pattern analysis.
      source: aiFilled ? "ai_extracted" : "survivor",
      confirmed_at: new Date().toISOString(),
    };
    let error;
    let savedId: string | null = editingId;
    if (editingId) {
      const current = list.find((i) => i.id === editingId);
      const updatePayload: typeof payload & { confirmed_at?: string } = { ...payload };
      // Editing an unconfirmed AI-extracted record IS an act of confirmation.
      // Never overwrite `source` on edit.
      if (current && !current.confirmed_at) {
        updatePayload.confirmed_at = new Date().toISOString();
      }
      ({ error } = await supabase
        .from("incidents")
        .update(updatePayload)
        .eq("id", editingId)
        .eq("user_id", user.id));
    } else {
      const res = await supabase.from("incidents").insert(insertPayload).select("id").single();
      error = res.error;
      savedId = res.data?.id ?? null;
    }
    if (error) {
      setBusy(false);
      toast("We couldn't save that. Try again in a moment.");
      return;
    }
    const attachMsg = savedId && attachments.length ? await uploadAttachments(savedId) : null;
    setBusy(false);
    toast(attachMsg ?? "Saved. Your record is safe.");
    reset();
    load();
  };

  const edit = (i: FullIncident) => {
    setEditingId(i.id);
    setLogOpen(true);
    const p = (i.date_precision as Precision | null | undefined) ?? "exact";
    setForm({
      date: i.date ?? today(),
      time: i.time ?? "",
      location: i.location ?? "",
      description: i.description,
      abuse_types: i.abuse_types,
      witnesses: i.witnesses ?? "",
      emotional_impact: i.emotional_impact ?? "",
      date_precision: p,
      approx_month: p === "approximate_month" && i.date ? i.date.slice(0, 7) : "",
      date_range_start: i.date_range_start ?? "",
      date_range_end: i.date_range_end ?? "",
      anchor_incident_id: i.anchor_incident_id ?? "",
      anchor_label: i.anchor_label ?? "",
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
    if (error) {
      toast("We couldn't remove that. Try again in a moment.");
      return;
    }
    // Optimistically hide
    setList((prev) => prev.filter((i) => i.id !== id));
    toast("Removed.", {
      action: {
        label: "Undo",
        onClick: async () => {
          await supabase
            .from("incidents")
            .update({ deleted_at: null })
            .eq("id", id)
            .eq("user_id", user.id);
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
      // Preserve provenance: keep source = 'ai_extracted', only mark confirmed.
      .update({ confirmed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      toast("We couldn't confirm that. Try again in a moment.");
      return;
    }
    toast("Confirmed.");
    load();
  };

  const autofillFromImage = async (f: File | null) => {
    if (!user || !f) return;
    setAiBusy(true);
    const ext = f.name.split(".").pop() ?? "bin";
    const key = `${user.id}/journal-ai/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await supabase.storage.from("evidence-files").upload(key, f);
    if (up.error) {
      setAiBusy(false);
      toast("We couldn't read that image. Try another.");
      return;
    }
    const signed = await supabase.storage.from("evidence-files").createSignedUrl(key, 600);
    if (!signed.data?.signedUrl) {
      setAiBusy(false);
      toast("We couldn't read that image.");
      return;
    }
    const r = await extractIncident({
      data: { signedUrl: signed.data.signedUrl, mimeType: f.type || "image/png" },
    });
    setAiBusy(false);
    if (!r.ok) {
      toast("We couldn't pull details from that image. You can still type it out.");
      return;
    }
    const e = r.extracted as Partial<typeof form> & { abuse_types?: string[] };
    setForm((prev) => ({
      ...prev,
      date: e.date || prev.date,
      time: e.time || prev.time,
      location: e.location || prev.location,
      description: e.description || prev.description,
      abuse_types:
        Array.isArray(e.abuse_types) && e.abuse_types.length ? e.abuse_types : prev.abuse_types,
      witnesses: e.witnesses || prev.witnesses,
      emotional_impact: e.emotional_impact || prev.emotional_impact,
    }));
    setAiFilled(true);
    toast("Filled in what I could. Please review every field before saving.");
  };

  return (
    <div>
      <HubTabs tabs={ARCHIVE_TABS} />
      <div className="label-eyebrow">Your Archive</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Add what happened.
        <br />
        <em>In your own words.</em>
      </h1>

      <div className="mt-4">
        <div className="flex flex-wrap gap-2">
          <Link
            to="/voice-notes"
            className="pp-chip inline-flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold"
          >
            <Mic size={15} />
            Add a spoken Mark
          </Link>
          <button
            type="button"
            onClick={() => setJournalOpen(true)}
            className="pp-chip inline-flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold"
          >
            <BookOpen size={15} />
            Add from a written page
          </button>
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="pp-chip inline-flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold"
          >
            <Clock size={15} />
            Add Multiple Past Marks
          </button>
        </div>
        <p className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          Upload a written page, or recall older Marks one memory at a time.
        </p>
      </div>

      {contradictions.length > 0 && (
        <section
          className="card-pp mt-6"
          style={{ background: "#F4EFE4", borderLeft: "4px solid #6A7FA8" }}
          aria-label="Same-day Marks with different details"
        >
          <h2 className="font-serif text-[18px]" style={{ color: "var(--foreground)" }}>
            A few Marks on the same day have different details — worth a look
          </h2>
          <p className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            Nothing has been changed. Review each one and edit whichever feels right — or leave them
            as they are.
          </p>
          <ul className="mt-3 space-y-2">
            {contradictions.map((c, idx) => {
              const a = list.find((i) => i.id === c.incident_a_id);
              const b = list.find((i) => i.id === c.incident_b_id);
              if (!a || !b) return null;
              return (
                <li
                  key={`${c.incident_a_id}-${c.incident_b_id}-${c.conflict_type}-${idx}`}
                  className="rounded-2xl p-3"
                  style={{
                    background: "rgba(255,255,255,0.6)",
                    border: "1px solid rgba(42,37,32,0.08)",
                  }}
                >
                  <div
                    className="text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: "#6A7FA8" }}
                  >
                    {c.date} ·{" "}
                    {c.conflict_type === "time" ? "Different times" : "Different locations"}
                  </div>
                  <div className="mt-1 text-[13px]" style={{ color: "var(--foreground)" }}>
                    {c.detail}
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => edit(a)}
                      className="rounded-2xl p-2 text-left text-[12px] hover:bg-black/5"
                      style={{ border: "1px solid rgba(42,37,32,0.10)" }}
                    >
                      <div
                        className="text-[10px] font-semibold uppercase tracking-wide"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        Review Mark A
                      </div>
                      <div className="mt-0.5 line-clamp-2">{a.description}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => edit(b)}
                      className="rounded-2xl p-2 text-left text-[12px] hover:bg-black/5"
                      style={{ border: "1px solid rgba(42,37,32,0.10)" }}
                    >
                      <div
                        className="text-[10px] font-semibold uppercase tracking-wide"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        Review Mark B
                      </div>
                      <div className="mt-0.5 line-clamp-2">{b.description}</div>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Primary CTAs — single-button entry points. Form/list stay concealed until tapped. */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setLogOpen((v) => !v);
            if (!logOpen)
              setTimeout(
                () => window.scrollTo({ top: window.scrollY + 80, behavior: "smooth" }),
                50,
              );
          }}
          aria-expanded={logOpen}
          className="btn-primary inline-flex items-center gap-2 px-6 py-3.5 text-[15px]"
        >
          <PenLine size={17} />
          {editingId ? "Edit Mark" : "Add a Mark"}
          <ChevronDown
            size={16}
            style={{
              transition: "transform 200ms",
              transform: logOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>
        <button
          type="button"
          onClick={() => setListOpen((v) => !v)}
          aria-expanded={listOpen}
          className="btn-ghost inline-flex items-center gap-2 px-6 py-3.5 text-[15px]"
        >
          <List size={17} />
          All Marks {list.length > 0 && <span className="opacity-80">· {list.length}</span>}
          <ChevronDown
            size={16}
            style={{
              transition: "transform 200ms",
              transform: listOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>
      </div>

      <FocusRegion id="journal-log">
        <div className="collapse-shell mt-6" data-open={logOpen} inert={!logOpen}>
          <div className="collapse-inner">
            <section
              className="card-pp"
              style={{ background: "var(--linen)", borderLeft: "4px solid var(--primary)" }}
            >
              <form onSubmit={submit} className="space-y-3">
                <label
                  className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed p-3 text-[12px]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Sparkles size={14} style={{ color: "var(--accent)" }} />
                  <span className="flex-1">
                    {aiBusy
                      ? "Reading your image…"
                      : "Upload a screenshot (text, email, photo) and I'll draft the fields for you to review."}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                    className="hidden"
                    disabled={aiBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.currentTarget.value = "";
                      autofillFromImage(f);
                    }}
                  />
                </label>
                {aiFilled && (
                  <div
                    className="rounded-2xl p-2 text-[11px]"
                    style={{ background: "rgba(106,146,214,0.15)", color: "var(--foreground)" }}
                  >
                    AI-drafted — please edit anything that isn't quite right.
                  </div>
                )}

                <div>
                  <label className="label-eyebrow">Attach photos, audio or files</label>
                  <p className="text-[11px] mt-1" style={{ color: "var(--muted-foreground)" }}>
                    Anything you attach here is saved with this Mark. You can add more later.
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/*,audio/*,video/*,application/pdf"
                    className="input-pp mt-2 text-[12px]"
                    onChange={(e) => {
                      addAttachments(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                  {attachError && (
                    <p className="text-[11.5px] mt-1" style={{ color: "var(--accent)" }}>
                      {attachError}
                    </p>
                  )}
                  {attachments.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {attachments.map((f, idx) => (
                        <li
                          key={`${f.name}-${idx}`}
                          className="flex items-center justify-between text-[12px]"
                        >
                          <span className="truncate">{f.name}</span>
                          <button
                            type="button"
                            className="text-[11px] underline"
                            onClick={() => setAttachments((p) => p.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <label className="label-eyebrow">When did this happen?</label>
                  <p className="mt-1 mb-2 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    Pick the honest answer. The confidence level travels with the record — and
                    shapes how the thread is drawn.
                  </p>
                  <div>
                    {PRECISION_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        className="pp-option"
                        aria-pressed={form.date_precision === o.value}
                        onClick={() => setForm({ ...form, date_precision: o.value })}
                      >
                        <span className="pp-option-radio" />
                        <span>
                          <span className="pp-option-title">{o.label}</span>
                          <span className="pp-option-desc">{PRECISION_HELP[o.value]}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {form.date_precision === "exact" && (
                    <div>
                      <label className="label-eyebrow">Date</label>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        className="input-pp mt-1"
                      />
                    </div>
                  )}
                  {form.date_precision === "approximate_month" && (
                    <div>
                      <label className="label-eyebrow">Month</label>
                      <input
                        type="month"
                        value={form.approx_month}
                        onChange={(e) => setForm({ ...form, approx_month: e.target.value })}
                        className="input-pp mt-1"
                      />
                    </div>
                  )}
                  {form.date_precision === "range" && (
                    <>
                      <div>
                        <label className="label-eyebrow">From</label>
                        <input
                          type="date"
                          value={form.date_range_start}
                          onChange={(e) => setForm({ ...form, date_range_start: e.target.value })}
                          className="input-pp mt-1"
                        />
                      </div>
                      <div>
                        <label className="label-eyebrow">To</label>
                        <input
                          type="date"
                          value={form.date_range_end}
                          onChange={(e) => setForm({ ...form, date_range_end: e.target.value })}
                          className="input-pp mt-1"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="label-eyebrow">Time</label>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      className="input-pp mt-1"
                    />
                  </div>
                </div>

                {(form.date_precision === "before_anchor" ||
                  form.date_precision === "after_anchor") && (
                  <div
                    className="space-y-3"
                    style={{
                      background: "var(--pp-card)",
                      borderRadius: 18,
                      boxShadow: "var(--pp-shadow-in-sm)",
                      padding: 16,
                    }}
                  >
                    <div>
                      <label className="label-eyebrow">
                        {form.date_precision === "before_anchor"
                          ? "Before which event?"
                          : "After which event?"}
                      </label>
                      <select
                        value={form.anchor_incident_id}
                        onChange={(e) => setForm({ ...form, anchor_incident_id: e.target.value })}
                        className="input-pp mt-1"
                      >
                        <option value="">— pick one of your logged incidents —</option>
                        {list
                          .filter((i) => i.id !== editingId && i.date)
                          .map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.date} — {i.description.slice(0, 60)}
                              {i.description.length > 60 ? "…" : ""}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="label-eyebrow">
                        Or describe the anchor in your own words
                      </label>
                      <input
                        type="text"
                        value={form.anchor_label}
                        onChange={(e) => setForm({ ...form, anchor_label: e.target.value })}
                        className="input-pp mt-1"
                        placeholder={`e.g. "before my son's second birthday" or "after the move"`}
                      />
                      <p className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                        Use either a logged incident above, this description, or both.
                      </p>
                    </div>
                    <div
                      className="pp-note"
                      style={{ boxShadow: "var(--pp-shadow-sm)", padding: 0 }}
                    >
                      <span
                        className="pp-note-icon"
                        style={{
                          boxShadow: "var(--pp-shadow-sm)",
                          background: "transparent",
                          padding: 0,
                          width: "auto",
                          height: "auto",
                        }}
                      >
                        <ShieldCheck size={18} />
                      </span>
                      <span>
                        <span className="pp-note-title">This will be labelled Approximate</span>
                        <span className="pp-note-desc">
                          Your attorney sees the anchor and the reasoning, never a date the app
                          invented for you.
                        </span>
                      </span>
                    </div>
                  </div>
                )}

                {form.date_precision === "unknown" && (
                  <div className="pp-note">
                    <span className="pp-note-icon">
                      <Clock size={16} />
                    </span>
                    <span>
                      <span className="pp-note-title">That's okay</span>
                      <span className="pp-note-desc">
                        Save it now — you can come back and add a date if it comes to you later.
                      </span>
                    </span>
                  </div>
                )}

                <div>
                  <label className="label-eyebrow">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="input-pp mt-1"
                    placeholder="Where it happened"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">What happened</label>
                  <textarea
                    required
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="input-pp mt-1"
                    placeholder="Describe what happened in your own words. There is no wrong way to write this."
                  />
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
                          className="rounded-2xl px-3 py-1.5 text-[12px] font-semibold transition-colors"
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
                  {form.abuse_types.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {ABUSE_TYPES.filter((t) => form.abuse_types.includes(t.value)).map((t) => (
                        <li
                          key={t.value}
                          className="text-[11px] leading-snug"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          <span className="font-semibold" style={{ color: t.color }}>
                            {t.label}:
                          </span>{" "}
                          {t.helper}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <label className="label-eyebrow">Witnesses</label>
                  <input
                    type="text"
                    value={form.witnesses}
                    onChange={(e) => setForm({ ...form, witnesses: e.target.value })}
                    className="input-pp mt-1"
                    placeholder="Names of anyone who was present or nearby"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">How did this affect you</label>
                  <textarea
                    value={form.emotional_impact}
                    onChange={(e) => setForm({ ...form, emotional_impact: e.target.value })}
                    className="input-pp mt-1"
                    placeholder="Optional — your emotional state, physical impact, or anything else that felt important"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button type="submit" disabled={busy} className="btn-primary">
                    {busy ? "Saving…" : editingId ? "Save changes" : "Save This Record"}
                  </button>
                  {editingId && (
                    <button type="button" onClick={reset} className="btn-ghost">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>
          </div>
        </div>
      </FocusRegion>

      <FocusRegion id="journal-list">
        <div className="collapse-shell mt-6" data-open={listOpen} inert={!listOpen}>
          <div className="collapse-inner">
            <section
              className="card-pp"
              style={{
                background: "var(--accent-powder)",
                borderLeft: "4px solid var(--accent-powder-ink)",
              }}
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
                          <button
                            onClick={() => edit(i)}
                            aria-label="Edit"
                            className="rounded-2xl p-2 hover:bg-black/5"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => remove(i.id)}
                            aria-label="Remove"
                            className="rounded-2xl p-2 hover:bg-black/5"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </FocusRegion>
      <div className="hidden">
        {typeLabel("other")}
        {typeColor("other")}
      </div>
      <AddFromJournalModal
        open={journalOpen}
        onClose={() => setJournalOpen(false)}
        onSaved={load}
      />
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
        title="See your Marks on a timeline"
        body="One date next to another is where the pattern starts to show. Take a look when you're ready."
        cta="Open timeline"
        to="/timeline"
      />
    </div>
  );
}
