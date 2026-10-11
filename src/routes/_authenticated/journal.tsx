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
import { makeIntakeDeps } from "@/lib/evidence-intake-deps";
import { uploadWithRetry } from "@/lib/upload-retry";
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
import { DraftTrustHinge } from "@/components/sharing/DraftTrustHinge";
import type { ShareReadiness } from "@/lib/sharing/share-readiness";
import { EMPTY_DATE_FORM, dateFormFromRow, isoDaysAgo, resolveIncidentDate } from "@/lib/incident-date";
import { useEntryDraft } from "@/hooks/use-entry-draft";
import { draftStatusText, type EntryDraft } from "@/lib/entry-draft";
import { uploadAndPreserve, type IntakeDeps } from "@/lib/evidence-intake";
import { ingestEvidenceBatch } from "@/lib/evidence-ingest.functions";

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

function JournalPage() {
  const { user } = useAuth();
  const extractIncident = useServerFn(extractIncidentFromImage);
  const findContradictions = useServerFn(findPossibleContradictions);
  const [list, setList] = useState<FullIncident[]>([]);
  const [evidenceCounts, setEvidenceCounts] = useState<Record<string, number>>({});
  const [contradictions, setContradictions] = useState<ContradictionPair[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiFilled, setAiFilled] = useState(false);
  const [form, setForm] = useState({
    // Starts with no date: nothing is guessed. She picks Today, another date, or leaves it.
    date: EMPTY_DATE_FORM.date,
    time: "",
    location: "",
    description: "",
    abuse_types: [] as string[],
    witnesses: "",
    emotional_impact: "",
    date_precision: EMPTY_DATE_FORM.date_precision as Precision,
    approx_month: "",
    date_range_start: "",
    date_range_end: "",
    anchor_incident_id: "",
    anchor_label: "",
  });
  const [busy, setBusy] = useState(false);
  /** Inline save status — toast alone is easy to miss; role=alert keeps it accessible. */
  const [formFeedback, setFormFeedback] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [trustHingeOpen, setTrustHingeOpen] = useState(false);
  const [trustHingeMode, setTrustHingeMode] = useState<"save" | "edit">("save");
  const [trustEditId, setTrustEditId] = useState<string | null>(null);
  const [pendingShareReadiness, setPendingShareReadiness] = useState<ShareReadiness>("private");
  const [loadError, setLoadError] = useState(false);
  const ingestFn = useServerFn(ingestEvidenceBatch);

  // Unfinished entries are kept privately in her own account row as she types, so locking,
  // leaving the page or a refresh doesn't lose them. Nothing sensitive goes to local storage.
  const draftForm: EntryDraft = {
    description: form.description,
    time: form.time,
    location: form.location,
    witnesses: form.witnesses,
    emotional_impact: form.emotional_impact,
    abuse_types: form.abuse_types,
    date_precision: form.date_precision,
    date: form.date,
    approx_month: form.approx_month,
    date_range_start: form.date_range_start,
    date_range_end: form.date_range_end,
    anchor_incident_id: form.anchor_incident_id,
    anchor_label: form.anchor_label,
  };
  const entryDraft = useEntryDraft(user?.id, draftForm, !editingId);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error: listErr } = await supabase
      .from("incidents")
      .select(
        "id,date,time,location,description,abuse_types,witnesses,emotional_impact,source,confirmed_at,date_precision,date_range_start,date_range_end,anchor_incident_id,anchor_label,share_readiness",
      )
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("date", { ascending: false, nullsFirst: false });
    // A failed read is not an empty journal. Say so instead of showing "nothing here yet".
    if (listErr) {
      setLoadError(true);
      return;
    }
    setLoadError(false);
    const rows = (data as FullIncident[] | null) ?? [];
    setList(rows);
    findContradictions()
      .then((r) => setContradictions(r.contradictions ?? []))
      .catch(() => setContradictions([]));
    if (rows.length) {
      const { data: ev } = await supabase
        .from("evidence")
        .select("linked_incident_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .in(
          "linked_incident_id",
          rows.map((r) => r.id),
        );
      const counts: Record<string, number> = {};
      for (const row of ev ?? []) {
        const id = row.linked_incident_id as string | null;
        if (id) counts[id] = (counts[id] ?? 0) + 1;
      }
      setEvidenceCounts(counts);
    } else {
      setEvidenceCounts({});
    }
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

  // Resume keys for files whose outcome came back unconfirmed, so a retry reuses the same
  // stored name and can't create a second record.
  const [resumeKeys, setResumeKeys] = useState<Record<string, string>>({});

  const intakeDeps: IntakeDeps = makeIntakeDeps((file) => ingestFn({ data: { files: [file] } }));

  /** Attach files to a saved entry. Returns the files that did NOT save, with why. */
  const uploadAttachments = async (
    incidentId: string,
  ): Promise<{ saved: number; failed: Array<{ file: File; message: string }> }> => {
    if (!user || attachments.length === 0) return { saved: 0, failed: [] };
    let saved = 0;
    const failed: Array<{ file: File; message: string }> = [];
    const keys: Record<string, string> = { ...resumeKeys };
    for (const f of attachments) {
      const id = `${f.name}:${f.size}:${f.lastModified}`;
      const r = await uploadAndPreserve(intakeDeps, {
        userId: user.id,
        file: { name: f.name, type: f.type, size: f.size, blob: f },
        linkedIncidentId: incidentId,
        resumeKey: keys[id],
      });
      if (r.ok) {
        saved += 1;
        delete keys[id];
      } else {
        failed.push({ file: f, message: r.message });
        if (r.stage === "unconfirmed") keys[id] = r.storageKey;
      }
    }
    setResumeKeys(keys);
    return { saved, failed };
  };

  const reset = () => {
    setForm({
      date: EMPTY_DATE_FORM.date,
      time: "",
      location: "",
      description: "",
      abuse_types: [],
      witnesses: "",
      emotional_impact: "",
      date_precision: EMPTY_DATE_FORM.date_precision,
      approx_month: "",
      date_range_start: "",
      date_range_end: "",
      anchor_incident_id: "",
      anchor_label: "",
    });
    setEditingId(null);
    setAiFilled(false);
    setAttachments([]);
    setResumeKeys({});
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
    if (!user) {
      const msg = "You're signed out. Sign in again, then save.";
      setFormFeedback({ kind: "error", message: msg });
      toast(msg);
      return;
    }
    // Only the words are needed. A date, a type and the details can all come later.
    if (!form.description.trim() && attachments.length === 0) {
      const msg = "Write a few words, or attach a file, to save an entry.";
      setFormFeedback({ kind: "error", message: msg });
      toast(msg);
      return;
    }
    setFormFeedback(null);
    // Trust hinge before timeline commit — default Keep private (fail-closed).
    const existing = editingId ? list.find((i) => i.id === editingId) : null;
    setPendingShareReadiness(
      (existing?.share_readiness as ShareReadiness | undefined) ?? "private",
    );
    setTrustHingeMode("save");
    setTrustEditId(null);
    setTrustHingeOpen(true);
  };

  const commitMark = async (shareReadiness: ShareReadiness) => {
    if (!user) return;
    setBusy(true);
    try {
      // Anchor incident lookup: if the user picked an existing incident, capture
      // its date so we can order this record chronologically near the anchor.
      const anchor = form.anchor_incident_id
        ? list.find((i) => i.id === form.anchor_incident_id)
        : null;
      // What she knows is what is stored: no date stays no date, never today.
      const stored = resolveIncidentDate({
        date_precision: form.date_precision,
        date: form.date,
        approx_month: form.approx_month,
        date_range_start: form.date_range_start,
        date_range_end: form.date_range_end,
        anchor_date: anchor?.date ?? "",
      });
      const anchored =
        stored.date_precision === "before_anchor" || stored.date_precision === "after_anchor";
      const payload = {
        user_id: user.id,
        date: stored.date, // sort helper; UI renders precision-aware label instead
        time: form.time || null,
        location: sanitizeLine(form.location) || null,
        description: form.description,
        abuse_types: form.abuse_types,
        witnesses: sanitizeLine(form.witnesses) || null,
        emotional_impact: form.emotional_impact || null,
        share_readiness: shareReadiness,
        date_precision: stored.date_precision,
        date_range_start: stored.date_range_start,
        date_range_end: stored.date_range_end,
        anchor_incident_id: anchored ? form.anchor_incident_id || null : null,
        anchor_label: anchored ? sanitizeLine(form.anchor_label) || null : null,
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
        const detail =
          typeof error.message === "string" && error.message.trim() ? error.message : null;
        const msg = detail
          ? `We couldn't save that. ${detail}`
          : "We couldn't save that. Try again in a moment.";
        setFormFeedback({ kind: "error", message: msg });
        toast(msg);
        return;
      }
      // The entry itself is saved. Files are attached next, and each one is checked: the
      // message below only says "saved" for what was confirmed.
      let outcome: { saved: number; failed: Array<{ file: File; message: string }> } = { saved: 0, failed: [] };
      try {
        outcome = savedId && attachments.length ? await uploadAttachments(savedId) : outcome;
      } catch {
        outcome = {
          saved: 0,
          failed: attachments.map((file) => ({ file, message: "We couldn't confirm that this saved." })),
        };
      }
      if (outcome.failed.length > 0) {
        // Keep her on this entry with only the files that didn't save. Trying again updates the
        // same entry (it won't make a second one) and each file can be retried safely.
        setEditingId(savedId);
        setAttachments(outcome.failed.map((f) => f.file));
        const detail = outcome.failed.map((f) => `${f.file.name}: ${f.message}`).join(" ");
        const msg = `Your entry is saved${outcome.saved ? `, with ${outcome.saved} file${outcome.saved === 1 ? "" : "s"}` : ""}. ${outcome.failed.length} file${outcome.failed.length === 1 ? "" : "s"} did NOT save. ${detail} Press Save again to retry just those.`;
        setFormFeedback({ kind: "error", message: msg });
        toast(msg);
        await entryDraft.clear();
        await load();
        return;
      }
      const okMsg = outcome.saved
        ? `Saved privately. Your entry and ${outcome.saved} file${outcome.saved === 1 ? "" : "s"} are in your account.`
        : "Saved privately. Nothing is shared unless you choose to share it.";
      // Only now is the unfinished-entry copy removed.
      await entryDraft.clear();
      setFormFeedback({ kind: "success", message: okMsg });
      toast(okMsg);
      reset();
      setListOpen(true);
      await load();
    } catch (err: unknown) {
      const detail =
        err instanceof Error && err.message.trim()
          ? err.message
          : "Check your connection and try again.";
      const msg = `We couldn't save that. ${detail}`;
      setFormFeedback({ kind: "error", message: msg });
      toast(msg);
    } finally {
      setBusy(false);
    }
  };

  const edit = (i: FullIncident) => {
    setEditingId(i.id);
    setLogOpen(true);
    // An undated entry opens undated. It used to open as today, and saving then dated it today.
    const d = dateFormFromRow(i);
    setForm({
      date: d.date,
      time: i.time ?? "",
      location: i.location ?? "",
      description: i.description,
      abuse_types: i.abuse_types,
      witnesses: i.witnesses ?? "",
      emotional_impact: i.emotional_impact ?? "",
      date_precision: d.date_precision,
      approx_month: d.approx_month,
      date_range_start: d.date_range_start,
      date_range_end: d.date_range_end,
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
    const up = await uploadWithRetry(() =>
        supabase.storage.from("evidence-files").upload(key, f));
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
          style={{ borderLeft: "4px solid var(--pp-approximate)" }}
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
                    background: "var(--pp-ground-hi)",
                    boxShadow: "var(--pp-shadow-in-sm)",
                  }}
                >
                  <div
                    className="text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--pp-approximate)" }}
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
                      style={{ boxShadow: "var(--pp-shadow-xs)" }}
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
                      style={{ boxShadow: "var(--pp-shadow-xs)" }}
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
          {editingId ? "Edit entry" : "Add an entry"}
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
          All entries {list.length > 0 && <span className="opacity-80">· {list.length}</span>}
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
              {entryDraft.loadFailed && !editingId && (
                <div
                  role="alert"
                  data-testid="draft-load-failed"
                  className="mb-3 rounded-2xl p-3 text-[13px]"
                  style={{ background: "rgba(180,60,60,0.12)", border: "1px solid rgba(180,60,60,0.35)" }}
                >
                  <p className="font-semibold">We couldn&apos;t check for an unfinished entry.</p>
                  <p className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                    Your earlier draft may still be on your account. We are not autosaving new typing
                    until this is cleared, so we don&apos;t overwrite something we couldn&apos;t read.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => window.location.reload()}
                    >
                      Reload to try again
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => entryDraft.dismissLoadFailed()}
                    >
                      Continue without restoring
                    </button>
                  </div>
                </div>
              )}
              {entryDraft.restored && !editingId && (
                <div
                  role="status"
                  className="mb-3 rounded-2xl p-3 text-[13px]"
                  style={{ background: "rgba(106,146,214,0.15)", border: "1px solid rgba(106,146,214,0.35)" }}
                >
                  <p className="font-semibold">You have an unfinished entry.</p>
                  <p className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                    Saved privately to your account on{" "}
                    {new Date(entryDraft.restored.savedAt).toLocaleString()}. It stays hidden until you choose to continue.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        const d = entryDraft.restored!.draft;
                        setForm({
                          date: d.date,
                          time: d.time,
                          location: d.location,
                          description: d.description,
                          abuse_types: d.abuse_types,
                          witnesses: d.witnesses,
                          emotional_impact: d.emotional_impact,
                          date_precision: (d.date_precision as Precision) || "unknown",
                          approx_month: d.approx_month,
                          date_range_start: d.date_range_start,
                          date_range_end: d.date_range_end,
                          anchor_incident_id: d.anchor_incident_id,
                          anchor_label: d.anchor_label,
                        });
                        entryDraft.acceptRestored();
                      }}
                    >
                      Continue it
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={async () => {
                        const ok = await entryDraft.clear();
                        if (!ok) toast("We couldn't delete the draft. Try again.");
                      }}
                    >
                      Discard it
                    </button>
                  </div>
                </div>
              )}
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label htmlFor="entry-what" className="label-eyebrow">
                    What happened
                  </label>
                  <textarea
                    id="entry-what"
                    name="what-happened"
                    autoComplete="off"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="input-pp mt-1"
                    rows={5}
                    placeholder="Write it in your own words. A few words is enough. You can add more later."
                  />
                </div>

                <div>
                  <label htmlFor="entry-files" className="label-eyebrow">
                    Or start from a photo, recording or file
                  </label>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    The original is kept exactly as you add it and saved with this entry.
                  </p>
                  <input
                    id="entry-files"
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
                    <p className="mt-1 text-[11.5px]" style={{ color: "var(--accent)" }}>
                      {attachError}
                    </p>
                  )}
                  {attachments.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {attachments.map((f, idx) => (
                        <li key={`${f.name}-${idx}`} className="flex items-center justify-between text-[12px]">
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

                <fieldset>
                  <legend className="label-eyebrow">When did this happen?</legend>
                  <p className="mt-1 mb-2 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    Optional. If you're not sure, leave it. It will be saved without a date and you can add one later.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "today", label: "Today", on: form.date_precision === "exact" && form.date === isoDaysAgo(0), set: () => setForm({ ...form, date_precision: "exact", date: isoDaysAgo(0) }) },
                      { id: "yesterday", label: "Yesterday", on: form.date_precision === "exact" && form.date === isoDaysAgo(1), set: () => setForm({ ...form, date_precision: "exact", date: isoDaysAgo(1) }) },
                      { id: "pick", label: "Pick a date", on: form.date_precision === "exact" && !!form.date && form.date !== isoDaysAgo(0) && form.date !== isoDaysAgo(1), set: () => setForm({ ...form, date_precision: "exact", date: form.date_precision === "exact" ? form.date : "" }) },
                      { id: "unsure", label: "Not sure yet", on: form.date_precision === "unknown", set: () => setForm({ ...form, date_precision: "unknown", date: "" }) },
                    ].map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={o.on}
                        onClick={o.set}
                        className="rounded-2xl px-3 py-1.5 text-[13px] font-semibold"
                        style={{
                          background: o.on ? "var(--primary)" : "transparent",
                          color: o.on ? "#fff" : "var(--foreground)",
                          border: "1.5px solid var(--primary)",
                        }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {form.date_precision === "exact" && (
                    <div className="mt-2">
                      <label htmlFor="entry-date" className="label-eyebrow">
                        Date
                      </label>
                      <input
                        id="entry-date"
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        className="input-pp mt-1"
                      />
                      <p className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                        Leave this blank and the entry is saved without a date.
                      </p>
                    </div>
                  )}
                  {form.date_precision === "unknown" && (
                    <p className="mt-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                      Saved without a date. Nothing is filled in for you.
                    </p>
                  )}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[13px] font-semibold">
                      More ways to say when
                    </summary>
                    <div className="mt-2">
                      {PRECISION_OPTIONS.filter((o) => o.value !== "exact" && o.value !== "unknown").map((o) => (
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
                    {form.date_precision === "approximate_month" && (
                      <div className="mt-2">
                        <label htmlFor="entry-month" className="label-eyebrow">
                          Month
                        </label>
                        <input
                          id="entry-month"
                          type="month"
                          value={form.approx_month}
                          onChange={(e) => setForm({ ...form, approx_month: e.target.value })}
                          className="input-pp mt-1"
                        />
                      </div>
                    )}
                    {form.date_precision === "range" && (
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="entry-from" className="label-eyebrow">
                            From
                          </label>
                          <input
                            id="entry-from"
                            type="date"
                            value={form.date_range_start}
                            onChange={(e) => setForm({ ...form, date_range_start: e.target.value })}
                            className="input-pp mt-1"
                          />
                        </div>
                        <div>
                          <label htmlFor="entry-to" className="label-eyebrow">
                            To
                          </label>
                          <input
                            id="entry-to"
                            type="date"
                            value={form.date_range_end}
                            onChange={(e) => setForm({ ...form, date_range_end: e.target.value })}
                            className="input-pp mt-1"
                          />
                        </div>
                      </div>
                    )}
                    {(form.date_precision === "before_anchor" || form.date_precision === "after_anchor") && (
                      <div className="mt-2 space-y-3">
                        <div>
                          <label htmlFor="entry-anchor" className="label-eyebrow">
                            {form.date_precision === "before_anchor" ? "Before which event?" : "After which event?"}
                          </label>
                          <select
                            id="entry-anchor"
                            value={form.anchor_incident_id}
                            onChange={(e) => setForm({ ...form, anchor_incident_id: e.target.value })}
                            className="input-pp mt-1"
                          >
                            <option value="">— pick one of your entries —</option>
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
                          <label htmlFor="entry-anchor-text" className="label-eyebrow">
                            Or describe it in your own words
                          </label>
                          <input
                            id="entry-anchor-text"
                            type="text"
                            value={form.anchor_label}
                            onChange={(e) => setForm({ ...form, anchor_label: e.target.value })}
                            className="input-pp mt-1"
                            placeholder={`e.g. "before my son's second birthday" or "after the move"`}
                          />
                          <p className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                            This is labelled approximate. The app never invents a date for you.
                          </p>
                        </div>
                      </div>
                    )}
                  </details>
                </fieldset>

                <details className="rounded-2xl border p-3" style={{ borderColor: "var(--border)" }}>
                  <summary className="cursor-pointer text-[13px] font-semibold">Add details later</summary>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label htmlFor="entry-time" className="label-eyebrow">
                        Time
                      </label>
                      <input
                        id="entry-time"
                        type="time"
                        value={form.time}
                        onChange={(e) => setForm({ ...form, time: e.target.value })}
                        className="input-pp mt-1"
                      />
                    </div>
                    <div>
                      <label htmlFor="entry-location" className="label-eyebrow">
                        Location
                      </label>
                      <input
                        id="entry-location"
                        type="text"
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        className="input-pp mt-1"
                        placeholder="Where it happened"
                      />
                    </div>
                    <div>
                      <label htmlFor="entry-witnesses" className="label-eyebrow">
                        Witnesses
                      </label>
                      <input
                        id="entry-witnesses"
                        type="text"
                        value={form.witnesses}
                        onChange={(e) => setForm({ ...form, witnesses: e.target.value })}
                        className="input-pp mt-1"
                        placeholder="Anyone who was present or nearby"
                      />
                    </div>
                    <div>
                      <label htmlFor="entry-impact" className="label-eyebrow">
                        How did this affect you
                      </label>
                      <textarea
                        id="entry-impact"
                        value={form.emotional_impact}
                        onChange={(e) => setForm({ ...form, emotional_impact: e.target.value })}
                        className="input-pp mt-1"
                        placeholder="Only if you want to"
                      />
                    </div>
                    <div>
                      <span className="label-eyebrow">Type (optional)</span>
                      <p className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                        Skip this if you're not sure. You can label it later.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ABUSE_TYPES.map((t) => {
                          const on = form.abuse_types.includes(t.value);
                          return (
                            <button
                              type="button"
                              key={t.value}
                              aria-pressed={on}
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
                    </div>
                  </div>
                </details>

                <label
                  className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed p-3 text-[12px]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Sparkles size={14} style={{ color: "var(--accent)" }} />
                  <span className="flex-1">
                    {aiBusy
                      ? "Reading your image…"
                      : "Optional: upload a screenshot and a draft of the fields will be suggested for you to check."}
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
                    Suggested by software. Please check it and edit anything that isn't right.
                  </div>
                )}

                {formFeedback && (
                  <p
                    role="alert"
                    aria-live={formFeedback.kind === "error" ? "assertive" : "polite"}
                    data-testid="journal-save-feedback"
                    className="rounded-xl px-3 py-2 text-[13px] font-semibold"
                    style={
                      formFeedback.kind === "error"
                        ? {
                            color: "#9B2C3E",
                            background: "rgba(155, 44, 62, 0.08)",
                            border: "1px solid rgba(155, 44, 62, 0.25)",
                          }
                        : {
                            color: "var(--foreground)",
                            background: "rgba(106, 146, 214, 0.15)",
                            border: "1px solid rgba(106, 146, 214, 0.35)",
                          }
                    }
                  >
                    {formFeedback.message}
                  </p>
                )}

                <p
                  aria-live="polite"
                  data-testid="journal-draft-status"
                  className="text-[12px]"
                  style={{ color: entryDraft.status === "failed" ? "#9B2C3E" : "var(--muted-foreground)" }}
                >
                  {draftStatusText(entryDraft.status)}
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <button type="submit" disabled={busy} className="btn-primary">
                    {busy ? "Saving…" : editingId ? "Save changes" : "Save privately"}
                  </button>
                  {editingId && (
                    <button type="button" onClick={reset} className="btn-ghost">
                      Cancel
                    </button>
                  )}
                </div>
                <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                  Saving keeps this private. Sharing with anyone is a separate step you choose.
                </p>
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
              {loadError ? (
                <div className="card-pp" role="alert">
                  <p className="text-[14px]">
                    We couldn&apos;t load your entries. They are not gone. Reload the page to try again.
                  </p>
                </div>
              ) : list.length === 0 ? (
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
                      evidenceCount={evidenceCounts[i.id] ?? 0}
                      onConfirm={confirmRecord}
                      onEditReadiness={() => {
                        setTrustEditId(i.id);
                        setPendingShareReadiness(
                          (i.share_readiness as ShareReadiness | undefined) ?? "private",
                        );
                        setTrustHingeMode("edit");
                        setTrustHingeOpen(true);
                      }}
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
      <DraftTrustHinge
        open={trustHingeOpen}
        onOpenChange={setTrustHingeOpen}
        initial={pendingShareReadiness}
        mode={trustHingeMode}
        onConfirm={async (readiness) => {
          if (trustHingeMode === "edit" && trustEditId) {
            if (!user) return;
            const { error } = await supabase
              .from("incidents")
              .update({ share_readiness: readiness })
              .eq("id", trustEditId)
              .eq("user_id", user.id);
            if (error) {
              toast("We couldn't update sharing readiness. Try again in a moment.");
              throw error;
            }
            await load();
            return;
          }
          await commitMark(readiness);
        }}
      />

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
