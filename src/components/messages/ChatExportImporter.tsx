import { useMemo, useRef, useState } from "react";
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
        In WhatsApp, open the chat → ⋮ / contact name → <strong>Export chat</strong> →{" "}
        <strong>Without media</strong>. Add the .txt (or .zip) file here. We read it on your device,
        put every message on its date, and keep your original file exactly as it was.
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
            Day by day
          </h3>
          <p className="mt-1" style={{ fontSize: 13, color: MUTED }}>
            Counts and times only — exactly what the file says.
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
          <ul className="mt-3 space-y-1.5">
            {visibleDays.slice(0, shown).map((d) => (
              <li key={d.date} style={{ fontSize: 13.5 }}>
                <span className="mono-meta" style={{ marginRight: 8 }}>
                  {d.date}
                </span>
                {describeDay(d, me)}
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
        </div>
      )}
    </div>
  );
}
