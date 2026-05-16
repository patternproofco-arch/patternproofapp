import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mic, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSettings } from "@/lib/settings-context";

export const Route = createFileRoute("/_authenticated/live-recording")({
  component: LiveRecording,
});

interface Rec { id: string; title: string | null; date: string; audio_url: string; duration_seconds: number | null; transcript: string | null }

function LiveRecording() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [warned, setWarned] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState("");
  const [state, setState] = useState(settings.state);
  const [transcript, setTranscript] = useState("");
  const [list, setList] = useState<Rec[]>([]);
  const [startedAt, setStartedAt] = useState<string>("");
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const rec = useRef<unknown>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("recordings").select("id,title,date,audio_url,duration_seconds,transcript").eq("user_id", user.id).order("created_at", { ascending: false });
    setList((data as Rec[] | null) ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const m = new MediaRecorder(stream);
      chunks.current = [];
      m.ondataavailable = (e) => chunks.current.push(e.data);
      m.onstop = () => {
        setBlob(new Blob(chunks.current, { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.current = m;
      m.start();
      setStartedAt(new Date().toISOString());
      setRecording(true);
      setElapsed(0);
      timer.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);

      const SR = (window as unknown as { webkitSpeechRecognition?: new () => unknown; SpeechRecognition?: new () => unknown }).SpeechRecognition
        ?? (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
      if (SR) {
        const r = new SR() as { continuous: boolean; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; start: () => void; stop: () => void };
        r.continuous = true;
        r.interimResults = true;
        r.onresult = (e) => {
          let t = "";
          for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + " ";
          setTranscript(t);
        };
        r.start();
        rec.current = r;
      }
    } catch {
      toast("We couldn't access the microphone.");
    }
  };

  const stop = () => {
    mr.current?.stop();
    if (timer.current) clearInterval(timer.current);
    setRecording(false);
    const r = rec.current as { stop?: () => void } | null;
    r?.stop?.();
  };

  const save = async () => {
    if (!user || !blob) return;
    const endedAt = new Date().toISOString();
    const path = `${user.id}/${crypto.randomUUID()}.webm`;
    const up = await supabase.storage.from("conversation-recordings").upload(path, blob, { contentType: "audio/webm" });
    if (up.error) { toast("We couldn't save that. Try again in a moment."); return; }
    const { error } = await supabase.from("recordings").insert({
      user_id: user.id,
      title: title || null,
      date: new Date().toISOString().slice(0, 10),
      audio_url: path,
      duration_seconds: elapsed,
      transcript: transcript || null,
      recording_started_at: startedAt,
      recording_ended_at: endedAt,
      state_recorded_in: state || null,
    });
    if (error) { toast("We couldn't save that. Try again in a moment."); return; }
    toast("Saved. Your record is safe.");
    setBlob(null); setTitle(""); setTranscript(""); setElapsed(0);
    load();
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (!warned) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: "rgba(42,26,16,0.6)" }}>
        <div className="card-pp max-w-xl space-y-3">
          <h2 className="font-serif text-[24px]">Before you record — this is important.</h2>
          <p className="text-[14px] leading-relaxed">In New Jersey, you can legally record any conversation you are part of without telling the other person.</p>
          <p className="text-[14px] leading-relaxed">If you or the other person are in a different state, recording laws may be different. In some states, recording without consent is illegal and could result in the recording being inadmissible or, in rare cases, criminal charges.</p>
          <p className="text-[14px] leading-relaxed">PatternProof cannot give legal advice. If you are unsure whether recording is legal in your situation, speak with an attorney first.</p>
          <p className="text-[14px] leading-relaxed">Your safety matters more than any recording. If recording could put you in danger, do not record.</p>
          <div className="flex gap-2 pt-2">
            <button className="btn-primary" onClick={() => setWarned(true)}>I understand, continue</button>
            <a href="/dashboard" className="btn-ghost">Go back</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="label-eyebrow">Live Recording</div>
      <h1 className="mt-2 font-serif text-[34px]">Record a conversation.</h1>

      <div className="mt-6 rounded-2xl p-8 text-center" style={{ background: "var(--sidebar)", color: "var(--sidebar-active)" }}>
        {!recording && !blob && (
          <>
            <button onClick={start} className="mx-auto flex h-24 w-24 items-center justify-center rounded-full" style={{ background: "var(--primary)" }}>
              <Mic size={36} color="#fff" />
            </button>
            <p className="mt-4 text-[14px]">Tap to start recording</p>
          </>
        )}
        {recording && (
          <>
            <button onClick={stop} className="mx-auto flex h-24 w-24 items-center justify-center rounded-full pulse-rec" style={{ background: "var(--primary)" }}>
              <Square size={32} color="#fff" />
            </button>
            <p className="mt-4 text-[14px]">Recording… {fmt(elapsed)}</p>
          </>
        )}
        {blob && !recording && (
          <div className="space-y-3 text-left">
            <audio src={URL.createObjectURL(blob)} controls className="w-full" />
            <input className="input-pp" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="input-pp" placeholder="State where recorded" value={state} onChange={(e) => setState(e.target.value)} />
            {transcript && <textarea className="input-pp" value={transcript} onChange={(e) => setTranscript(e.target.value)} />}
            <div className="flex gap-2">
              <button onClick={save} className="btn-primary">Save Recording</button>
              <button onClick={() => setBlob(null)} className="btn-ghost">Discard</button>
            </div>
          </div>
        )}
      </div>

      <h2 className="mt-10 font-serif text-[20px]">Your recordings</h2>
      {list.length === 0 ? (
        <div className="card-pp mt-3"><p style={{ color: "var(--muted-foreground)" }}>Tap the button above to start recording. Everything is encrypted and only you can access it.</p></div>
      ) : (
        <div className="mt-3 space-y-3">
          {list.map((r) => <RecCard key={r.id} r={r} onChanged={load} />)}
        </div>
      )}
    </div>
  );
}

function RecCard({ r, onChanged }: { r: Rec; onChanged: () => void }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    supabase.storage.from("conversation-recordings").createSignedUrl(r.audio_url, 3600).then(({ data }) => setUrl(data?.signedUrl ?? ""));
  }, [r.audio_url]);
  const del = async () => {
    if (!confirm("Remove this recording?")) return;
    await supabase.storage.from("conversation-recordings").remove([r.audio_url]);
    await supabase.from("recordings").delete().eq("id", r.id);
    onChanged();
  };
  return (
    <div className="card-pp" style={{ borderLeft: "3px solid var(--primary)" }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Conversation Recording</div>
          <div className="font-serif text-[16px]">{r.title || "Untitled"}</div>
          <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>{new Date(r.date).toLocaleDateString()} · {r.duration_seconds ?? 0}s</div>
        </div>
        <button onClick={del} className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Delete</button>
      </div>
      {url && <audio src={url} controls className="mt-3 w-full" />}
      {r.transcript && (
        <div className="mt-3 rounded-xl p-3 text-[13px]" style={{ background: "var(--input)" }}>
          <div className="label-eyebrow mb-1">Auto-generated — review before using in court</div>
          {r.transcript}
        </div>
      )}
    </div>
  );
}