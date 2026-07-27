import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, FileText, FileSpreadsheet, FileCode2, FileArchive, FileType2, Shield, Sparkles, AlertTriangle, MessageSquare, Loader2, Trash2, Camera, Video, Laptop, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { parseMessageThread } from "@/lib/message-threads.functions";
import { useConfirm } from "@/components/ConfirmDialog";
import { ScreenshotStitcher } from "@/components/threads/ScreenshotStitcher";
import { ScreenRecordingUpload } from "@/components/threads/ScreenRecordingUpload";
import { CallLogPhotos } from "@/components/threads/CallLogPhotos";
import { checkUploadSize } from "@/lib/upload-limits";

export const Route = createFileRoute("/_authenticated/message-threads")({
  component: MessageThreadsPage,
});

type SourceType = "pdf" | "csv" | "excel" | "txt" | "rsmf" | "zip";

interface UploadCard {
  type: SourceType;
  title: string;
  blurb: string;
  accept: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  swatch: [string, string];
}

const CARDS: UploadCard[] = [
  {
    type: "pdf",
    title: "PDF Message Export",
    blurb: "Save a chat thread as a PDF from your phone or messaging app and upload it here.",
    accept: "application/pdf,.pdf",
    icon: FileText,
    swatch: ["#E8DEFB", "#C7E9E3"],
  },
  {
    type: "csv",
    title: "CSV / Excel Message Export",
    blurb: "Spreadsheet exports from third-party backup tools (sender, date, message columns).",
    accept: ".csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    icon: FileSpreadsheet,
    swatch: ["#D7F0EA", "#E2DCFA"],
  },
  {
    type: "txt",
    title: "TXT Message Export",
    blurb: "Plain-text chat transcripts copied or exported from your phone.",
    accept: ".txt,text/plain",
    icon: FileType2,
    swatch: ["#EFE4FB", "#D3ECEA"],
  },
  {
    type: "rsmf",
    title: "RSMF Legal Export",
    blurb: "Relativity Short Message Format files produced by lawful forensic export tools.",
    accept: ".rsmf,.json",
    icon: FileCode2,
    swatch: ["#DCEEFB", "#E6DCFB"],
  },
  {
    type: "zip",
    title: "Attachments ZIP",
    blurb: "A zipped folder of message exports plus photos, voice memos, or other attachments.",
    accept: ".zip,application/zip,application/x-zip-compressed",
    icon: FileArchive,
    swatch: ["#D8EAF7", "#EFE4FB"],
  },
];

interface ThreadRow {
  id: string;
  source_type: string;
  source_filename: string;
  conversation_participant: string | null;
  parse_status: string;
  parse_error: string | null;
  message_count: number;
  summary: string | null;
  attorney_summary: string | null;
  flags: Array<{ type: string; label: string; evidence: string; severity: string }>;
  exhibit_label: string | null;
  created_at: string;
  capture_method: string | null;
  captured_at: string | null;
  capture_notes: string | null;
  screenshot_count: number | null;
  video_duration_sec: number | null;
  primary_artifact_urls: string[] | null;
}

function typeForFile(file: File, hint: SourceType): SourceType {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".xls") || name.endsWith(".xlsx")) return "excel";
  if (name.endsWith(".txt")) return "txt";
  if (name.endsWith(".rsmf") || name.endsWith(".json")) return "rsmf";
  if (name.endsWith(".zip")) return "zip";
  return hint;
}

function MessageThreadsPage() {
  const { user } = useAuth();
  const { confirm, dialog } = useConfirm();
  const parseFn = useServerFn(parseMessageThread);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [busyType, setBusyType] = useState<SourceType | null>(null);
  const [tier, setTier] = useState<"picker" | "tier1" | "tier2" | "tier3" | "call_log">("picker");
  const [tier2Notes, setTier2Notes] = useState<string>("");
  const [tier2Participant, setTier2Participant] = useState<string>("");
  const inputs = useRef<Record<SourceType, HTMLInputElement | null>>({
    pdf: null, csv: null, txt: null, rsmf: null, zip: null, excel: null,
  });

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("message_threads")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) { toast.error("Couldn't load your message threads."); return; }
    setThreads((data as unknown as ThreadRow[]) ?? []);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onPick = (cardType: SourceType) => {
    inputs.current[cardType]?.click();
  };

  const onFile = async (cardType: SourceType, file: File | undefined) => {
    if (!user || !file) return;
    const sizeProblem = checkUploadSize(file);
    if (sizeProblem) {
      toast.error(sizeProblem);
      return;
    }
    setBusyType(cardType);
    const resolvedType = typeForFile(file, cardType);
    try {
      const ext = (file.name.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase() || ".bin";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const up = await supabase.storage.from("message-exports").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type || undefined,
      });
      if (up.error) throw up.error;
      const { data: signed, error: signErr } = await supabase.storage
        .from("message-exports").createSignedUrl(path, 60 * 30);
      if (signErr || !signed) throw signErr ?? new Error("signed url failed");

      const { data: inserted, error: insErr } = await supabase
        .from("message_threads")
        .insert({
          user_id: user.id,
          source_type: resolvedType,
          source_filename: file.name,
          file_url: path,
          parse_status: "pending",
          capture_method: "backup_export",
          captured_at: new Date().toISOString(),
          capture_notes: tier2Notes || null,
          conversation_participant: tier2Participant || null,
          primary_artifact_urls: [path],
        })
        .select("id")
        .single();
      if (insErr || !inserted) throw insErr ?? new Error("insert failed");

      toast("Uploaded. Analyzing your conversation…", { icon: "✨" });
      await load();
      const result = await parseFn({
        data: { threadId: inserted.id, signedUrl: signed.signedUrl, sourceType: resolvedType },
      });
      if (result.status === "parsed") {
        toast.success(`Parsed ${result.messageCount} messages.`);
      } else if (result.status === "queued") {
        toast("Saved. Deeper parsing for this format is in development.");
      } else if (result.status === "partial") {
        toast("Stored, but parsing was incomplete.");
      } else {
        toast.error("Parsing failed — your file is safely stored.");
      }
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusyType(null);
      setTier("picker");
      setTier2Notes("");
      setTier2Participant("");
    }
  };

  const removeThread = async (id: string) => {
    const ok = await confirm({
      title: "Delete this conversation?",
      body: "Parsed messages and the original file will be removed.",
      confirmLabel: "Delete",
      cancelLabel: "Keep",
    });
    if (!ok) return;
    const t = threads.find((x) => x.id === id);
    await supabase.from("message_threads").delete().eq("id", id);
    if (t) await supabase.storage.from("message-exports").remove([t["file_url" as keyof ThreadRow] as unknown as string]).catch(() => null);
    await load();
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="label-eyebrow" style={{ color: "#5B4CD6" }}>Evidence Portal · Conversations</div>
        <h1 style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 300, fontSize: 40, lineHeight: 1.05, color: "#14131F" }}>
          Upload a Message Thread
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "#3A3849", maxWidth: 720 }}>
          Three ways to bring a conversation in — pick the one that fits where you are and what you have access to right now.
          There&apos;s no wrong choice. All three land in Documentation first and stay private to you.
        </p>
      </header>

      {/* Safety notice */}
      <div
        style={{
          display: "flex", gap: 14, padding: 18, borderRadius: 0,
          background: "rgba(91,76,214,0.10), rgba(164,255,239,0.18))",
          border: "1px solid rgba(91,76,214,0.25)",
          color: "#14131F",
        }}
      >
        <Shield size={22} color="#5B4CD6" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14, letterSpacing: "0.02em" }}>
            A note about lawful use
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: "#3A3849" }}>
            Only upload messages from your own device, account, or records you are legally allowed to access.
            PatternProof does not hack, scrape, bypass Apple security, or access another person&apos;s private messages.
            We help you organize what you already have the right to keep.
          </p>
        </div>
      </div>

      {tier === "picker" && (
        <section className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <TierCard
            eyebrow="Tier 1 · Fastest"
            title="Take screenshots"
            body="On your own, need this fast. You screenshot the thread as you scroll; we stitch them together and pull out searchable text. Your screenshots stay the primary evidence."
            hint="Best when you're alone and time matters — least re-exposure."
            accent="#5B4CD6"
            Icon={Camera}
            cta="Start with screenshots"
            onClick={() => setTier("tier1")}
          />
          <TierCard
            eyebrow="Tier 2 · Strongest"
            title="Backup with a computer"
            body="You (or an advocate/attorney) sit down with a computer and do a real phone backup, then upload the export. Most court-defensible option — but never required."
            hint="Recommended when you have help or a laptop available."
            accent="#5B4CD6"
            Icon={Laptop}
            cta="Show me how"
            onClick={() => setTier("tier2")}
            recommended
          />
          <TierCard
            eyebrow="Tier 3 · Fallback"
            title="Screen recording"
            body="Only when nothing else works — for hundreds of messages you can't screenshot one by one. The video itself is your evidence; the AI transcript is a searchable index only."
            hint="Takes longer and means more time looking at the conversation."
            accent="#8A5A2E"
            Icon={Video}
            cta="Use screen recording"
            onClick={() => setTier("tier3")}
          />
          <TierCard
            eyebrow="Call log · Photos"
            title="Import your call history"
            body="Screenshots of your Recents / Calls screen. Same photo-based path on iPhone and Android — no special permissions, no computer needed. We read each call row from the images."
            hint="Best for showing frequency, missed calls, and late-night patterns."
            accent="#5B4CD6"
            Icon={Phone}
            cta="Import call log photos"
            onClick={() => setTier("call_log")}
          />
        </section>
      )}

      {tier === "tier1" && <ScreenshotStitcher onDone={() => { setTier("picker"); load(); }} onCancel={() => setTier("picker")} />}
      {tier === "tier3" && <ScreenRecordingUpload onDone={() => { setTier("picker"); load(); }} onCancel={() => setTier("picker")} />}
      {tier === "call_log" && <CallLogPhotos onDone={() => { setTier("picker"); load(); }} onCancel={() => setTier("picker")} />}

      {tier === "tier2" && (
        <section style={{ borderRadius: 0, padding: 22, background: "#F7F5F0", border: "1px solid rgba(91,76,214,0.25)" }} className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="label-eyebrow" style={{ color: "#5B4CD6" }}>Tier 2 · Strongest</div>
              <h3 style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 300, fontSize: 24, color: "#14131F", marginTop: 4 }}>Backup export walkthrough</h3>
            </div>
            <button type="button" onClick={() => setTier("picker")} className="text-sm underline" style={{ color: "rgba(20,19,31,0.55)" }}>Back</button>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <StepCard n="1" title="iPhone (Finder or iTunes)" body="Connect your iPhone to a Mac or PC. Use Finder (macOS) or iTunes (Windows) to make an encrypted local backup. Then use a reputable tool like iMazing or Decipher TextMessage to export your messages as a PDF, CSV, or TXT file." />
            <StepCard n="2" title="Android (Google Takeout or backup app)" body="Sign in to Google Takeout on a computer and export SMS/Chats — or use a reputable Android backup app that produces an export file. Save the export somewhere you can find it." />
            <StepCard n="3" title="Upload the export below" body="Any of the file formats below work. All uploads are private to you; nothing is shared unless you choose to." />
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label className="label-eyebrow">Who is this conversation with?</label>
              <input value={tier2Participant} onChange={(e) => setTier2Participant(e.target.value)} className="input-pp mt-1" placeholder="e.g. Alex — ex-partner" />
            </div>
            <div>
              <label className="label-eyebrow">Anything to remember?</label>
              <input value={tier2Notes} onChange={(e) => setTier2Notes(e.target.value)} className="input-pp mt-1" placeholder="e.g. iPhone, Finder backup, laptop present" />
            </div>
          </div>

          {/* Existing file-format cards, reused as the Tier-2 uploaders */}
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {CARDS.map((c) => {
          const Icon = c.icon;
          const busy = busyType === c.type;
          return (
            <div
              key={c.type}
              style={{
                position: "relative",
                borderRadius: 0,
                padding: 20,
                background: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(91,76,214,0.18)",
                boxShadow: "none",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                display: "flex", flexDirection: "column", gap: 12,
              }}
            >
              <div
                style={{
                  width: 46, height: 46, borderRadius: 0, display: "grid", placeItems: "center",
                  background: `rgba(91,76,214,0.10)`,
                  color: "#3D2C5C",
                }}
              >
                <Icon size={22} color="#3D2C5C" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#14131F" }}>{c.title}</div>
              <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "#3A3849", flex: 1 }}>{c.blurb}</p>
              <button
                type="button"
                onClick={() => onPick(c.type)}
                disabled={busy}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "10px 14px", borderRadius: 0,
                  background: "#5B4CD6",
                  color: "#F7F5F0", fontWeight: 700, fontSize: 13,
                  opacity: busy ? 0.7 : 1, cursor: busy ? "wait" : "pointer",
                }}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {busy ? "Uploading…" : "Choose file"}
              </button>
              <input
                ref={(el) => { inputs.current[c.type] = el; }}
                type="file"
                accept={c.accept}
                hidden
                onChange={(e) => onFile(c.type, e.target.files?.[0] ?? undefined)}
              />
            </div>
          );
        })}
          </div>
        </section>
      )}

      {/* Threads list */}
      <section className="flex flex-col gap-4">
        <h2 style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 300, fontSize: 28, color: "#14131F" }}>
          Your uploaded conversations
        </h2>
        {threads.length === 0 ? (
          <div
            style={{
              padding: 28, borderRadius: 0, textAlign: "center",
              background: "rgba(255,255,255,0.6)",
              border: "1px dashed rgba(91,76,214,0.3)",
              color: "#3A3849", fontSize: 14, lineHeight: 1.6,
            }}
          >
            Nothing here yet. When you&apos;re ready, upload an export above — your file stays private to you.
          </div>
        ) : (
          threads.map((t) => <ThreadCard key={t.id} t={t} onDelete={() => removeThread(t.id)} />)
        )}
      </section>
      {dialog}
    </div>
  );
}

function ThreadCard({ t, onDelete }: { t: ThreadRow; onDelete: () => void }) {
  const captureLabel = t.capture_method === "multi_screenshot"
    ? `📱 Multi-screenshot · ${t.screenshot_count ?? 0} images`
    : t.capture_method === "screen_recording"
      ? `🎬 Screen recording${t.video_duration_sec ? ` · ${Math.round(t.video_duration_sec / 60)} min` : ""}`
      : t.capture_method === "backup_export"
        ? "💻 Backup export"
        : null;
  const statusColor =
    t.parse_status === "parsed" ? "#5B4CD6"
    : t.parse_status === "queued" ? "#5B4CD6"
    : t.parse_status === "partial" ? "#B88B2A"
    : t.parse_status === "failed" ? "#8A5A2E"
    : "#5B4CD6";
  return (
    <article
      style={{
        borderRadius: 0, padding: 22,
        background: "rgba(255,255,255,0.75)",
        border: "1px solid rgba(91,76,214,0.18)",
        boxShadow: "none",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {captureLabel && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11,
          padding: "4px 10px", borderRadius: 0, marginBottom: 10,
          background: "rgba(26,23,20,0.06)", color: "#3A3849", fontWeight: 600, letterSpacing: "0.03em",
        }}>
          How this was captured · {captureLabel}
          {t.captured_at && <span style={{ opacity: 0.7 }}> · {new Date(t.captured_at).toLocaleString()}</span>}
        </div>
      )}
      {(t.capture_method === "multi_screenshot" || t.capture_method === "screen_recording") && (
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
          color: "#8A5A2E", marginBottom: 8 }}>
          AI-{t.capture_method === "screen_recording" ? "generated" : "extracted"} — unverified
        </div>
      )}
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div style={{ width: 38, height: 38, borderRadius: 0, background: "rgba(91,76,214,0.10)", display: "grid", placeItems: "center" }}>
            <MessageSquare size={18} color="#3D2C5C" />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#14131F", fontSize: 15 }}>{t.source_filename}</div>
            <div style={{ fontSize: 12, color: "rgba(20,19,31,0.55)", letterSpacing: "0.04em", textTransform: "uppercase", marginTop: 2 }}>
              {t.source_type.toUpperCase()} · {new Date(t.created_at).toLocaleDateString()} · {t.message_count} messages
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              padding: "4px 10px", borderRadius: 0,
              background: `${statusColor}1A`, color: statusColor,
            }}
          >
            {t.parse_status}
          </span>
          <button
            type="button" onClick={onDelete} aria-label="Delete"
            style={{ padding: 6, borderRadius: 8, color: "rgba(20,19,31,0.55)", background: "transparent" }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </header>

      {t.parse_error && (
        <p style={{ fontSize: 13, color: "rgba(20,19,31,0.55)", marginBottom: 12, lineHeight: 1.5 }}>
          <AlertTriangle size={12} style={{ display: "inline", marginRight: 6, color: "#B88B2A" }} />
          {t.parse_error}
        </p>
      )}

      {t.summary && (
        <div style={{ marginBottom: 12 }}>
          <div className="label-eyebrow" style={{ color: "#5B4CD6", marginBottom: 6 }}>Summary</div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#14131F" }}>{t.summary}</p>
        </div>
      )}

      {t.attorney_summary && (
        <div style={{ marginBottom: 12 }}>
          <div className="label-eyebrow" style={{ color: "#5B4CD6", marginBottom: 6 }}>Attorney-ready summary</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "#3A3849" }}>{t.attorney_summary}</p>
        </div>
      )}

      {Array.isArray(t.flags) && t.flags.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="label-eyebrow" style={{ color: "#8A5A2E", marginBottom: 8 }}>Flags & patterns</div>
          <div className="flex flex-wrap gap-2">
            {t.flags.map((f, i) => (
              <span
                key={i}
                title={f.evidence}
                style={{
                  fontSize: 12, fontWeight: 600,
                  padding: "5px 10px", borderRadius: 0,
                  background: f.severity === "high" ? "#F7DDE3" : f.severity === "medium" ? "#FAEAD3" : "#E4F3EE",
                  color: f.severity === "high" ? "#8A5A2E" : f.severity === "medium" ? "#8A5A2E" : "#0F6E56",
                }}
              >
                {f.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {t.exhibit_label && (
        <div
          style={{
            marginTop: 14, padding: "10px 14px",
            borderRadius: 0, background: "rgba(91,76,214,0.08)",
            fontSize: 12.5, color: "#3D2C5C", fontWeight: 600, letterSpacing: "0.02em",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}
        >
          <Sparkles size={13} /> {t.exhibit_label}
        </div>
      )}
    </article>
  );
}

function TierCard({ eyebrow, title, body, hint, accent, Icon, cta, onClick, recommended }: {
  eyebrow: string; title: string; body: string; hint: string; accent: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  cta: string; onClick: () => void; recommended?: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
      style={{
        position: "relative", textAlign: "left",
        borderRadius: 0, padding: 22,
        background: "#F7F5F0",
        border: `1px solid ${accent}44`,
        boxShadow: "none",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
      {recommended && (
        <span style={{ position: "absolute", top: 12, right: 12, fontSize: 10, fontWeight: 800,
          letterSpacing: "0.1em", textTransform: "uppercase", color: accent,
          background: `${accent}18`, padding: "3px 8px", borderRadius: 0 }}>Recommended</span>
      )}
      <div style={{ width: 44, height: 44, borderRadius: 0, background: `${accent}18`, display: "grid", placeItems: "center" }}>
        <Icon size={20} color={accent} />
      </div>
      <div className="label-eyebrow" style={{ color: accent }}>{eyebrow}</div>
      <div style={{ fontWeight: 700, fontSize: 17, color: "#14131F" }}>{title}</div>
      <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "#3A3849" }}>{body}</p>
      <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "rgba(20,19,31,0.55)", fontStyle: "italic" }}>{hint}</p>
      <span style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: accent }}>{cta} →</span>
    </button>
  );
}

function StepCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div style={{ borderRadius: 0, padding: 14, background: "rgba(255,255,255,0.6)", border: "1px solid rgba(91,76,214,0.2)" }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", color: "#5B4CD6", marginBottom: 6 }}>STEP {n}</div>
      <div style={{ fontWeight: 700, color: "#14131F", fontSize: 14, marginBottom: 4 }}>{title}</div>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: "#3A3849" }}>{body}</p>
    </div>
  );
}