import { useCallback, useRef, useState } from "react";
import { Upload, Check, AlertTriangle, Clock, ShieldCheck, Eye } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  ingestEvidenceBatch,
  confirmNearDuplicate,
  rejectNearDuplicate,
  type PreservationReceipt,
  type PreservationReceiptItem,
} from "@/lib/evidence-ingest.functions";
import { enrichEvidence } from "@/lib/evidence-enrichment.functions";
import { transcribeEvidence } from "@/lib/transcribe-evidence.functions";
import { UPLOAD_LIMITS, checkUploadSize, humanSize } from "@/lib/upload-limits";

type UploadPhase = "queued" | "uploading" | "preserving" | "done" | "error";

type FileState = {
  id: string;
  file: File;
  phase: UploadPhase;
  storageKey?: string;
  message?: string;
};

const MAX_FILES = 50;

function humanBytes(n: number | null | undefined): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusChip({ item }: { item: PreservationReceiptItem }) {
  const map: Record<string, { label: string; bg: string; fg: string; Icon: typeof Check }> = {
    preserved: { label: "Preserved", bg: "rgba(168,216,185,0.35)", fg: "#1f4d33", Icon: ShieldCheck },
    extraction_pending: { label: "Preserved · extraction pending", bg: "rgba(231,208,163,0.5)", fg: "#5a3a12", Icon: Clock },
    unsupported_but_preserved: { label: "Preserved · not previewable", bg: "rgba(231,208,163,0.5)", fg: "#5a3a12", Icon: ShieldCheck },
    needs_attention: { label: "Needs attention", bg: "rgba(231,123,86,0.35)", fg: "#5a1e0c", Icon: AlertTriangle },
    failed: { label: "Not preserved", bg: "rgba(231,123,86,0.35)", fg: "#5a1e0c", Icon: AlertTriangle },
    upload_incomplete: { label: "Upload incomplete", bg: "rgba(231,123,86,0.35)", fg: "#5a1e0c", Icon: AlertTriangle },
  };
  const base = map[item.status] ?? map.preserved;
  const isDup = !!item.duplicate_of;
  const isNear = !isDup && !!item.near_duplicate_of;
  const m = isDup
    ? {
        ...base,
        label: item.duplicate_of_title
          ? `Preserved · exact duplicate of "${item.duplicate_of_title}"`
          : "Preserved · exact duplicate of an existing file",
      }
    : isNear
    ? {
        ...base,
        bg: "rgba(231,208,163,0.5)",
        fg: "#5a3a12",
        Icon: Eye,
        label: item.near_duplicate_of_title
          ? `Preserved · looks similar to "${item.near_duplicate_of_title}" — review when you have a moment`
          : "Preserved · looks similar to an existing file — review when you have a moment",
      }
    : base;
  const Icon = m.Icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: m.bg,
        color: m.fg,
      }}
    >
      <Icon size={12} /> {m.label}
    </span>
  );
}

export function BatchDropzone({ onDone }: { onDone?: () => void }) {
  const { user } = useAuth();
  const ingest = useServerFn(ingestEvidenceBatch);
  const confirmNear = useServerFn(confirmNearDuplicate);
  const rejectNear = useServerFn(rejectNearDuplicate);
  const enrich = useServerFn(enrichEvidence);
  const transcribe = useServerFn(transcribeEvidence);
  const [files, setFiles] = useState<FileState[]>([]);
  const [sizeErrors, setSizeErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<PreservationReceipt | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [nearResolved, setNearResolved] = useState<Record<string, "confirmed" | "rejected">>({});
  const [suggestionCount, setSuggestionCount] = useState<number | null>(null);

  const resolveNear = async (evidenceId: string, action: "confirm" | "reject") => {
    try {
      if (action === "confirm") {
        await confirmNear({ data: { evidence_id: evidenceId } });
        setNearResolved((s) => ({ ...s, [evidenceId]: "confirmed" }));
        toast("Linked with the similar file.");
      } else {
        await rejectNear({ data: { evidence_id: evidenceId } });
        setNearResolved((s) => ({ ...s, [evidenceId]: "rejected" }));
        toast("Kept as a separate file.");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save that. Try again in a moment.");
    }
  };

  const addFiles = useCallback((list: FileList | File[]) => {
    const all = Array.from(list);
    // Filter oversized files out first and explain each one inline, so a single
    // huge file never silently blocks the rest of the batch.
    const oversized: string[] = [];
    const incoming = all.filter((f) => {
      const problem = checkUploadSize(f);
      if (problem) { oversized.push(problem); return false; }
      return true;
    });
    setSizeErrors(oversized);
    if (incoming.length === 0) return;
    setFiles((prev) => {
      const room = MAX_FILES - prev.length;
      if (room <= 0) {
        toast(`You can preserve up to ${MAX_FILES} files at a time.`);
        return prev;
      }
      const next = incoming.slice(0, room).map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${f.name}`,
        file: f,
        phase: "queued" as UploadPhase,
      }));
      if (incoming.length > room) {
        toast(`Added ${room}. ${incoming.length - room} skipped — batch limit is ${MAX_FILES}.`);
      }
      return [...prev, ...next];
    });
  }, []);

  const removeFile = (id: string) => setFiles((f) => f.filter((x) => x.id !== id));
  const clearAll = () => { setFiles([]); setReceipt(null); setSizeErrors([]); };

  const preserveAll = async () => {
    if (!user || files.length === 0 || busy) return;
    setBusy(true);
    setReceipt(null);

    const toIngest: { storage_key: string; original_filename: string; mime: string; bytes: number }[] = [];
    const updates: FileState[] = [...files];

    for (let i = 0; i < updates.length; i++) {
      const item = updates[i];
      if (item.phase !== "queued") continue;
      updates[i] = { ...item, phase: "uploading" };
      setFiles([...updates]);

      const ext = item.file.name.split(".").pop() ?? "bin";
      const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
      const key = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
      const up = await supabase.storage
        .from("evidence-files")
        .upload(key, item.file, { upsert: false, contentType: item.file.type || undefined });
      if (up.error) {
        updates[i] = { ...item, phase: "error", message: "Upload failed." };
        setFiles([...updates]);
        continue;
      }
      updates[i] = { ...item, phase: "preserving", storageKey: key };
      setFiles([...updates]);
      toIngest.push({
        storage_key: key,
        original_filename: item.file.name,
        mime: item.file.type || "application/octet-stream",
        bytes: item.file.size,
      });
    }

    if (toIngest.length === 0) {
      setBusy(false);
      return;
    }

    try {
      const result = await ingest({ data: { files: toIngest } });
      setReceipt(result);
      // Mark each file as done/error using receipt items.
      const byKey = new Map(result.items.map((it) => [it.storage_key, it]));
      setFiles((prev) => prev.map((f) => {
        if (!f.storageKey) return f;
        const r = byKey.get(f.storageKey);
        if (!r) return f;
        return {
          ...f,
          phase: r.status === "failed" ? "error" : "done",
          message: r.message,
        };
      }));
      const ok = result.items.filter((i) => i.status !== "failed").length;
      toast(`Preserved ${ok} of ${result.items.length} file${result.items.length === 1 ? "" : "s"}.`);
      onDone?.();

      // Background: extract EXIF/GPS (quarantined), propose incident matches,
      // and transcribe any audio/video. Never blocks; failures leave the
      // preserved file untouched.
      const preserved = result.items.filter((it) => it.evidence_id);
      let suggested = 0;
      await Promise.all(
        preserved.map(async (it) => {
          try {
            const r = await enrich({ data: { evidence_id: it.evidence_id! } });
            if (r.ok && "suggested_incident_id" in r && r.suggested_incident_id) {
              suggested += 1;
            }
          } catch {
            /* leave preserved but un-enriched */
          }
          const mime = it.mime ?? "";
          if (mime.startsWith("audio/") || mime.startsWith("video/")) {
            try {
              await transcribe({ data: { evidence_id: it.evidence_id! } });
            } catch {
              /* transcript_status stays 'failed' server-side */
            }
          }
        }),
      );
      setSuggestionCount(suggested);
    } catch (err) {
      toast(err instanceof Error ? err.message : "We couldn't finish preserving these files.");
      setFiles((prev) => prev.map((f) => (f.phase === "preserving" ? { ...f, phase: "error", message: "Preservation failed." } : f)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-pp mt-6 space-y-4">
      <div>
        <div className="label-eyebrow">Add what you have</div>
        <h2 className="mt-1 font-serif text-[22px] leading-tight">
          Drop everything in. It doesn't need to be organized.
        </h2>
        <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          Each file is preserved with a SHA-256 fingerprint so you can prove later that the copy we hold matches what you first added. You can add titles, dates, and details afterward.
        </p>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className="block cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center"
        style={{
          borderColor: dragOver ? "var(--accent)" : "var(--border)",
          background: dragOver ? "rgba(231,123,86,0.06)" : "transparent",
        }}
      >
        <Upload size={26} className="mx-auto mb-2" style={{ color: "var(--muted-foreground)" }} />
        <div className="font-serif text-[16px]">
          {files.length > 0 ? `${files.length} file${files.length === 1 ? "" : "s"} queued` : "Drop files here, or tap to choose"}
        </div>
        <div className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          Images, PDFs, audio, video, documents — mix them freely. Up to {MAX_FILES} at once,{" "}
          {humanSize(UPLOAD_LIMITS.document)} per photo or document and{" "}
          {humanSize(UPLOAD_LIMITS.video)} per video.
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </label>

      {sizeErrors.length > 0 && (
        <div
          className="mt-3 space-y-1.5 rounded-xl p-3 text-[13px]"
          style={{
            background: "var(--input)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {sizeErrors.length === 1 ? "One file was too large to add" : `${sizeErrors.length} files were too large to add`}
          </div>
          {sizeErrors.map((m) => (
            <div key={m}>{m}</div>
          ))}
          <button
            type="button"
            onClick={() => setSizeErrors([])}
            className="text-[12px] underline"
            style={{ color: "var(--muted-foreground)" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {files.length > 0 && (
        <>
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl p-2" style={{ background: "var(--input)" }}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]" style={{ fontWeight: 600 }}>{f.file.name}</div>
                  <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {humanBytes(f.file.size)}
                    {f.file.type ? ` · ${f.file.type}` : ""}
                    {f.phase === "uploading" ? " · uploading…" : ""}
                    {f.phase === "preserving" ? " · hashing…" : ""}
                    {f.phase === "done" ? " · preserved" : ""}
                    {f.phase === "error" ? ` · ${f.message ?? "failed"}` : ""}
                  </div>
                </div>
                {f.phase === "queued" && (
                  <button type="button" onClick={() => removeFile(f.id)} className="text-[12px] underline" style={{ color: "var(--muted-foreground)" }}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={preserveAll} disabled={busy || !files.some((f) => f.phase === "queued")} className="btn-primary">
              {busy ? "Preserving…" : `Preserve ${files.filter((f) => f.phase === "queued").length || files.length} file${files.length === 1 ? "" : "s"}`}
            </button>
            <button type="button" onClick={() => inputRef.current?.click()} className="btn-ghost">
              Add more
            </button>
            {!busy && (
              <button type="button" onClick={clearAll} className="btn-ghost">Clear</button>
            )}
          </div>
        </>
      )}

      {receipt && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(168,216,185,0.18)", border: "1px solid rgba(168,216,185,0.6)" }}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} style={{ color: "#1f4d33" }} />
            <div className="font-serif text-[16px]" style={{ color: "#1f4d33" }}>Preservation receipt</div>
          </div>
          <p className="mt-1 text-[12px]" style={{ color: "#2a3d31" }}>
            {new Date(receipt.preserved_at).toLocaleString()} · batch {receipt.batch_id.slice(0, 8)}
          </p>
          <div className="mt-3 space-y-2">
            {receipt.items.map((it) => (
              <div key={it.storage_key} className="rounded-lg p-2" style={{ background: "var(--panel)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]" style={{ fontWeight: 600 }}>{it.original_filename}</div>
                    <div className="mt-0.5 truncate text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                      {it.sha256 ? `sha256 ${it.sha256.slice(0, 16)}… · ${humanBytes(it.bytes)}` : it.message ?? "No fingerprint recorded."}
                    </div>
                  </div>
                  <StatusChip item={it} />
                </div>
                {it.near_duplicate_of && !it.duplicate_of && it.evidence_id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md p-2 text-[12px]" style={{ background: "rgba(231,208,163,0.35)", color: "#5a3a12" }}>
                    {nearResolved[it.evidence_id] === "confirmed" ? (
                      <span>Linked with the similar file — will be grouped together in exports.</span>
                    ) : nearResolved[it.evidence_id] === "rejected" ? (
                      <span>Kept as a separate file.</span>
                    ) : (
                      <>
                        <span className="flex-1">
                          Is this the same as {it.near_duplicate_of_title ? `"${it.near_duplicate_of_title}"` : "the existing file"}?
                        </span>
                        <button type="button" className="btn-ghost text-[12px]" onClick={() => resolveNear(it.evidence_id!, "confirm")}>
                          Yes, same
                        </button>
                        <button type="button" className="btn-ghost text-[12px]" onClick={() => resolveNear(it.evidence_id!, "reject")}>
                          No, different
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-lg p-2 text-[12px]" style={{ background: "rgba(231,208,163,0.35)", color: "#5a3a12" }}>
            <AlertTriangle size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "-2px" }} />
            Do not delete your original source (phone photo, screenshot, email) based only on this import. Keep your originals until you are sure the import is complete.
          </p>
          {suggestionCount !== null && suggestionCount > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg p-3 text-[13px]" style={{ background: "rgba(106,146,214,0.14)", color: "#1f3a68", border: "1px solid rgba(106,146,214,0.35)" }}>
              <div className="flex-1">
                {suggestionCount === 1
                  ? "1 file looks like it might belong to an incident you've already written down."
                  : `${suggestionCount} files look like they might belong to incidents you've already written down.`}
                {" "}Until you review {suggestionCount === 1 ? "it" : "them"}, {suggestionCount === 1 ? "that file stays" : "those files stay"} out of your court packet exports and out of anything an attorney can see. Everything is still safely preserved.
              </div>
              <Link to="/evidence-review" className="btn-ghost text-[12px]">
                Review suggestions
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}