import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, FileText, FileSpreadsheet, FileCode2, FileArchive, FileType2, Shield, Sparkles, AlertTriangle, MessageSquare, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { parseMessageThread } from "@/lib/message-threads.functions";
import { useConfirm } from "@/components/ConfirmDialog";

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
  const parseFn = useServerFn(parseMessageThread);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [busyType, setBusyType] = useState<SourceType | null>(null);
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
    if (file.size > 20 * 1024 * 1024) {
      toast.error("That file is over 20 MB. Try splitting the export.");
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
    }
  };

  const removeThread = async (id: string) => {
    if (!confirm("Delete this conversation? Parsed messages and the original file will be removed.")) return;
    const t = threads.find((x) => x.id === id);
    await supabase.from("message_threads").delete().eq("id", id);
    if (t) await supabase.storage.from("message-exports").remove([t["file_url" as keyof ThreadRow] as unknown as string]).catch(() => null);
    await load();
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="label-eyebrow" style={{ color: "#7C5CC4" }}>Evidence Portal · Conversations</div>
        <h1 style={{ fontFamily: '"Instrument Serif", serif', fontWeight: 400, fontSize: 40, lineHeight: 1.05, color: "#1A1714" }}>
          Upload a Message Thread
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "#3D3832", maxWidth: 720 }}>
          Bring your texts, iMessages, and SMS conversations into PatternProof. We can&apos;t reach into your phone
          for you — you export the messages yourself using a lawful method, and we organize them into a searchable
          timeline with pattern, threat, and escalation flags.
        </p>
      </header>

      {/* Safety notice */}
      <div
        style={{
          display: "flex", gap: 14, padding: 18, borderRadius: 18,
          background: "linear-gradient(135deg, rgba(196,167,255,0.18), rgba(164,255,239,0.18))",
          border: "1px solid rgba(124,92,196,0.25)",
          color: "#1A1714",
        }}
      >
        <Shield size={22} color="#7C5CC4" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14, letterSpacing: "0.02em" }}>
            A note about lawful use
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: "#3D3832" }}>
            Only upload messages from your own device, account, or records you are legally allowed to access.
            PatternProof does not hack, scrape, bypass Apple security, or access another person&apos;s private messages.
            We help you organize what you already have the right to keep.
          </p>
        </div>
      </div>

      {/* Upload cards */}
      <section className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {CARDS.map((c) => {
          const Icon = c.icon;
          const busy = busyType === c.type;
          return (
            <div
              key={c.type}
              style={{
                position: "relative",
                borderRadius: 20,
                padding: 20,
                background: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(124,92,196,0.18)",
                boxShadow: "0 12px 36px -20px rgba(124,92,196,0.35)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                display: "flex", flexDirection: "column", gap: 12,
              }}
            >
              <div
                style={{
                  width: 46, height: 46, borderRadius: 14, display: "grid", placeItems: "center",
                  background: `linear-gradient(135deg, ${c.swatch[0]}, ${c.swatch[1]})`,
                  color: "#3D2C5C",
                }}
              >
                <Icon size={22} color="#3D2C5C" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#1A1714" }}>{c.title}</div>
              <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "#3D3832", flex: 1 }}>{c.blurb}</p>
              <button
                type="button"
                onClick={() => onPick(c.type)}
                disabled={busy}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "10px 14px", borderRadius: 999,
                  background: "linear-gradient(90deg, #7C5CC4, #2F8D85)",
                  color: "#fff", fontWeight: 700, fontSize: 13,
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
      </section>

      {/* Threads list */}
      <section className="flex flex-col gap-4">
        <h2 style={{ fontFamily: '"Instrument Serif", serif', fontWeight: 400, fontSize: 28, color: "#1A1714" }}>
          Your uploaded conversations
        </h2>
        {threads.length === 0 ? (
          <div
            style={{
              padding: 28, borderRadius: 20, textAlign: "center",
              background: "rgba(255,255,255,0.6)",
              border: "1px dashed rgba(124,92,196,0.3)",
              color: "#3D3832", fontSize: 14, lineHeight: 1.6,
            }}
          >
            Nothing here yet. When you&apos;re ready, upload an export above — your file stays private to you.
          </div>
        ) : (
          threads.map((t) => <ThreadCard key={t.id} t={t} onDelete={() => removeThread(t.id)} />)
        )}
      </section>
    </div>
  );
}

function ThreadCard({ t, onDelete }: { t: ThreadRow; onDelete: () => void }) {
  const statusColor =
    t.parse_status === "parsed" ? "#2F8D85"
    : t.parse_status === "queued" ? "#7C5CC4"
    : t.parse_status === "partial" ? "#B88B2A"
    : t.parse_status === "failed" ? "#B0556A"
    : "#7C5CC4";
  return (
    <article
      style={{
        borderRadius: 20, padding: 22,
        background: "rgba(255,255,255,0.75)",
        border: "1px solid rgba(124,92,196,0.18)",
        boxShadow: "0 16px 40px -24px rgba(47,141,133,0.35)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg,#E2DCFA,#C7E9E3)", display: "grid", placeItems: "center" }}>
            <MessageSquare size={18} color="#3D2C5C" />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#1A1714", fontSize: 15 }}>{t.source_filename}</div>
            <div style={{ fontSize: 12, color: "#6B5A4F", letterSpacing: "0.04em", textTransform: "uppercase", marginTop: 2 }}>
              {t.source_type.toUpperCase()} · {new Date(t.created_at).toLocaleDateString()} · {t.message_count} messages
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              padding: "4px 10px", borderRadius: 999,
              background: `${statusColor}1A`, color: statusColor,
            }}
          >
            {t.parse_status}
          </span>
          <button
            type="button" onClick={onDelete} aria-label="Delete"
            style={{ padding: 6, borderRadius: 8, color: "#6B5A4F", background: "transparent" }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </header>

      {t.parse_error && (
        <p style={{ fontSize: 13, color: "#6B5A4F", marginBottom: 12, lineHeight: 1.5 }}>
          <AlertTriangle size={12} style={{ display: "inline", marginRight: 6, color: "#B88B2A" }} />
          {t.parse_error}
        </p>
      )}

      {t.summary && (
        <div style={{ marginBottom: 12 }}>
          <div className="label-eyebrow" style={{ color: "#7C5CC4", marginBottom: 6 }}>Summary</div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#1A1714" }}>{t.summary}</p>
        </div>
      )}

      {t.attorney_summary && (
        <div style={{ marginBottom: 12 }}>
          <div className="label-eyebrow" style={{ color: "#2F8D85", marginBottom: 6 }}>Attorney-ready summary</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "#3D3832" }}>{t.attorney_summary}</p>
        </div>
      )}

      {Array.isArray(t.flags) && t.flags.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="label-eyebrow" style={{ color: "#B0556A", marginBottom: 8 }}>Flags & patterns</div>
          <div className="flex flex-wrap gap-2">
            {t.flags.map((f, i) => (
              <span
                key={i}
                title={f.evidence}
                style={{
                  fontSize: 12, fontWeight: 600,
                  padding: "5px 10px", borderRadius: 999,
                  background: f.severity === "high" ? "#F7DDE3" : f.severity === "medium" ? "#FAEAD3" : "#E4F3EE",
                  color: f.severity === "high" ? "#7E2A3D" : f.severity === "medium" ? "#7A5613" : "#1F5E55",
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
            borderRadius: 12, background: "rgba(124,92,196,0.08)",
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