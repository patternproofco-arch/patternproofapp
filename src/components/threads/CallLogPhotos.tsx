import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, X, Loader2, Phone } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { parseCallLogPhotos } from "@/lib/message-threads.functions";

interface Props {
  onDone: () => void;
  onCancel: () => void;
}
interface Shot {
  id: string;
  file: File;
  url: string;
}

export function CallLogPhotos({ onDone, onCancel }: Props) {
  const { user } = useAuth();
  const parseFn = useServerFn(parseCallLogPhotos);
  const [shots, setShots] = useState<Shot[]>([]);
  const [platform, setPlatform] = useState<"iphone" | "android" | "unknown">("iphone");
  const [participant, setParticipant] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const inp = useRef<HTMLInputElement | null>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Shot[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 8 * 1024 * 1024) {
        toast(`Skipped ${f.name} — over 8MB.`);
        continue;
      }
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        url: URL.createObjectURL(f),
      });
    }
    setShots((s) => [...s, ...next]);
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
        const path = `${user.id}/call-log/${batchId}/photo-${String(i + 1).padStart(3, "0")}${ext}`;
        const up = await supabase.storage.from("evidence-files").upload(path, s.file, {
          contentType: s.file.type || undefined,
          upsert: false,
        });
        if (up.error) throw up.error;
        paths.push(path);
      }
      toast("Reading your call log…", { icon: "📞" });
      const res = await parseFn({
        data: {
          photoPaths: paths,
          platform,
          capturedAt: new Date().toISOString(),
          captureNotes: notes || undefined,
          participantHint: participant || undefined,
        },
      });
      if (res.status === "parsed") toast.success(`Extracted ${res.callCount} call rows.`);
      else toast("Saved. We couldn't read call rows from every photo — your originals are stored.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        borderRadius: 0,
        padding: 22,
        background: "#FAF8F4",
        border: "1px solid rgba(122,31,61,0.22)",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="label-eyebrow" style={{ color: "var(--pp-accent)" }}>
            Call log · Photos
          </div>
          <h3
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 300,
              fontSize: 24,
              color: "#1A1224",
              marginTop: 4,
            }}
          >
            Import your call history
          </h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm underline"
          style={{ color: "rgba(26,18,36,0.55)" }}
        >
          Cancel
        </button>
      </div>
      <p style={{ fontSize: 13.5, color: "#3A3849", lineHeight: 1.55, marginBottom: 14 }}>
        Take screenshots of your phone&apos;s Recents / Calls screen — scroll and screenshot as you
        go. Works the same on iPhone and Android. The photos are your evidence; the extracted call
        rows are labeled <em>AI-extracted — unverified</em>.
      </p>

      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div>
          <label className="label-eyebrow">Phone</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as typeof platform)}
            className="input-pp mt-1"
          >
            <option value="iphone">iPhone</option>
            <option value="android">Android</option>
            <option value="unknown">Not sure</option>
          </select>
        </div>
        <div>
          <label className="label-eyebrow">Who is this about?</label>
          <input
            value={participant}
            onChange={(e) => setParticipant(e.target.value)}
            className="input-pp mt-1"
            placeholder="e.g. Alex — ex-partner"
          />
        </div>
        <div>
          <label className="label-eyebrow">Anything to remember?</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-pp mt-1"
            placeholder="e.g. week before the hearing"
          />
        </div>
      </div>

      <input
        ref={inp}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inp.current?.click()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          borderRadius: 0,
          background: "var(--pp-accent)",
          color: "#FAF8F4",
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        <Phone size={14} /> Add call log photos
      </button>

      {shots.length > 0 && (
        <div
          className="mt-4 grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}
        >
          {shots.map((s, idx) => (
            <div
              key={s.id}
              style={{
                position: "relative",
                borderRadius: 0,
                overflow: "hidden",
                border: "1px solid rgba(122,31,61,0.2)",
              }}
            >
              <img
                src={s.url}
                alt={`call log ${idx + 1}`}
                style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 4,
                  left: 4,
                  background: "rgba(0,0,0,0.55)",
                  color: "#FAF8F4",
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 18,
                }}
              >
                #{idx + 1}
              </div>
              <button
                type="button"
                onClick={() => remove(idx)}
                aria-label="Remove"
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  background: "rgba(255,255,255,0.9)",
                  borderRadius: 18,
                  padding: 4,
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || shots.length === 0}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 0,
            background: shots.length === 0 ? "rgba(26,18,36,0.22)" : "var(--pp-accent)",
            color: "#FAF8F4",
            fontWeight: 700,
            fontSize: 13,
            opacity: busy ? 0.7 : 1,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {busy ? "Reading…" : `Import ${shots.length} photo${shots.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
