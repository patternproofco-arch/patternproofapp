import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { transcribeVoiceNote } from "@/lib/transcribe-voice-note.functions";
import { CognitiveClose } from "@/components/CognitiveClose";
import { useConfirm } from "@/components/ConfirmDialog";
import { checkUploadSize } from "@/lib/upload-limits";

export const Route = createFileRoute("/_authenticated/voice-notes")({
  component: VoiceNotesPage,
});

interface Note { id: string; title: string; date: string; audio_url: string; duration_seconds: number | null; transcript: string | null; transcription_status: string }
const today = () => new Date().toISOString().slice(0, 10);

function VoiceNotesPage() {
  const { user } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const transcribeFn = useServerFn(transcribeVoiceNote);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pendingDuration, setPendingDuration] = useState(0);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("voice_notes").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const rows = (data as Note[] | null) ?? [];
    setNotes(rows);
    const urls: Record<string, string> = {};
    await Promise.all(rows.map(async (r) => {
      const { data: s } = await supabase.storage.from("voice-notes").createSignedUrl(r.audio_url, 3600);
      if (s?.signedUrl) urls[r.id] = s.signedUrl;
    }));
    setAudioUrls(urls);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setPendingBlob(blob);
        setPendingUrl(URL.createObjectURL(blob));
        setPendingDuration(elapsed);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      recRef.current = mr;
      setElapsed(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => setElapsed((x) => x + 1), 1000);
    } catch {
      toast("We couldn't access your microphone. Check your browser permissions.");
    }
  };

  const stopRec = () => {
    recRef.current?.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
  };

  const save = async () => {
    if (!user || !pendingBlob) return;
    const problem = checkUploadSize({ name: "Voice note", size: pendingBlob.size, type: "audio/webm" });
    if (problem) { toast(problem); return; }
    setBusy(true);
    const key = `${user.id}/${Date.now()}.webm`;
    const up = await supabase.storage.from("voice-notes").upload(key, pendingBlob, { contentType: "audio/webm" });
    if (up.error) { setBusy(false); toast("We couldn't save that recording. Try again in a moment."); return; }
    const { error } = await supabase.from("voice_notes").insert({
      user_id: user.id, title: title.trim() || "Voice note", date, audio_url: key, duration_seconds: pendingDuration,
    });
    setBusy(false);
    if (error) { toast("Couldn't record the details."); return; }
    toast("Saved. Your record is safe.");
    setPendingBlob(null); setPendingUrl(null); setPendingDuration(0); setTitle(""); setDate(today());
    load();
  };

  const remove = async (n: Note) => {
    if (!user) return;
    const ok = await confirm({
      title: "Remove this voice note?",
      body: "The recording and any transcript will be permanently removed.",
      confirmLabel: "Remove",
      cancelLabel: "Keep",
    });
    if (!ok) return;
    await supabase.storage.from("voice-notes").remove([n.audio_url]);
    await supabase.from("voice_notes").delete().eq("id", n.id).eq("user_id", user.id);
    toast("Removed.");
    load();
  };

  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const transcribe = async (n: Note) => {
    setTranscribingId(n.id);
    try {
      const r = await transcribeFn({ data: { voiceNoteId: n.id } });
      if (r.ok) toast("Transcript ready.");
      else if (r.reason === "too-long" || r.reason === "too-large") toast("This recording is too long to transcribe automatically.");
      else if (r.reason === "credits") toast("AI credits exhausted.");
      else if (r.reason === "rate-limit") toast("Rate-limited. Try again shortly.");
      else toast("Couldn't transcribe. Try again in a moment.");
      load();
    } finally {
      setTranscribingId(null);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? notes.filter((n) => n.title.toLowerCase().includes(q) || (n.transcript ?? "").toLowerCase().includes(q))
    : notes;

  return (
    <div>
      <div className="label-eyebrow">Voice notes</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">Speak it. <em>It still counts.</em></h1>

      <div className="card-pp mt-6 flex flex-col items-center gap-4 py-10">
        <button
          onClick={recording ? stopRec : startRec}
          className={`flex h-24 w-24 items-center justify-center rounded-full ${recording ? "pulse-rec" : ""}`}
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          {recording ? <Square size={30} /> : <Mic size={32} />}
        </button>
        <div className="font-serif text-[22px]">{mmss(elapsed)}</div>
        <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          {recording ? "Recording… press the circle again to stop." : pendingBlob ? "Recorded. Save it below." : "Press to start. Speak in your own voice."}
        </div>
      </div>

      {pendingUrl && (
        <div className="card-pp mt-4 space-y-3">
          <audio controls src={pendingUrl} className="w-full" />
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label-eyebrow">Title</label>
              <input className="input-pp mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A short label for this recording" />
            </div>
            <div>
              <label className="label-eyebrow">Date</label>
              <input type="date" className="input-pp mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button disabled={busy} onClick={save} className="btn-primary">{busy ? "Saving…" : "Save Voice Note"}</button>
            <button onClick={() => { setPendingBlob(null); setPendingUrl(null); }} className="btn-ghost">Discard</button>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-3">
        {notes.length > 0 && (
          <input
            className="input-pp"
            placeholder="Search titles and transcripts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
        {filtered.length === 0 ? (
          <div className="card-pp">
            <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
              {notes.length === 0
                ? "Sometimes it's easier to speak than to write. Record what happened in your own voice."
                : "No recordings match that search."}
            </p>
          </div>
        ) : (
          filtered.map((n) => (
            <div key={n.id} className="card-pp">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-[16px]">{n.title}</div>
                  <div className="label-eyebrow mt-1">{new Date(n.date).toLocaleDateString()} {n.duration_seconds != null && `· ${mmss(n.duration_seconds)}`}</div>
                  {audioUrls[n.id] && <audio controls src={audioUrls[n.id]} className="mt-3 w-full" />}
                  {n.transcript ? (
                    <div className="mt-3 rounded-[2px] p-3 text-[13px] leading-relaxed" style={{ background: "var(--input)" }}>
                      <div className="label-eyebrow mb-1">Transcript</div>
                      {n.transcript}
                    </div>
                  ) : (
                    <button
                      onClick={() => transcribe(n)}
                      disabled={transcribingId === n.id}
                      className="btn-ghost mt-3 text-[12px]"
                    >
                      {transcribingId === n.id ? "Transcribing…" : n.transcription_status === "failed" ? "Retry transcription" : "Transcribe"}
                    </button>
                  )}
                </div>
                <button onClick={() => remove(n)} aria-label="Remove" className="rounded-[2px] p-2 hover:bg-black/5"><Trash2 size={15} /></button>
              </div>
            </div>
          ))
        )}
      </div>
      <CognitiveClose
        title="Turn a voice note into a written record"
        body="When you're ready, log the moment in your journal so it joins your timeline."
        cta="Open journal"
        to="/journal"
      />
      {dialog}
    </div>
  );
}