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
  addSourceDocument,
  deleteMessageImport,
  saveExtractedMessages,
  startMessageImport,
} from "@/lib/message-import.functions";
import {
  groupLinesIntoMessages,
  mergeDuplicates,
  orderMessages,
  extractContactHeader,
  type DraftMessage,
} from "@/lib/ocr/parse";
import { checkUploadSize } from "@/lib/upload-limits";

/** One thing to read: either a screenshot she picked, or a frame we pulled from her recording. */
type Page = { file: File; kind: "screenshot" | "video_frame"; frameTimeSec?: number };

export const Route = createFileRoute("/_authenticated/import-messages")({
  component: ImportMessagesPage,
  head: () => ({
    meta: [
      { title: "Import Messages — PatternProof" },
      {
        name: "description",
        content:
          "Turn screenshots of text conversations into a searchable, chronological record you control.",
      },
      { property: "og:title", content: "Import Messages — PatternProof" },
      {
        property: "og:description",
        content:
          "Turn screenshots of text conversations into a searchable, chronological record you control.",
      },
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
  const [stage, setStage] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<string | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const loadThreads = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("message_threads")
      .select("id,conversation_participant,created_at,import_status,message_count,screenshot_count")
      .eq("user_id", user.id)
      .in("capture_method", ["multi_screenshot", "screen_recording"])
      .order("created_at", { ascending: false });
    setThreads((data as ImportThread[] | null) ?? []);
  }, [user]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const handleFiles = async (files: FileList | null) => {
    if (!user || !files || files.length === 0) return;
    const picked = Array.from(files);
    const tooBig = picked.map((f) => checkUploadSize(f)).filter((m): m is string => !!m);
    tooBig.forEach((m) => toast(m));
    const usable = picked.filter((f) => !checkUploadSize(f));
    const images = usable.filter((f) => f.type.startsWith("image/"));
    const video = usable.find((f) => f.type.startsWith("video/"));
    if (images.length === 0 && !video) {
      toast(
        "Those files weren't images or recordings we can read. Screenshots saved as photos work best.",
      );
      return;
    }

    setPhase("working");
    setDone(0);
    setFound(0);
    setTotal(images.length);
    setStage(null);

    // A recording is read the same way a screenshot is: we pull frames from it
    // here on your device and run the same reader over each one.
    let videoPath: string | undefined;
    let videoDuration: number | undefined;
    let pages: Page[] = images.map((f) => ({ file: f, kind: "screenshot" as const }));

    if (video) {
      try {
        setStage("Reading your recording on this device…");
        const { extractFrames } = await import("@/lib/ocr/frames");
        const frames = await extractFrames(video, {
          onProgress: (d, t) => setStage(`Looking through your recording — ${d} of ${t}`),
        });
        if (frames.length === 0) throw new Error("no frames");
        setStage("Uploading your recording…");
        const vext = (video.name.match(/\.[^.]+$/)?.[0] ?? ".mp4").toLowerCase();
        const vpath = `${user.id}/message-imports/recordings/${Date.now()}${vext}`;
        const vup = await supabase.storage.from("evidence-files").upload(vpath, video, {
          contentType: video.type || undefined,
          upsert: false,
        });
        if (!vup.error) videoPath = vpath;
        const el = document.createElement("video");
        el.preload = "metadata";
        videoDuration = await new Promise<number | undefined>((resolve) => {
          el.onloadedmetadata = () => resolve(Math.round(el.duration || 0));
          el.onerror = () => resolve(undefined);
          el.src = URL.createObjectURL(video);
        });
        pages = [
          ...pages,
          ...frames.map((fr) => ({
            file: fr.file,
            kind: "video_frame" as const,
            frameTimeSec: fr.timeSec,
          })),
        ];
      } catch {
        toast(
          "We couldn't read that recording here in the browser. Screenshots are the surest route.",
        );
      }
    }

    if (pages.length === 0) {
      setPhase("intro");
      setStage(null);
      return;
    }
    setTotal(pages.length);
    setStage(null);

    let threadId: string;
    try {
      const res = await start({
        data: {
          participant: participant || undefined,
          notes: notes || undefined,
          captureMethod: video ? "screen_recording" : "multi_screenshot",
          videoPath,
          videoDurationSec: videoDuration,
          frameIntervalSec: video ? 1.5 : undefined,
        },
      });
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

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]!;
      const file = page.file;
      setCurrentName(file.name);
      const ext = (file.name.match(/\.[^.]+$/)?.[0] ?? ".jpg").toLowerCase();
      const prefix = page.kind === "video_frame" ? "frame" : "shot";
      const path = `${user.id}/message-imports/${threadId}/${prefix}-${String(i + 1).padStart(3, "0")}${ext}`;
      try {
        const up = await supabase.storage.from("evidence-files").upload(path, file, {
          contentType: file.type || undefined,
          upsert: true,
        });
        if (up.error) throw up.error;
        const { sourceDocumentId } = await addDoc({
          data: {
            threadId,
            storagePath: path,
            originalFilename: file.name,
            uploadIndex: i,
            bytes: file.size,
            mime: file.type || undefined,
            kind: page.kind,
            frameTimeSec: page.frameTimeSec,
          },
        });
        docIds.push(sourceDocumentId);

        const read = await recognizeImage(file);
        if (!headerName) headerName = extractContactHeader(read.lines, read.height);
        const drafts = groupLinesIntoMessages(read.lines, read.width, read.height, i);
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
        await saveMsgs({
          data: {
            threadId,
            processedCount: i + 1,
            complete: i === pages.length - 1,
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
                source_document_ids: Array.from(
                  new Set(
                    m.source_indices.map((idx) => docIds[idx]).filter((v): v is string => !!v),
                  ),
                ),
              })),
          },
        });
      } catch {
        toast(
          "We couldn't save that step. Your screenshots are stored — we'll try again on the next one.",
        );
      }
      setDone(i + 1);
    }

    await terminateOcr().catch(() => undefined);
    setCurrentName(null);
    setPhase("intro");
    setStage(null);
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
        Add screenshots of a conversation in any order — or a screen recording of you scrolling
        through it. We read them here on your device, put them in order, and let you fix anything we
        got wrong.
      </p>

      <input
        ref={fileInput}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="mt-8 space-y-6">
        {phase === "working" ? (
          <>
            {stage && (
              <p className="text-[13.5px]" style={{ color: "rgba(26,18,36,0.62)" }}>
                {stage}
              </p>
            )}
            <OcrProgress done={done} total={total} currentName={currentName} found={found} />
          </>
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
                  style={{
                    background: "var(--pp-card)",
                    boxShadow: "var(--pp-shadow-sm)",
                    borderRadius: 18,
                    padding: "10px 12px",
                  }}
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
                    style={{ padding: 8, color: "rgba(26,18,36,0.6)" }}
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
          <p className="mb-3 mt-1 text-[13.5px]" style={{ color: "rgba(26,18,36,0.62)" }}>
            Every message sits beside the screenshot it came from. Change anything — we keep the
            original reading alongside your correction, never instead of it.
          </p>
          <ReviewThread userId={user.id} threads={threads} initialThreadId={activeThread} />
        </section>

        <section
          style={{
            background: "var(--pp-ground)",
            boxShadow: "var(--pp-shadow-sm)",
            borderRadius: 18,
            padding: 16,
          }}
        >
          <span className="exhibit-tag">COMING LATER</span>
          <p className="mt-2 text-[13.5px]" style={{ color: "rgba(26,18,36,0.65)" }}>
            Later we&apos;ll add importing exported chat files and pasted text. Screenshots and
            screen recordings are read entirely on your device — nothing on this page is sent to an
            AI.
          </p>
        </section>
      </div>
    </div>
  );
}
