import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useConfirm } from "@/components/ConfirmDialog";
import { ImportIntro } from "@/components/messages/ImportIntro";
import { OcrProgress } from "@/components/messages/OcrProgress";
import { ReviewThread, type ImportThread } from "@/components/messages/ReviewThread";
import {
  addSourceDocument, deleteMessageImport, saveExtractedMessages, startMessageImport,
} from "@/lib/message-import.functions";
import { groupLinesIntoMessages, mergeDuplicates, orderMessages, extractContactHeader, type DraftMessage } from "@/lib/ocr/parse";

export const Route = createFileRoute("/_authenticated/import-messages")({
  component: ImportMessagesPage,
  head: () => ({
    meta: [
      { title: "Import Messages — PatternProof" },
      { name: "description", content: "Turn screenshots of text conversations into a searchable, chronological record you control." },
      { property: "og:title", content: "Import Messages — PatternProof" },
      { property: "og:description", content: "Turn screenshots of text conversations into a searchable, chronological record you control." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ImportMessagesPage() {
  const { user } = useAuth();
  const { confirm, dialog } = useConfirm();
  const start = useServerFn(startMessageImport);
  const addDoc = useServerFn(addSourceDocument);
  const saveMsgs = useServerFn(saveExtractedMessages);
  const removeImport = useServerFn(deleteMessageImport);

  const [threads, setThreads] = useState<ImportThread[]>([]);
  const [participant, setParticipant] = useState("");
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<"intro" | "working">("intro");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [found, setFound] = useState(0);
  const [activeThread, setActiveThread] = useState<string | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const loadThreads = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("message_threads")
      .select("id,conversation_participant,created_at,import_status,message_count,screenshot_count")
      .eq("user_id", user.id)
      .eq("capture_method", "multi_screenshot")
      .order("created_at", { ascending: false });
    setThreads((data as ImportThread[] | null) ?? []);
  }, [user]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  const handleFiles = async (files: FileList | null) => {
    if (!user || !files || files.length === 0) return;
    const images = Array.from(files).filter((f) => f.type.startsWith("image/") && f.size <= 12 * 1024 * 1024);
    if (images.length === 0) {
      toast("Those files weren't images we can read. Screenshots saved as photos work best.");
      return;
    }

    setPhase("working");
    setTotal(images.length);
    setDone(0);
    setFound(0);

    let threadId: string;
    try {
      const res = await start({ data: { participant: participant || undefined, notes: notes || undefined } });
      threadId = res.threadId;
    } catch {
      toast("We couldn't start that import. Try again in a moment.");
      setPhase("intro");
      return;
    }
    setActiveThread(threadId);

    const { recognizeImage, terminateOcr } = await import("@/lib/ocr/run");
    const perImage: DraftMessage[][] = [];
    const docIds: string[] = [];
    let headerName: string | null = null;

    for (let i = 0; i < images.length; i++) {
      const file = images[i]!;
      setCurrentName(file.name);
      const ext = (file.name.match(/\.[^.]+$/)?.[0] ?? ".jpg").toLowerCase();
      const path = `${user.id}/message-imports/${threadId}/shot-${String(i + 1).padStart(3, "0")}${ext}`;
      try {
        const up = await supabase.storage.from("evidence-files").upload(path, file, {
          contentType: file.type || undefined, upsert: true,
        });
        if (up.error) throw up.error;
        const { sourceDocumentId } = await addDoc({ data: {
          threadId, storagePath: path, originalFilename: file.name,
          uploadIndex: i, bytes: file.size, mime: file.type || undefined,
        } });
        docIds.push(sourceDocumentId);

        const page = await recognizeImage(file);
        if (!headerName) headerName = extractContactHeader(page.lines, page.height);
        const drafts = groupLinesIntoMessages(page.lines, page.width, page.height, i);
        perImage.push(drafts);
      } catch {
        perImage.push([]);
        docIds.push(docIds[docIds.length - 1] ?? "");
        toast(`We couldn't read ${file.name}. Your original image is still saved.`);
      }

      // Autosave after every image so nothing is lost if the tab closes.
      const mergedSoFar = orderMessages(mergeDuplicates(perImage));
      setFound(mergedSoFar.length);
      try {
        await saveMsgs({ data: {
          threadId,
          processedCount: i + 1,
          complete: i === images.length - 1,
          participant: participant || headerName || null,
          messages: mergedSoFar
            .filter((m) => m.source_indices.some((idx) => docIds[idx]))
            .map((m) => ({
              body: m.body.slice(0, 8000),
              sender_side: m.sender_side,
              sent_on: m.sent_on,
              sent_at_time: m.sent_at_time,
              date_confidence: m.date_confidence,
              has_attachment_marker: m.has_attachment_marker,
              attachment_marker_text: m.attachment_marker_text,
              ocr_confidence: Math.round(m.ocr_confidence * 100) / 100,
              source_document_ids: Array.from(new Set(m.source_indices.map((idx) => docIds[idx]).filter((v): v is string => !!v))),
            })),
        } });
      } catch {
        toast("We couldn't save that step. Your screenshots are stored — we'll try again on the next one.");
      }
      setDone(i + 1);
    }

    await terminateOcr().catch(() => undefined);
    setCurrentName(null);
    setPhase("intro");
    await loadThreads();
    toast("Saved. Your record is safe.");
  };

  const onDelete = async (id: string) => {
    const ok = await confirm({
      title: "Permanently delete this import?",
      body: "This removes the messages, every correction, and the original screenshots from storage. It can't be undone.",
      confirmLabel: "Delete permanently",
    });
    if (!ok) return;
    try {
      await removeImport({ data: { threadId: id } });
      toast("Deleted. Nothing from that import is left.");
      if (activeThread === id) setActiveThread(undefined);
      loadThreads();
    } catch {
      toast("We couldn't delete that. Try again in a moment.");
    }
  };

  if (!user) return null;

  return (
    <div>
      {dialog}
      <div className="label-eyebrow">Evidence · message import</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Screenshots, <em>put in order.</em>
      </h1>
      <p className="mt-3 max-w-2xl text-[15px]" style={{ color: "var(--muted-foreground)" }}>
        Add screenshots of a conversation in any order. We read them here on your device, put them
        in order, and let you fix anything we got wrong.
      </p>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />

      <div className="mt-8 space-y-6">
        {phase === "working" ? (
          <OcrProgress done={done} total={total} currentName={currentName} found={found} />
        ) : (
          <ImportIntro
            participant={participant}
            notes={notes}
            onParticipant={setParticipant}
            onNotes={setNotes}
            onPick={() => fileInput.current?.click()}
            busy={false}
          />
        )}

        {threads.length > 0 && (
          <section>
            <h2 className="font-serif text-[20px]">Your imported conversations</h2>
            <div className="mt-3 space-y-2">
              {threads.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3"
                  style={{ background: "#FFFFFF", border: "1px solid rgba(20,19,31,0.14)", borderRadius: 2, padding: "10px 12px" }}
                >
                  <span style={{ fontSize: 14 }}>
                    {t.conversation_participant || "Untitled conversation"}
                    <span className="mono-meta mono-meta--muted" style={{ marginLeft: 8 }}>
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onDelete(t.id)}
                    aria-label="Permanently delete this import"
                    style={{ padding: 8, color: "rgba(20,19,31,0.6)" }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-serif text-[20px]">Your conversation record</h2>
          <p className="mb-3 mt-1 text-[13.5px]" style={{ color: "rgba(20,19,31,0.62)" }}>
            Every message sits beside the screenshot it came from. Change anything — we keep the
            original reading alongside your correction, never instead of it.
          </p>
          <ReviewThread userId={user.id} threads={threads} initialThreadId={activeThread} />
        </section>

        <section
          style={{ background: "#F7F5F0", border: "1px solid rgba(20,19,31,0.14)", borderRadius: 2, padding: 16 }}
        >
          <span className="exhibit-tag">COMING LATER</span>
          <p className="mt-2 text-[13.5px]" style={{ color: "rgba(20,19,31,0.65)" }}>
            Later we&apos;ll add reading text from screen recordings frame by frame, importing exported
            chat files and pasted text, and optional source-linked pattern observations you turn on
            yourself. None of that is on today, and nothing here is sent to an AI.
          </p>
        </section>
      </div>
    </div>
  );
}