import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Image as ImageIcon, FileText, Music, Video, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/evidence")({
  component: EvidencePage,
});

interface EvidenceRow {
  id: string;
  title: string;
  date: string;
  description: string | null;
  file_url: string;
  file_type: string;
  linked_incident_id: string | null;
}
interface IncOption { id: string; date: string; description: string }

const today = () => new Date().toISOString().slice(0, 10);

function fileKind(mime: string): "image" | "audio" | "video" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

function KindIcon({ kind, size = 22 }: { kind: string; size?: number }) {
  const c = { color: "var(--foreground)" };
  if (kind === "image") return <ImageIcon size={size} style={c} />;
  if (kind === "audio") return <Music size={size} style={c} />;
  if (kind === "video") return <Video size={size} style={c} />;
  return <FileText size={size} style={c} />;
}

function EvidencePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<EvidenceRow[]>([]);
  const [incidents, setIncidents] = useState<IncOption[]>([]);
  const [pending, setPending] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");
  const [linkedId, setLinkedId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [ev, inc] = await Promise.all([
      supabase.from("evidence").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("incidents").select("id,date,description").eq("user_id", user.id).order("date", { ascending: false }),
    ]);
    const rows = (ev.data as EvidenceRow[] | null) ?? [];
    setItems(rows);
    setIncidents((inc.data as IncOption[] | null) ?? []);
    // signed URLs
    const urls: Record<string, string> = {};
    await Promise.all(rows.map(async (r) => {
      const { data } = await supabase.storage.from("evidence-files").createSignedUrl(r.file_url, 3600);
      if (data?.signedUrl) urls[r.id] = data.signedUrl;
    }));
    setPreviewUrls(urls);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onFile = (f: File | null) => {
    setPending(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pending || !title.trim()) return;
    setBusy(true);
    const ext = pending.name.split(".").pop() ?? "bin";
    const key = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const up = await supabase.storage.from("evidence-files").upload(key, pending);
    if (up.error) { setBusy(false); toast("We couldn't upload that. Try again in a moment."); return; }
    const { error } = await supabase.from("evidence").insert({
      user_id: user.id, title: title.trim(), date, description: description || null,
      file_url: key, file_type: fileKind(pending.type), linked_incident_id: linkedId || null,
    });
    setBusy(false);
    if (error) { toast("Saved the file but couldn't record the details."); return; }
    toast("Saved. Your record is safe.");
    setPending(null); setTitle(""); setDate(today()); setDescription(""); setLinkedId("");
    if (inputRef.current) inputRef.current.value = "";
    load();
  };

  const remove = async (item: EvidenceRow) => {
    if (!user) return;
    if (!confirm("Remove this evidence permanently?")) return;
    await supabase.storage.from("evidence-files").remove([item.file_url]);
    const { error } = await supabase.from("evidence").delete().eq("id", item.id).eq("user_id", user.id);
    if (error) { toast("We couldn't remove that. Try again in a moment."); return; }
    toast("Removed.");
    load();
  };

  return (
    <div>
      <div className="label-eyebrow">Evidence</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Keep the proof <em>close.</em>
      </h1>

      <form onSubmit={submit} className="card-pp mt-6 space-y-4">
        <label className="block cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center"
          style={{ borderColor: "var(--border)" }}>
          <Upload size={26} className="mx-auto mb-2" style={{ color: "var(--muted-foreground)" }} />
          <div className="font-serif text-[16px]">{pending ? pending.name : "Drop a file here, or tap to choose"}</div>
          <div className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>Images, PDF, audio, video</div>
          <input ref={inputRef} type="file" className="hidden"
            accept="image/jpeg,image/png,image/webp,application/pdf,audio/mpeg,audio/mp4,audio/wav,audio/x-m4a,video/mp4"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </label>
        {pending && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label-eyebrow">Title</label>
              <input className="input-pp mt-1" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="label-eyebrow">Date</label>
              <input type="date" className="input-pp mt-1" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="label-eyebrow">Description</label>
              <textarea className="input-pp mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this show?" />
            </div>
            <div className="md:col-span-2">
              <label className="label-eyebrow">Link to incident (optional)</label>
              <select className="input-pp mt-1" value={linkedId} onChange={(e) => setLinkedId(e.target.value)}>
                <option value="">— None —</option>
                {incidents.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.date} · {i.description.slice(0, 60)}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <button type="submit" disabled={busy} className="btn-primary">{busy ? "Saving…" : "Add to Evidence"}</button>
            </div>
          </div>
        )}
      </form>

      <div className="mt-8">
        {items.length === 0 ? (
          <div className="card-pp">
            <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
              Nothing uploaded yet. Screenshots, voice memos, documents — anything that captures what happened belongs here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => {
              const url = previewUrls[it.id];
              const linked = incidents.find((i) => i.id === it.linked_incident_id);
              return (
                <div key={it.id} className="card-pp">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2"><KindIcon kind={it.file_type} /><div className="font-serif text-[15px] leading-tight">{it.title}</div></div>
                  </div>
                  <div className="label-eyebrow mt-2">{new Date(it.date).toLocaleDateString()}</div>
                  {it.file_type === "image" && url && (
                    <img src={url} alt={it.title} className="mt-3 max-h-48 w-full rounded-xl object-cover" />
                  )}
                  {it.file_type === "audio" && url && <audio controls src={url} className="mt-3 w-full" />}
                  {it.file_type === "video" && url && <video controls src={url} className="mt-3 max-h-48 w-full rounded-xl" />}
                  {it.description && <p className="mt-2 text-[13px]" style={{ color: "var(--foreground)" }}>{it.description}</p>}
                  {linked && <div className="mt-2 text-[12px]" style={{ color: "var(--accent)" }}>Linked: {linked.date}</div>}
                  <div className="mt-3 flex items-center gap-2">
                    {url && <a href={url} target="_blank" rel="noreferrer" download className="btn-ghost inline-flex items-center gap-1 text-[12px]"><Download size={13} /> Open</a>}
                    <button onClick={() => remove(it)} className="btn-ghost inline-flex items-center gap-1 text-[12px]"><Trash2 size={13} /> Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}