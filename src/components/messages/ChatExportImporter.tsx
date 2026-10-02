import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  addSourceDocument,
  appendChatExportMessages,
  deleteMessageImport,
  finishChatExportImport,
  startMessageImport,
} from "@/lib/message-import.functions";
import { parseChatExport, type ChatParseResult, type DateOrder } from "@/lib/chat-export/parse";
import { buildDayDigest, describeDay } from "@/lib/chat-export/digest";
import {
  ChatExportReadError,
  readChatExportFile,
  sha256Hex,
  type ChatExportFile,
} from "@/lib/chat-export/read-file";
import { createDraftsFromChatDays } from "@/lib/chat-day-drafts.functions";
import { createDraftsFromChatMessages } from "@/lib/chat-message-drafts.functions";
import { extractChatExportMedia } from "@/lib/chat-export/zip-media";
import { ingestEvidenceBatch } from "@/lib/evidence-ingest.functions";
import { ensureMediaUploadDrafts } from "@/lib/upload-draft.functions";
import { extractEvidenceDocument } from "@/lib/document-extract.functions";
import { isReadableDocument } from "@/lib/readable-documents";
import { checkUploadSize } from "@/lib/upload-limits";

const CHUNK = 500;
const MUTED = "rgba(26,18,36,0.62)";

interface Props {
  onImported: (threadId: string) => void;
}

type Stage = "idle" | "reading" | "preview" | "saving" | "done";

export function ChatExportImporter({ onImported }: Props) {
  const { user } = useAuth();
  const start = useServerFn(startMessageImport);
  const addDoc = useServerFn(addSourceDocument);
  const append = useServerFn(appendChatExportMessages);
  const finish = useServerFn(finishChatExportImport);
  const removeImport = useServerFn(deleteMessageImport);
  const makeDayDrafts = useServerFn(createDraftsFromChatDays);
  const makeMessageDrafts = useServerFn(createDraftsFromChatMessages);
  const ingest = useServerFn(ingestEvidenceBatch);
  const ensureDrafts = useServerFn(ensureMediaUploadDrafts);
  const extractDoc = useServerFn(extractEvidenceDocument);

  const input = useRef<HTMLInputElement | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [picked, setPicked] = useState<File | null>(null);
  const [file, setFile] = useState<ChatExportFile | null>(null);
  const [parsed, setParsed] = useState<ChatParseResult | null>(null);
  const [dateOrder, setDateOrder] = useState<DateOrder | undefined>(undefined);
  const [me, setMe] = useState<string>("");
  const [saved, setSaved] = useState(0);
  const [onlyOvernight, setOnlyOvernight] = useState(false);
  const [shown, setShown] = useState(60);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [pickedDays, setPickedDays] = useState<Set<string>>(new Set());
  const [drafting, setDrafting] = useState(false);
  const [draftsMade, setDraftsMade] = useState(0);
  const [mediaDraftsMade, setMediaDraftsMade] = useState(0);
  const [preservingMedia, setPreservingMedia] = useState(false);
  /** one_per_message is the Grace path; one_per_day kept as the shorter list. */
  const [draftMode, setDraftMode] = useState<"one_per_message" | "one_per_day">("one_per_message");

  const reparse = (f: ChatExportFile, order?: DateOrder) =>
    setParsed(parseChatExport(f.text, { dateOrder: order }));

  const pick = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const tooBig = checkUploadSize(f);
    if (tooBig) {
      toast(`${tooBig} Exporting the chat "without media" gives a small text file.`);
      return;
    }
    setStage("reading");
    try {
      const read = await readChatExportFile(f);
      const result = parseChatExport(read.text);
      setPicked(f);
      setFile(read);
      setParsed(result);
      setDateOrder(undefined);
      setMe("");
      setSaved(0);
      setStage("preview");
    } catch (e) {
      toast(e instanceof ChatExportReadError ? e.message : "We couldn't read that file.");
      setStage("idle");
    }
  };

  const chooseOrder = (order: DateOrder) => {
    if (!file) return;
    setDateOrder(order);
    reparse(file, order);
  };

  const people = parsed?.participants ?? [];
  const canImport = !!parsed && parsed.messages.length > 0 && !!me;

  const doImport = async () => {
    if (!user || !picked || !file || !parsed || !canImport) return;
    setStage("saving");
    setSaved(0);
    let threadId: string | null = null;
    try {
      const other = people.find((p) => p.name !== me)?.name ?? null;
      const provenance = [
        `Imported from an exported chat file (SHA-256 ${file.sha256}).`,
        `Dates read ${parsed.dateOrder === "dmy" ? "day-first" : parsed.dateOrder === "ymd" ? "year-first" : "month-first"}${parsed.dateOrderAssumed ? " (assumed — the file did not settle it)" : ""}.`,
        `File: "${file.originalFilename.slice(0, 120)}"${file.transcriptEntry ? ` (read ${file.transcriptEntry.slice(0, 60)})` : ""}.`,
      ]
        .filter(Boolean)
        .join(" ");

      const res = await start({
        data: {
          participant: other ?? undefined,
          notes: provenance, // ≤ ~390 chars: hash 64 + two capped names
          captureMethod: "backup_export",
          sourceType: file.sourceType,
          sourceFilename: file.originalFilename,
        },
      });
      threadId = res.threadId;

      // Preserve the original exactly as given, then record its fingerprint.
      const ext = (file.originalFilename.match(/\.[^.]+$/)?.[0] ?? ".txt").toLowerCase();
      const path = `${user.id}/message-imports/${threadId}/original-export${ext}`;
      // Re-hash the bytes we are about to store. If the file changed on disk
      // since it was read, stop: the saved copy must match the fingerprint.
      const original = await picked.arrayBuffer();
      if ((await sha256Hex(original)) !== file.sha256) {
        throw new Error("file changed after it was read");
      }
      // Not evidence-files: that bucket only accepts images, PDFs, audio and video.
      const up = await supabase.storage.from("message-exports").upload(path, original, {
        contentType: file.mime,
        upsert: false,
      });
      if (up.error) throw up.error;
      const { sourceDocumentId } = await addDoc({
        data: {
          threadId,
          storagePath: path,
          originalFilename: file.originalFilename,
          uploadIndex: 0,
          bytes: file.bytes,
          mime: file.mime,
          kind: "chat_export",
          sha256: file.sha256,
        },
      });

      const rows = parsed.messages.map((m) => ({
        sender: m.sender,
        sender_side:
          m.kind === "call_record"
            ? ("unknown" as const)
            : m.sender === me
              ? ("outgoing" as const)
              : ("incoming" as const),
        sent_on: m.sent_on,
        sent_at_time: m.sent_at_time,
        body: m.body,
        has_attachment_marker: m.has_attachment_marker,
        attachment_marker_text: m.attachment_marker_text,
      }));
      for (let i = 0; i < rows.length; i += CHUNK) {
        await append({
          data: {
            threadId,
            sourceDocumentId,
            startPosition: i + 1,
            messages: rows.slice(i, i + CHUNK),
          },
        });
        setSaved(Math.min(i + CHUNK, rows.length));
      }
      await finish({
        data: { threadId, storagePath: path, messageCount: rows.length, participant: other },
      });
      setThreadId(threadId);
      setPickedDays(new Set());
      setDraftsMade(0);
      setStage("done");
      toast("Saved. Your original file is kept exactly as you gave it.");
      onImported(threadId);
    } catch {
      // Never leave half a conversation behind.
      if (threadId) await removeImport({ data: { threadId } }).catch(() => undefined);
      toast(
        "We couldn't finish that import, so nothing was kept. Your file is untouched — try again.",
      );
      setStage("preview");
    }
  };

  const toggleDay = (date: string) =>
    setPickedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

  const countSelectedMessages = useMemo(() => {
    if (!parsed || pickedDays.size === 0) return 0;
    return parsed.messages.filter((m) => m.sent_on && pickedDays.has(m.sent_on)).length;
  }, [parsed, pickedDays]);

  /** Soft drafts for photos inside an export zip — same path as Evidence uploads. */
  const preserveZipPhotos = async () => {
    if (!user || !picked || !file || file.sourceType !== "zip" || preservingMedia) return;
    setPreservingMedia(true);
    try {
      const extracted = await extractChatExportMedia(picked, { maxItems: 40, imagesOnly: true });
      if (extracted.items.length === 0) {
        toast(
          extracted.skipped > 0
            ? "Those photos were too large to add from the zip. Add them from Evidence if you need them."
            : "No photos were found inside that zip.",
        );
        return;
      }
      const toIngest: Array<{
        storage_key: string;
        original_filename: string;
        mime: string;
        bytes: number;
      }> = [];
      for (const item of extracted.items) {
        const ext = (item.filename.match(/\.([^.]+)$/)?.[1] ?? "bin").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
        const key = `${user.id}/chat-export-media/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const up = await supabase.storage.from("evidence-files").upload(key, item.blob, {
          contentType: item.mime,
          upsert: false,
        });
        if (up.error) continue;
        toIngest.push({
          storage_key: key,
          original_filename: item.filename,
          mime: item.mime,
          bytes: item.bytes,
        });
      }
      if (toIngest.length === 0) {
        toast("We couldn't preserve those photos. Try adding them from Evidence.");
        return;
      }
      const receipt = await ingest({ data: { files: toIngest } });
      const evidenceIds = receipt.items
        .map((it) => it.evidence_id)
        .filter((id): id is string => Boolean(id));
      let softQueued = 0;
      if (evidenceIds.length > 0) {
        try {
          const soft = await ensureDrafts({ data: { evidence_ids: evidenceIds } });
          if (soft.ok) softQueued = soft.queued;
        } catch {
          /* drafts are a convenience */
        }
        // OCR after soft drafts are queued — never a gate (same as #134).
        await Promise.all(
          receipt.items.map(async (it) => {
            if (!it.evidence_id) return;
            if (!isReadableDocument(it.mime, it.original_filename)) return;
            try {
              await extractDoc({ data: { evidence_id: it.evidence_id } });
            } catch {
              /* extraction_status stays failed server-side */
            }
          }),
        );
      }
      setMediaDraftsMade((n) => n + softQueued);
      toast(
        softQueued > 0
          ? `${softQueued} photo draft${softQueued === 1 ? "" : "s"} added to Drafts to review. Reading text in the photos runs in the background — nothing is on your timeline until you approve.`
          : `Preserved ${evidenceIds.length} photo${evidenceIds.length === 1 ? "" : "s"} from the zip. Check Drafts to review if any are waiting.`,
      );
    } catch {
      toast("We couldn't add those photos from the zip. Your chat import is still saved.");
    } finally {
      setPreservingMedia(false);
    }
  };

  const draftSelected = async () => {
    if (!threadId || pickedDays.size === 0) return;
    setDrafting(true);
    try {
      const days = [...pickedDays].sort();
      let created = 0;
      let existing = 0;
      if (draftMode === "one_per_day") {
        for (let i = 0; i < days.length; i += 100) {
          const r = await makeDayDrafts({ data: { threadId, days: days.slice(i, i + 100) } });
          created += r.created;
          existing += r.skippedExisting;
        }
        setDraftsMade((n) => n + created);
        setPickedDays(new Set());
        toast(
          created > 0
            ? `${created} draft${created === 1 ? "" : "s"} added to Drafts to review (one per day). Nothing is on your timeline until you approve it.${existing ? ` ${existing} day${existing === 1 ? " was" : "s were"} already drafted.` : ""}`
            : "Those days already have drafts waiting.",
        );
      } else {
        // Per-message: chunk by day batches, then offset through long days.
        for (let i = 0; i < days.length; i += 20) {
          const dayChunk = days.slice(i, i + 20);
          let offset = 0;
          let guard = 0;
          while (guard < 200) {
            guard++;
            const r = await makeMessageDrafts({
              data: { threadId, days: dayChunk, offset, limit: 100 },
            });
            created += r.created;
            existing += r.skippedExisting;
            if (!r.hasMore) break;
            offset = r.nextOffset;
          }
        }
        setDraftsMade((n) => n + created);
        setPickedDays(new Set());
        toast(
          created > 0
            ? `${created} draft${created === 1 ? "" : "s"} added to Drafts to review (one per message). Nothing is on your timeline until you approve it.${existing ? ` ${existing} already had a draft.` : ""}`
            : "Those messages already have drafts waiting.",
        );
      }
    } catch {
      toast("We couldn't create those drafts. Try again in a moment.");
    } finally {
      setDrafting(false);
    }
  };

  const digest = useMemo(() => (parsed ? buildDayDigest(parsed.messages) : []), [parsed]);
  const visibleDays = useMemo(
    () => (onlyOvernight ? digest.filter((d) => d.overnight > 0) : digest),
    [digest, onlyOvernight],
  );

  return (
    <div className="card-pp" style={{ padding: 22 }}>
      <span className="exhibit-tag">EXPORTED CHAT</span>
      <h2 className="mt-3 font-serif" style={{ fontSize: 22, lineHeight: 1.2 }}>
        Add a whole conversation <em>in one go.</em>
      </h2>
      <p className="mt-2" style={{ fontSize: 14, lineHeight: 1.6, color: MUTED }}>
        In WhatsApp, open the chat → ⋮ / contact name → <strong>Export chat</strong>. Prefer{" "}
        <strong>Without media</strong> for a small file, or <strong>Include media</strong> when you
        want photos from the zip kept as evidence drafts too. We read it on your device, put every
        message on its date, and keep your original file exactly as it was.
      </p>

      <input
        ref={input}
        type="file"
        accept=".txt,.zip,text/plain,application/zip"
        hidden
        onChange={(e) => {
          pick(e.target.files);
        }}
      />

      {(stage === "idle" || stage === "done") && (
        <button
          type="button"
          onClick={() => {
            if (input.current) input.current.value = "";
            input.current?.click();
          }}
          className="btn-primary mt-4 inline-flex w-full items-center justify-center gap-2 sm:w-auto"
          style={{ padding: "14px 22px", fontSize: 15, minHeight: 50 }}
        >
          <FileText size={18} /> Add an exported chat
        </button>
      )}

      {stage === "reading" && (
        <p className="mt-4" style={{ fontSize: 14, color: MUTED }}>
          Reading your file…
        </p>
      )}

      {(stage === "preview" || stage === "saving") && file && parsed && (
        <div className="mt-5 space-y-4">
          {parsed.messages.length === 0 ? (
            <p style={{ fontSize: 14 }}>{parsed.warnings[0]}</p>
          ) : (
            <>
              <p style={{ fontSize: 14.5 }}>
                Found <strong>{parsed.messages.length.toLocaleString()}</strong> messages
                {parsed.firstDate && parsed.lastDate ? (
                  <>
                    {" "}
                    from <strong>{parsed.firstDate}</strong> to <strong>{parsed.lastDate}</strong>
                  </>
                ) : null}
                .
              </p>

              <fieldset>
                <legend className="label-eyebrow">Which of these is you?</legend>
                <div className="mt-2 space-y-1">
                  {people.map((p) => (
                    <label
                      key={p.name}
                      className="flex items-center gap-2"
                      style={{ fontSize: 14 }}
                    >
                      <input
                        type="radio"
                        name="chat-me"
                        checked={me === p.name}
                        onChange={() => setMe(p.name)}
                      />
                      {p.name}
                      <span className="mono-meta mono-meta--muted">
                        {p.count.toLocaleString()} messages
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {parsed.dateOrderAssumed && (
                <div
                  style={{
                    background: "var(--pp-ground)",
                    borderRadius: 14,
                    padding: 12,
                    fontSize: 13.5,
                  }}
                >
                  <strong>Check the dates.</strong> This file writes dates like 03/04/24 and
                  doesn&apos;t say whether that&apos;s March 4 or April 3. Right now it reads{" "}
                  <strong>{parsed.firstDate}</strong> as the first day.
                  <div className="mt-2 flex gap-2">
                    {(["mdy", "dmy"] as const).map((o) => (
                      <button
                        key={o}
                        type="button"
                        className="pp-btn-secondary"
                        aria-pressed={(dateOrder ?? parsed.dateOrder) === o}
                        onClick={() => chooseOrder(o)}
                        style={{
                          padding: "8px 14px",
                          fontWeight: (dateOrder ?? parsed.dateOrder) === o ? 700 : 400,
                        }}
                      >
                        {o === "mdy" ? "Month first (US)" : "Day first"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {parsed.warnings
                .filter((w) => !w.startsWith("Dates like"))
                .map((w) => (
                  <p key={w} style={{ fontSize: 13.5, color: MUTED }}>
                    {w}
                  </p>
                ))}

              {(parsed.systemLines.length > 0 || file.skippedMediaCount > 0) && (
                <p style={{ fontSize: 13, color: MUTED }}>
                  {parsed.systemLines.length > 0 &&
                    `${parsed.systemLines.length} line${parsed.systemLines.length === 1 ? "" : "s"} written by the app itself (such as the encryption notice) ${parsed.systemLines.length === 1 ? "was" : "were"} not added as messages. `}
                  {file.skippedMediaCount > 0 &&
                    `${file.skippedMediaCount} photo/video/audio file${file.skippedMediaCount === 1 ? "" : "s"} in the zip ${file.skippedMediaCount === 1 ? "was" : "were"} not imported — add them from Evidence if you need them. `}
                  Messages that mention an attachment are kept, marked as attachments.
                </p>
              )}

              <p className="flex gap-2" style={{ fontSize: 13, color: MUTED }}>
                <ShieldCheck size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>
                  Your original file is saved unchanged with a SHA-256 fingerprint (
                  <span className="mono-meta">{file.sha256.slice(0, 12)}…</span>). That proves the
                  saved file matches this one — not that the chat was untouched before you added it.
                  Nothing here is sent to an AI.
                </span>
              </p>

              <button
                type="button"
                disabled={!canImport || stage === "saving"}
                onClick={doImport}
                className="btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto"
                style={{
                  padding: "14px 22px",
                  fontSize: 15,
                  minHeight: 50,
                  opacity: !canImport || stage === "saving" ? 0.6 : 1,
                }}
              >
                {stage === "saving"
                  ? `Saving ${saved.toLocaleString()} of ${parsed.messages.length.toLocaleString()}…`
                  : me
                    ? `Import ${parsed.messages.length.toLocaleString()} messages`
                    : "Choose which one is you to continue"}
              </button>
            </>
          )}
        </div>
      )}

      {stage === "done" && parsed && digest.length > 0 && (
        <div className="mt-5">
          <h3 className="font-serif" style={{ fontSize: 18 }}>
            Turn messages into drafts
          </h3>
          <p className="mt-1" style={{ fontSize: 13, color: MUTED }}>
            Counts and times only — exactly what the file says. Soft drafts only: nothing reaches
            your timeline until you approve it, and it stays private until you share.
          </p>
          <label className="mt-2 flex items-center gap-2" style={{ fontSize: 13.5 }}>
            <input
              type="checkbox"
              checked={onlyOvernight}
              onChange={(e) => {
                setOnlyOvernight(e.target.checked);
                setShown(60);
              }}
            />
            Only days with messages between midnight and 6 AM
          </label>
          <fieldset className="mt-3">
            <legend className="label-eyebrow">How should drafts be made?</legend>
            <div className="mt-2 space-y-1.5" style={{ fontSize: 13.5 }}>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="chat-draft-mode"
                  style={{ marginTop: 3 }}
                  checked={draftMode === "one_per_message"}
                  onChange={() => setDraftMode("one_per_message")}
                />
                <span>
                  <strong>One draft per message</strong> — each message becomes its own draft with
                  its transcript text so you can review and copy what you need.
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="chat-draft-mode"
                  style={{ marginTop: 3 }}
                  checked={draftMode === "one_per_day"}
                  onChange={() => setDraftMode("one_per_day")}
                />
                <span>
                  <strong>One draft per day</strong> — shorter list; quotes that day&apos;s messages
                  together.
                </span>
              </label>
            </div>
          </fieldset>
          <p className="mt-3" style={{ fontSize: 13, color: MUTED }}>
            Tick the days you want to work with
            {draftMode === "one_per_message" && countSelectedMessages > 0
              ? ` (${countSelectedMessages.toLocaleString()} messages on selected days)`
              : ""}
            .
          </p>
          {file?.sourceType === "zip" && (file.skippedMediaCount ?? 0) > 0 && (
            <div
              className="mt-3"
              style={{
                background: "var(--pp-ground)",
                borderRadius: 14,
                padding: 12,
                fontSize: 13.5,
              }}
            >
              <p style={{ margin: 0 }}>
                This zip also has about {file.skippedMediaCount} photo/video/audio file
                {file.skippedMediaCount === 1 ? "" : "s"}. You can preserve the photos as evidence
                drafts the same way other photo uploads work — reading text in them runs after the
                draft is queued.
              </p>
              <button
                type="button"
                className="pp-btn-secondary mt-2"
                style={{ padding: "8px 14px" }}
                disabled={preservingMedia}
                onClick={preserveZipPhotos}
              >
                {preservingMedia
                  ? "Preserving photos…"
                  : "Keep photos from this zip as drafts to review"}
              </button>
              {mediaDraftsMade > 0 && (
                <p className="mt-2" style={{ fontSize: 13, color: MUTED, margin: 0 }}>
                  {mediaDraftsMade} photo draft{mediaDraftsMade === 1 ? "" : "s"} queued.
                </p>
              )}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="pp-btn-secondary"
              style={{ padding: "6px 12px" }}
              onClick={() => setPickedDays(new Set(visibleDays.map((d) => d.date)))}
            >
              Tick all {visibleDays.length} shown
            </button>
            <button
              type="button"
              className="pp-btn-secondary"
              style={{ padding: "6px 12px" }}
              disabled={pickedDays.size === 0}
              onClick={() => setPickedDays(new Set())}
            >
              Clear
            </button>
          </div>
          <ul className="mt-3 space-y-1.5">
            {visibleDays.slice(0, shown).map((d) => (
              <li key={d.date} style={{ fontSize: 13.5 }}>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    style={{ marginTop: 3 }}
                    checked={pickedDays.has(d.date)}
                    onChange={() => toggleDay(d.date)}
                  />
                  <span>
                    <span className="mono-meta" style={{ marginRight: 8 }}>
                      {d.date}
                    </span>
                    {describeDay(d, me)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {visibleDays.length > shown && (
            <button
              type="button"
              className="pp-btn-secondary mt-3"
              style={{ padding: "8px 14px" }}
              onClick={() => setShown((n) => n + 60)}
            >
              Show more days ({visibleDays.length - shown} left)
            </button>
          )}
          <div
            className="mt-4 flex flex-wrap items-center gap-3"
            style={{ position: "sticky", bottom: 8 }}
          >
            <button
              type="button"
              className="btn-primary"
              disabled={pickedDays.size === 0 || drafting}
              onClick={draftSelected}
              style={{
                padding: "12px 18px",
                fontSize: 14.5,
                opacity: pickedDays.size === 0 || drafting ? 0.6 : 1,
              }}
            >
              {drafting
                ? "Creating drafts…"
                : pickedDays.size === 0
                  ? "Tick days to make drafts"
                  : draftMode === "one_per_message"
                    ? `Make ${countSelectedMessages.toLocaleString()} message draft${countSelectedMessages === 1 ? "" : "s"} to review`
                    : `Make ${pickedDays.size} day draft${pickedDays.size === 1 ? "" : "s"} to review`}
            </button>
            {draftsMade > 0 && (
              <Link to="/drafts" style={{ fontSize: 14, textDecoration: "underline" }}>
                Review {draftsMade} draft{draftsMade === 1 ? "" : "s"}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
