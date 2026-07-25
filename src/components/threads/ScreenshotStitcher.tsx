import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, X, Loader2, Camera } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { stitchScreenshotThread } from "@/lib/message-threads.functions";

interface Props { onDone: () => void; onCancel: () => void; }
interface Shot { id: string; file: File; url: string; }

export function ScreenshotStitcher({ onDone, onCancel }: Props) {
  const { user } = useAuth();
  const stitch = useServerFn(stitchScreenshotThread);
  const [shots, setShots] = useState<Shot[]>([]);
  const [participant, setParticipant] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const inp = useRef<HTMLInputElement | null>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Shot[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 8 * 1024 * 1024) { toast(`Skipped ${f.name} — over 8MB.`); continue; }
      next.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file: f, url: URL.createObjectURL(f) });
    }
    setShots((s) => [...s, ...next]);
  };

  const move = (idx: number, dir: -1 | 1) => {
    setShots((s) => {
      const copy = [...s];
      const j = idx + dir;
      if (j < 0 || j >= copy.length) return copy;
      [copy[idx], copy[j]] = [copy[j]!, copy[idx]!];
      return copy;
    });
  };

  const remove = (idx: number) => setShots((s) => s.filter((_, i) => i !== idx));

  const save = async () => {
    if (!user || shots.length === 0) return;
    setBusy(true);
    try {
      const paths: string[] = [];
      const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      for (let i = 0; i < shots.length; i++) {
        const s = shots[i]!;
        const ext = (s.file.name.match(/\.[^.]+$/)?.[0] ?? ".jpg").toLowerCase();
        const path = `${user.id}/thread-shots/${batchId}/shot-${String(i + 1).padStart(3, "0")}${ext}`;
        const up = await supabase.storage.from("evidence-files").upload(path, s.file, {
          contentType: s.file.type || undefined, upsert: false,
        });
        if (up.error) throw up.error;
        paths.push(path);
      }
      toast("Stitching your screenshots…", { icon: "✨" });
      const res = await stitch({ data: {
        screenshotPaths: paths,
        capturedAt: new Date().toISOString(),
        captureNotes: notes || undefined,
        participantHint: participant || undefined,
      } });
      if (res.status === "parsed") toast.success(`Stitched ${res.messageCount} messages.`);
      else toast("Saved. We couldn't read text from every image — your originals are stored.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ borderRadius: 0, padding: 22, background: "#F7F5F0", border: "1px solid rgba(91,76,214,0.2)" }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="label-eyebrow" style={{ color: "#5B4CD6" }}>Tier 1 · Fastest</div>
          <h3 style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 300, fontSize: 24, color: "#14131F", marginTop: 4 }}>Add screenshots of the thread</h3>
        </div>
        <button type="button" onClick={onCancel} className="text-sm underline" style={{ color: "rgba(20,19,31,0.55)" }}>Cancel</button>
      </div>
      <p style={{ fontSize: 13.5, color: "#3A3849", lineHeight: 1.55, marginBottom: 14 }}>
        Take screenshots as you scroll — a little overlap between them is fine, we&apos;ll stitch them together. The screenshots are your evidence; the extracted text is a searchable index only, labeled <em>AI-extracted — unverified</em>.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="label-eyebrow">Who is this conversation with?</label>
          <input value={participant} onChange={(e) => setParticipant(e.target.value)} className="input-pp mt-1" placeholder="e.g. Alex — ex-partner" />
        </div>
        <div>
          <label className="label-eyebrow">Anything to remember?</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-pp mt-1" placeholder="e.g. from March, before the hearing" />
        </div>
      </div>

      <input ref={inp} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      <button type="button" onClick={() => inp.current?.click()}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 0,
          background: "#5B4CD6", color: "#F7F5F0", fontWeight: 700, fontSize: 13 }}>
        <Camera size={14} /> Add screenshots
      </button>

      {shots.length > 0 && (
        <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
          {shots.map((s, idx) => (
            <div key={s.id} style={{ position: "relative", borderRadius: 0, overflow: "hidden", border: "1px solid rgba(91,76,214,0.2)" }}>
              <img src={s.url} alt={`screenshot ${idx + 1}`} style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,0.55)", color: "#F7F5F0", fontSize: 11, padding: "2px 6px", borderRadius: 6 }}>#{idx + 1}</div>
              <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 4 }}>
                <button type="button" onClick={() => move(idx, -1)} aria-label="Move up" style={{ background: "rgba(255,255,255,0.9)", borderRadius: 6, padding: "1px 6px", fontSize: 12 }}>↑</button>
                <button type="button" onClick={() => move(idx, 1)} aria-label="Move down" style={{ background: "rgba(255,255,255,0.9)", borderRadius: 6, padding: "1px 6px", fontSize: 12 }}>↓</button>
                <button type="button" onClick={() => remove(idx)} aria-label="Remove" style={{ background: "rgba(255,255,255,0.9)", borderRadius: 6, padding: 4 }}><X size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        <button type="button" onClick={save} disabled={busy || shots.length === 0}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 0,
            background: shots.length === 0 ? "rgba(20,19,31,0.22)" : "#5B4CD6",
            color: "#F7F5F0", fontWeight: 700, fontSize: 13,
            opacity: busy ? 0.7 : 1, cursor: busy ? "wait" : "pointer" }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {busy ? "Stitching…" : `Stitch ${shots.length} screenshot${shots.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
