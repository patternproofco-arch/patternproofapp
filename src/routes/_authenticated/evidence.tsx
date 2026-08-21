import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  Image as ImageIcon,
  FileText,
  Music,
  Video,
  Trash2,
  Download,
  Sparkles,
  Check,
  MessageSquare,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CognitiveClose } from "@/components/CognitiveClose";
import { useServerFn } from "@tanstack/react-start";
import { extractIncidentFromImage } from "@/lib/extract-incident.functions";
import { ingestEvidenceBatch } from "@/lib/evidence-ingest.functions";
import { FocusRegion } from "@/components/survivor/focus-mode";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BatchDropzone } from "@/components/evidence/BatchDropzone";
import { ContentTypeSuggestions } from "@/components/evidence/ContentTypeSuggestions";
import { ABUSE_TYPES } from "@/lib/abuse-types";
import { UPLOAD_LIMITS, checkUploadSize, humanSize } from "@/lib/upload-limits";
import { HubTabs, ARCHIVE_TABS } from "@/components/HubTabs";

export const Route = createFileRoute("/_authenticated/evidence")({
  component: EvidencePage,
});

interface EvidenceRow {
  id: string;
  title: string;
  date: string;
  description: string | null;
  file_url: string;
  file_type: string;
  linked_incident_id: string | null;
  preservation_status?: string | null;
  integrity_verified_at?: string | null;
  exif_captured_at?: string | null;
  sha256?: string | null;
  review_status?: string | null;
}
// review_status: "suggested" rows are held back from exports/attorney views
// until the survivor confirms the match on /evidence-review.
interface IncOption {
  id: string;
  date: string;
  description: string;
}

type EvidenceTab = "documentation" | "evidence";

// Documentation vs Evidence classifier. Evidence = anything with device
// metadata intact (EXIF), a verified integrity hash, or official preservation
// status. Everything else — screenshots without EXIF, message-thread exports,
// personal notes — is Documentation: still preserved, still useful, but not
// yet independently verifiable.
function classifyEvidence(r: EvidenceRow): EvidenceTab {
  if (r.integrity_verified_at) return "evidence";
  if (r.exif_captured_at) return "evidence";
  if (
    r.preservation_status &&
    r.preservation_status !== "pending" &&
    r.preservation_status !== "unknown"
  )
    return "evidence";
  return "documentation";
}

type ExtractedDraft = {
  date: string | null;
  time: string | null;
  location: string | null;
  description: string | null;
  abuse_types: string[] | null;
  witnesses: string | null;
  emotional_impact: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

function KindIcon({ kind, size = 22 }: { kind: string; size?: number }) {
  const c = { color: "var(--foreground)" };
  if (kind === "image") return <ImageIcon size={size} style={c} />;
  if (kind === "audio") return <Music size={size} style={c} />;
  if (kind === "video") return <Video size={size} style={c} />;
  return <FileText size={size} style={c} />;
}

function EvidencePage() {
  const { user } = useAuth();
  const extractFn = useServerFn(extractIncidentFromImage);
  const ingestFn = useServerFn(ingestEvidenceBatch);
  const [items, setItems] = useState<EvidenceRow[]>([]);
  const [incidents, setIncidents] = useState<IncOption[]>([]);
  const [pending, setPending] = useState<File | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");
  const [linkedId, setLinkedId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // AI review state — keyed to the most recently uploaded evidence row
  const [reviewFor, setReviewFor] = useState<EvidenceRow | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExtractedDraft | null>(null);
  const [savingIncident, setSavingIncident] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<EvidenceRow | null>(null);
  const [tab, setTab] = useState<EvidenceTab>("documentation");

  const load = useCallback(async () => {
    if (!user) return;
    const [ev, inc] = await Promise.all([
      supabase
        .from("evidence")
        .select(
          "id,title,date,description,file_url,file_type,linked_incident_id,preservation_status,integrity_verified_at,exif_captured_at,sha256,review_status",
        )
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("incidents")
        .select("id,date,description")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("date", { ascending: false }),
    ]);
    const rows = (ev.data as EvidenceRow[] | null) ?? [];
    setItems(rows);
    setIncidents((inc.data as IncOption[] | null) ?? []);
    // signed URLs
    const urls: Record<string, string> = {};
    await Promise.all(
      rows.map(async (r) => {
        const { data } = await supabase.storage
          .from("evidence-files")
          .createSignedUrl(r.file_url, 3600);
        if (data?.signedUrl) urls[r.id] = data.signedUrl;
      }),
    );
    setPreviewUrls(urls);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const onFile = (f: File | null) => {
    if (!f) {
      setPending(null);
      setSizeError(null);
      return;
    }
    const problem = checkUploadSize(f);
    if (problem) {
      setSizeError(problem);
      setPending(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setSizeError(null);
    setPending(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pending || !title.trim()) return;
    setBusy(true);
    const ext = pending.name.split(".").pop() ?? "bin";
    const key = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await supabase.storage.from("evidence-files").upload(key, pending);
    if (up.error) {
      setBusy(false);
      toast("We couldn't upload that. Try again in a moment.");
      return;
    }

    let receiptItem;
    try {
      const receipt = await ingestFn({
        data: {
          files: [
            {
              storage_key: key,
              original_filename: pending.name,
              mime: pending.type || "application/octet-stream",
              bytes: pending.size,
            },
          ],
        },
      });
      receiptItem = receipt.items[0];
    } catch {
      setBusy(false);
      toast("Saved the file but couldn't record the details.");
      return;
    }
    if (!receiptItem || !receiptItem.evidence_id) {
      setBusy(false);
      toast(receiptItem?.message ?? "Saved the file but couldn't record the details.");
      return;
    }
    // Apply form-supplied fields on top of the freshly-preserved row.
    const upd = await supabase
      .from("evidence")
      .update({
        title: title.trim(),
        date,
        description: description || null,
        linked_incident_id: linkedId || null,
      })
      .eq("id", receiptItem.evidence_id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    setBusy(false);
    if (upd.error || !upd.data) {
      toast("Saved the file but couldn't record the details.");
      return;
    }
    const newRow = upd.data as EvidenceRow;
    if (receiptItem.duplicate_of) {
      toast(
        `Exact duplicate of "${receiptItem.duplicate_of_title ?? "an earlier file"}" — preserved and grouped.`,
      );
    } else {
      toast("Saved. Your record is safe.");
    }

    // Reset form + reload
    const wasImageOrPdf = pending.type.startsWith("image/") || pending.type === "application/pdf";
    const fileMime = pending.type;
    setPending(null);
    setTitle("");
    setDate(today());
    setDescription("");
    setLinkedId("");
    if (inputRef.current) inputRef.current.value = "";
    await load();

    // Auto-run AI extraction for images / PDFs that aren't linked yet
    if (wasImageOrPdf && !newRow.linked_incident_id) {
      void runReview(newRow, fileMime);
    }
  };

  const runReview = useCallback(
    async (row: EvidenceRow, mime?: string) => {
      setReviewFor(row);
      setDraft(null);
      setReviewError(null);
      setReviewBusy(true);
      try {
        const signed = await supabase.storage
          .from("evidence-files")
          .createSignedUrl(row.file_url, 600);
        if (!signed.data?.signedUrl) {
          setReviewError("We couldn't open that file to review it.");
          return;
        }
        const guessedMime =
          mime ??
          (row.file_type === "image"
            ? "image/jpeg"
            : row.file_type === "document"
              ? "application/pdf"
              : "");
        if (!guessedMime) {
          setReviewError("Only images and PDFs can be reviewed by AI right now.");
          return;
        }
        const res = await extractFn({
          data: { signedUrl: signed.data.signedUrl, mimeType: guessedMime },
        });
        if (!res.ok) {
          setReviewError(
            res.reason === "unsupported-format"
              ? "Only images and PDFs can be reviewed by AI right now."
              : "The AI couldn't read this one. You can still add an incident by hand.",
          );
          return;
        }
        const ex = (res.extracted ?? {}) as Partial<ExtractedDraft>;
        setDraft({
          date: ex.date ?? row.date ?? null,
          time: ex.time ?? null,
          location: ex.location ?? null,
          description: ex.description ?? "",
          abuse_types: Array.isArray(ex.abuse_types) ? ex.abuse_types : [],
          witnesses: ex.witnesses ?? null,
          emotional_impact: ex.emotional_impact ?? null,
        });
      } catch {
        setReviewError("Something went wrong. You can still add an incident by hand.");
      } finally {
        setReviewBusy(false);
      }
    },
    [extractFn],
  );

  const closeReview = () => {
    setReviewFor(null);
    setDraft(null);
    setReviewError(null);
    setReviewBusy(false);
  };

  const saveDraftAsIncident = async () => {
    if (!user || !reviewFor || !draft) return;
    if (!draft.description?.trim()) {
      toast("Add a short description before saving.");
      return;
    }
    setSavingIncident(true);
    const ins = await supabase
      .from("incidents")
      .insert({
        user_id: user.id,
        date: draft.date ?? today(),
        time: draft.time,
        location: draft.location,
        description: draft.description.trim(),
        abuse_types: draft.abuse_types ?? [],
        witnesses: draft.witnesses,
        emotional_impact: draft.emotional_impact,
        source: "ai_extracted",
        source_evidence_id: reviewFor.id,
        confirmed_at: null,
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      setSavingIncident(false);
      toast("We couldn't save that as an incident.");
      return;
    }
    await supabase
      .from("evidence")
      .update({ linked_incident_id: ins.data.id })
      .eq("id", reviewFor.id)
      .eq("user_id", user.id);
    setSavingIncident(false);
    toast("Mark saved and linked to this evidence.");
    closeReview();
    load();
  };

  const remove = async (item: EvidenceRow) => {
    if (!user) return;
    setConfirmDelete(item);
  };

  const doRemove = async () => {
    if (!user || !confirmDelete) return;
    const item = confirmDelete;
    setConfirmDelete(null);
    const { error } = await supabase
      .from("evidence")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("user_id", user.id);
    if (error) {
      toast("We couldn't remove that. Try again in a moment.");
      return;
    }
    setItems((prev) => prev.filter((r) => r.id !== item.id));
    toast("Removed.", {
      action: {
        label: "Undo",
        onClick: async () => {
          await supabase
            .from("evidence")
            .update({ deleted_at: null })
            .eq("id", item.id)
            .eq("user_id", user.id);
          load();
        },
      },
      duration: 8000,
    });
  };

  return (
    <div>
      <HubTabs tabs={ARCHIVE_TABS} />
      <div className="label-eyebrow">Evidence</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Keep the proof <em>close.</em>
      </h1>

      <Link
        to="/import-messages"
        className="mt-5 flex items-start gap-3 rounded-2xl p-4"
        style={{
          background: "var(--pp-card)",
          boxShadow: "var(--pp-shadow-sm)",
          color: "var(--foreground)",
          textDecoration: "none",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 18,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <MessageSquare size={18} color="#3D2C5C" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1A1714" }}>
            Import Messages from screenshots
          </div>
          <div style={{ fontSize: 13, color: "#3D3832", marginTop: 2, lineHeight: 1.5 }}>
            Add screenshots of a text conversation in any order. They&apos;re read here on your
            device — no app can open your phone&apos;s Messages history, so this works from your own
            screenshots.
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#4132B4" }}>Open →</span>
      </Link>

      <Link
        to="/message-threads"
        className="mt-3 flex items-start gap-3 rounded-2xl p-4"
        style={{
          background: "var(--pp-card)",
          border: "1px solid rgba(124,92,196,0.22)",
          color: "var(--foreground)",
          textDecoration: "none",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 18,
            background: "transparent",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <MessageSquare size={18} color="#3D2C5C" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1A1714" }}>
            Upload a Message Thread
          </div>
          <div style={{ fontSize: 13, color: "#3D3832", marginTop: 2, lineHeight: 1.5 }}>
            Import iPhone, iMessage, or SMS exports (PDF, CSV/Excel, TXT, RSMF, ZIP) into a
            searchable, flagged timeline.
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#4132B4" }}>Open →</span>
      </Link>

      <BatchDropzone onDone={load} />
      <ContentTypeSuggestions />

      <FocusRegion id="evidence-add">
        <form onSubmit={submit} className="card-pp mt-6 space-y-4">
          <label
            className="block cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center"
            style={{ borderColor: "var(--border)" }}
          >
            <Upload
              size={26}
              className="mx-auto mb-2"
              style={{ color: "var(--muted-foreground)" }}
            />
            <div className="font-serif text-[16px]">
              {pending ? pending.name : "Drop a file here, or tap to choose"}
            </div>
            <div className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Images, PDF, audio, video · up to {humanSize(UPLOAD_LIMITS.document)} for photos and
              documents, {humanSize(UPLOAD_LIMITS.video)} for video
            </div>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,application/pdf,audio/mpeg,audio/mp4,audio/wav,audio/x-m4a,video/mp4"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {sizeError && (
            <div
              className="rounded-2xl px-3 py-2 text-[13px]"
              style={{
                background: "var(--tint-purple)",
                boxShadow: "var(--pp-shadow-sm)",
                color: "var(--foreground)",
                lineHeight: 1.5,
              }}
            >
              {sizeError}
            </div>
          )}
          {pending && (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label-eyebrow">Title</label>
                <input
                  className="input-pp mt-1"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="label-eyebrow">Date</label>
                <input
                  type="date"
                  className="input-pp mt-1"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label-eyebrow">Description</label>
                <textarea
                  className="input-pp mt-1"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this show?"
                />
              </div>
              <div className="md:col-span-2">
                <label className="label-eyebrow">Link to incident (optional)</label>
                <select
                  className="input-pp mt-1"
                  value={linkedId}
                  onChange={(e) => setLinkedId(e.target.value)}
                >
                  <option value="">— None —</option>
                  {incidents.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.date} · {i.description.slice(0, 60)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <button type="submit" disabled={busy} className="btn-primary">
                  {busy ? "Saving…" : "Add to Evidence"}
                </button>
              </div>
            </div>
          )}
        </form>
      </FocusRegion>

      <FocusRegion id="evidence-library">
        <div className="mt-8">
          {(() => {
            const docItems = items.filter((r) => classifyEvidence(r) === "documentation");
            const evItems = items.filter((r) => classifyEvidence(r) === "evidence");
            const shown = tab === "documentation" ? docItems : evItems;
            return (
              <>
                <div className="flex flex-col gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTab("documentation")}
                      className="rounded-2xl px-4 py-1.5 text-[13px] font-semibold"
                      style={{
                        background:
                          tab === "documentation" ? "var(--foreground)" : "rgba(255,255,255,0.55)",
                        color: tab === "documentation" ? "#FFFDD0" : "var(--foreground)",
                        border:
                          tab === "documentation"
                            ? "1px solid var(--foreground)"
                            : "1px solid rgba(0,0,0,0.10)",
                      }}
                    >
                      Documentation · {docItems.length}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("evidence")}
                      className="rounded-2xl px-4 py-1.5 text-[13px] font-semibold"
                      style={{
                        background:
                          tab === "evidence" ? "var(--foreground)" : "rgba(255,255,255,0.55)",
                        color: tab === "evidence" ? "#FFFDD0" : "var(--foreground)",
                        border:
                          tab === "evidence"
                            ? "1px solid var(--foreground)"
                            : "1px solid rgba(0,0,0,0.10)",
                      }}
                    >
                      Evidence · {evItems.length}
                    </button>
                  </div>
                  <p
                    className="text-[12px]"
                    style={{ color: "var(--muted-foreground)", lineHeight: 1.5 }}
                  >
                    {tab === "documentation"
                      ? "Your records — screenshots, notes, and message-thread exports. Preserved and searchable, but not yet independently verified. Items move to Evidence automatically when device metadata (EXIF) or an integrity hash is confirmed."
                      : "Files with intact device metadata, verified integrity hashes, or official-record status. These carry more evidentiary weight in court because their origin and authenticity can be independently checked."}
                  </p>
                </div>
                {shown.length === 0 ? (
                  <div className="card-pp">
                    <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
                      {tab === "documentation"
                        ? "Nothing here yet. Screenshots, voice memos, message exports — anything that captures what happened belongs here first."
                        : "Nothing here yet. Photos taken directly with your phone camera (EXIF intact) and files with verified integrity checks will show up here."}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {shown.map((it) => {
                      const url = previewUrls[it.id];
                      const linked = incidents.find((i) => i.id === it.linked_incident_id);
                      return (
                        <div key={it.id} className="card-pp">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <KindIcon kind={it.file_type} />
                              <div className="font-serif text-[15px] leading-tight">{it.title}</div>
                            </div>
                          </div>
                          <div className="label-eyebrow mt-2">
                            {new Date(it.date).toLocaleDateString()}
                          </div>
                          {it.review_status === "suggested" && (
                            <div
                              className="mt-2 rounded-2xl p-2 text-[12px]"
                              style={{ background: "rgba(231,208,163,0.4)", color: "#5a3a12" }}
                            >
                              Held back from court packets and anything you share with an attorney
                              until you review the suggested match.{" "}
                              <Link to="/evidence-review" style={{ textDecoration: "underline" }}>
                                Review it now
                              </Link>
                            </div>
                          )}
                          {it.file_type === "image" && url && (
                            <img
                              src={url}
                              alt={it.title}
                              className="mt-3 max-h-48 w-full rounded-2xl object-cover"
                            />
                          )}
                          {it.file_type === "audio" && url && (
                            <audio controls src={url} className="mt-3 w-full" />
                          )}
                          {it.file_type === "video" && url && (
                            <video
                              controls
                              src={url}
                              className="mt-3 max-h-48 w-full rounded-2xl"
                            />
                          )}
                          {it.description && (
                            <p className="mt-2 text-[13px]" style={{ color: "var(--foreground)" }}>
                              {it.description}
                            </p>
                          )}
                          {linked && (
                            <div className="mt-2 text-[12px]" style={{ color: "var(--accent)" }}>
                              Linked: {linked.date}
                            </div>
                          )}
                          <div className="mt-3 flex items-center gap-2">
                            {url && (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                download
                                className="btn-ghost inline-flex items-center gap-1 text-[12px]"
                              >
                                <Download size={13} /> Open
                              </a>
                            )}
                            {(it.file_type === "image" || it.file_type === "document") &&
                              !it.linked_incident_id && (
                                <button
                                  onClick={() => runReview(it)}
                                  className="btn-ghost inline-flex items-center gap-1 text-[12px]"
                                >
                                  <Sparkles size={13} /> AI review
                                </button>
                              )}
                            <button
                              onClick={() => remove(it)}
                              className="btn-ghost inline-flex items-center gap-1 text-[12px]"
                            >
                              <Trash2 size={13} /> Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </FocusRegion>

      {/* AI Review Modal */}
      {reviewFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(26,23,20,0.55)" }}
          onClick={closeReview}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card-pp w-full max-w-2xl"
            style={{ padding: 24, maxHeight: "88vh", overflowY: "auto" }}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="label-eyebrow inline-flex items-center gap-2">
                  <Sparkles size={12} /> AI document review
                </div>
                <div className="mt-1 font-serif text-[22px] leading-tight">
                  Review draft incident
                </div>
                <p className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                  This draft was read from{" "}
                  <span style={{ fontWeight: 600 }}>{reviewFor.title}</span>. Edit anything before
                  saving — nothing is shared until you do.
                </p>
              </div>
              <button onClick={closeReview} className="btn-ghost" style={{ padding: 6 }}>
                ✕
              </button>
            </div>

            {reviewBusy && (
              <div
                className="my-8 text-center text-[14px]"
                style={{ color: "var(--muted-foreground)" }}
              >
                Reading the file…
              </div>
            )}

            {!reviewBusy && reviewError && (
              <div
                className="my-4 rounded-2xl bg-white/40 p-4 text-[13px]"
                style={{ color: "#2A1A10" }}
              >
                {reviewError}
              </div>
            )}

            {!reviewBusy && draft && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field label="Date">
                  <input
                    type="date"
                    className="input-pp"
                    value={draft.date ?? ""}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value || null })}
                  />
                </Field>
                <Field label="Time">
                  <input
                    type="time"
                    className="input-pp"
                    value={draft.time ?? ""}
                    onChange={(e) => setDraft({ ...draft, time: e.target.value || null })}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="What happened">
                    <textarea
                      className="input-pp"
                      rows={4}
                      value={draft.description ?? ""}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Location">
                  <input
                    className="input-pp"
                    value={draft.location ?? ""}
                    onChange={(e) => setDraft({ ...draft, location: e.target.value || null })}
                  />
                </Field>
                <Field label="Witnesses">
                  <input
                    className="input-pp"
                    value={draft.witnesses ?? ""}
                    onChange={(e) => setDraft({ ...draft, witnesses: e.target.value || null })}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Type">
                    <div className="flex flex-wrap gap-2">
                      {ABUSE_TYPES.map((opt) => {
                        const t = opt.value;
                        const active = draft.abuse_types?.includes(t) ?? false;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              const set = new Set(draft.abuse_types ?? []);
                              if (set.has(t)) set.delete(t);
                              else set.add(t);
                              setDraft({ ...draft, abuse_types: Array.from(set) });
                            }}
                            className="rounded-2xl px-3 py-1 text-[12px] font-semibold"
                            style={{
                              background: active ? opt.color : "rgba(255,255,255,0.55)",
                              color: active ? "#FFFFFF" : "#2A1A10",
                              border: active
                                ? `1px solid ${opt.color}`
                                : "1px solid rgba(0,0,0,0.10)",
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {(draft.abuse_types?.length ?? 0) > 0 && (
                      <ul className="mt-2 space-y-1">
                        {ABUSE_TYPES.filter((opt) => draft.abuse_types?.includes(opt.value)).map(
                          (opt) => (
                            <li
                              key={opt.value}
                              className="text-[11px] leading-snug"
                              style={{ color: "#5C4A3E" }}
                            >
                              <span className="font-semibold" style={{ color: opt.color }}>
                                {opt.label}:
                              </span>{" "}
                              {opt.helper}
                            </li>
                          ),
                        )}
                      </ul>
                    )}
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="How it felt (optional)">
                    <textarea
                      className="input-pp"
                      rows={2}
                      value={draft.emotional_impact ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, emotional_impact: e.target.value || null })
                      }
                    />
                  </Field>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button onClick={closeReview} className="btn-ghost">
                Cancel
              </button>
              {!reviewBusy && !draft && !reviewError && reviewFor && (
                <button
                  onClick={() => runReview(reviewFor)}
                  className="btn-primary inline-flex items-center gap-1"
                >
                  <Sparkles size={13} /> Run AI review
                </button>
              )}
              {draft && (
                <button
                  onClick={saveDraftAsIncident}
                  disabled={savingIncident}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Check size={14} /> {savingIncident ? "Saving…" : "Save as incident"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <CognitiveClose
        title="Tie evidence to an incident"
        body="A screenshot becomes much stronger when it sits next to the day it happened. Open your Archive to link them up."
        cta="Go to Archive"
        to="/journal"
      />
      <ConfirmDialog
        open={!!confirmDelete}
        title="Remove this evidence?"
        body="It will be hidden from your library right away. You'll see an Undo option for a few seconds after. The file stays in secure storage until a later cleanup step."
        confirmLabel="Remove"
        cancelLabel="Keep"
        onConfirm={doRemove}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-eyebrow mb-1 block">{label}</label>
      {children}
    </div>
  );
}
