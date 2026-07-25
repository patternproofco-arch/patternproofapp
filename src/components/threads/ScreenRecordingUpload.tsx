import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, Video, AlertTriangle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ingestRecordedThread } from "@/lib/message-threads.functions";

interface Props { onDone: () => void; onCancel: () => void; }

export function ScreenRecordingUpload({ onDone, onCancel }: Props) {
  const { user } = useAuth();
  const ingest = useServerFn(ingestRecordedThread);
  const [file, setFile] = useState<File | null>(null);
  const [participant, setParticipant] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const inp = useRef<HTMLInputElement | null>(null);

  const save = async () => {
    if (!user || !file) return;
    if (file.size > 200 * 1024 * 1024) { toast.error("Video is over 200 MB. Try a shorter recording."); return; }
    setBusy(true);
    try {
      const ext = (file.name.match(/\.[^.]+$/)?.[0] ?? ".mp4").toLowerCase();
      const path = `${user.id}/thread-recordings/${Date.now()}${ext}`;
      const up = await supabase.storage.from("evidence-files").upload(path, file, {
        contentType: file.type || undefined, upsert: false,
      });
      if (up.error) throw up.error;

      // Best-effort duration via HTMLVideoElement
      let duration: number | undefined;
      try {
        duration = await new Promise<number>((resolve, reject) => {
          const v = document.createElement("video");
          v.preload = "metadata";
          v.onloadedmetadata = () => resolve(Math.round(v.duration || 0));
          v.onerror = () => reject(new Error("meta"));
          v.src = URL.createObjectURL(file);
        });
      } catch { /* ignore */ }

      toast("Uploaded. Your video is the primary record.", { icon: "🎬" });
      await ingest({ data: {
        videoPath: path,
        filename: file.name,
        durationSec: duration,
        capturedAt: new Date().toISOString(),
        captureNotes: notes || undefined,
        participantHint: participant || undefined,
      } });
      toast.success("Saved. A searchable transcript will appear shortly.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ borderRadius: 20, padding: 22, background: "rgba(255,255,255,0.8)", border: "1px solid rgba(176,85,106,0.25)" }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="label-eyebrow" style={{ color: "#B0556A" }}>Tier 3 · Fallback</div>
          <h3 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 24, color: "#1A1714", marginTop: 4 }}>Upload a screen recording</h3>
        </div>
        <button type="button" onClick={onCancel} className="text-sm underline" style={{ color: "#6B5A4F" }}>Cancel</button>
      </div>

      <div style={{ display: "flex", gap: 12, padding: 14, borderRadius: 14,
        background: "rgba(176,85,106,0.08)", border: "1px solid rgba(176,85,106,0.2)", marginBottom: 14 }}>
        <AlertTriangle size={20} color="#B0556A" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13.5, color: "#3D3832", lineHeight: 1.55 }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: "#7E2A3D" }}>Before you record</div>
          Screen recording means more time looking at the conversation. If you can, the <strong>screenshots</strong> option is faster and gentler.
          Only use this when nothing else works — for example, when there are hundreds of messages to scroll through.
          Your video file is what counts as evidence. The AI transcript we generate from it is only a searchable index, labeled <em>AI-generated — unverified</em>.
          <label className="mt-3 flex items-center gap-2" style={{ fontSize: 13 }}>
            <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
            I understand — this is the fallback option.
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="label-eyebrow">Who is this conversation with?</label>
          <input value={participant} onChange={(e) => setParticipant(e.target.value)} className="input-pp mt-1" placeholder="e.g. Alex — ex-partner" />
        </div>
        <div>
          <label className="label-eyebrow">Anything to remember?</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-pp mt-1" placeholder="e.g. recorded on iPhone 15" />
        </div>
      </div>

      <input ref={inp} type="file" accept="video/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => inp.current?.click()} disabled={!acknowledged}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 999,
            background: acknowledged ? "#1A1714" : "#C9C0BC", color: "#fff", fontWeight: 700, fontSize: 13,
            cursor: acknowledged ? "pointer" : "not-allowed" }}>
          <Video size={14} /> {file ? "Choose different video" : "Choose video"}
        </button>
        {file && <span style={{ fontSize: 13, color: "#3D3832" }}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span>}
      </div>

      <div className="mt-5 flex items-center justify-end">
        <button type="button" onClick={save} disabled={busy || !file || !acknowledged}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999,
            background: (!file || !acknowledged) ? "#C9C0BC" : "linear-gradient(90deg,#B0556A,#7C5CC4)",
            color: "#fff", fontWeight: 700, fontSize: 13,
            opacity: busy ? 0.7 : 1, cursor: busy ? "wait" : "pointer" }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {busy ? "Uploading…" : "Save recording"}
        </button>
      </div>
    </div>
  );
}
