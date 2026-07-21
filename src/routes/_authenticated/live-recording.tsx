import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mic, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSettings } from "@/lib/settings-context";
import { useRecording, type PendingRecording } from "@/lib/recording-context";
import { useServerFn } from "@tanstack/react-start";
import { checkAccidental } from "@/lib/accidental-check.functions";
import { useConfirm } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/live-recording")({
  component: LiveRecording,
});

interface Rec { id: string; title: string | null; date: string; audio_url: string; duration_seconds: number | null; transcript: string | null }

function LiveRecording() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { isRecording, elapsed, pending, start, stop, consumePending, discardPending } = useRecording();
  const runCheck = useServerFn(checkAccidental);
  const [warned, setWarned] = useState(false);
  const [item, setItem] = useState<PendingRecording | null>(null);
  const [title, setTitle] = useState("");
  const [state, setState] = useState(settings.state);
  const [transcript, setTranscript] = useState("");
  const [list, setList] = useState<Rec[]>([]);
  const [accidental, setAccidental] = useState<{ accidental: boolean; confidence: string } | null>(null);
  const checkedRef = useRef(false);
  const autoStarted = useRef(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("recordings").select("id,title,date,audio_url,duration_seconds,transcript").eq("user_id", user.id).order("created_at", { ascending: false });
    setList((data as Rec[] | null) ?? []);
  };
  useEffect(() => { load(); }, [user]);

  // Remember the user accepted the legal warning across sessions.
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("pp_record_warned") === "1") {
      setWarned(true);
    }
  }, []);
  useEffect(() => {
    if (warned && typeof window !== "undefined") localStorage.setItem("pp_record_warned", "1");
  }, [warned]);

  // PWA shortcut: /live-recording?auto=1 → start immediately if already warned.
  useEffect(() => {
    if (autoStarted.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auto") === "1" && warned && !isRecording && !item && !pending) {
      autoStarted.current = true;
      start();
    }
  }, [warned, isRecording, item, pending, start]);

  // Consume globally pending recording from the floating button
  useEffect(() => {
    if (pending && !item) {
      const p = consumePending();
      if (p) {
        setItem(p);
        setTranscript(p.transcript);
      }
    }
  }, [pending, item, consumePending]);

  // Run accidental check once per item
  useEffect(() => {
    if (!item || checkedRef.current) return;
    checkedRef.current = true;
    runCheck({ data: { transcript: item.transcript, durationSec: item.durationSec } })
      .then((r) => setAccidental(r))
      .catch(() => setAccidental(null));
  }, [item, runCheck]);

  const beginLocal = async () => {
    const ok = await start();
    if (!ok) toast("We couldn't access the microphone.");
  };

  const save = async () => {
    if (!user || !item) return;
    const path = `${user.id}/${crypto.randomUUID()}.webm`;
    const up = await supabase.storage.from("conversation-recordings").upload(path, item.blob, { contentType: "audio/webm" });
    if (up.error) { toast("We couldn't save that. Try again in a moment."); return; }
    const { error } = await supabase.from("recordings").insert({
      user_id: user.id,
      title: title || null,
      date: new Date().toISOString().slice(0, 10),
      audio_url: path,
      duration_seconds: item.durationSec,
      transcript: transcript || null,
      recording_started_at: item.startedAt,
      recording_ended_at: item.endedAt,
      state_recorded_in: state || null,
    });
    if (error) { toast("We couldn't save that. Try again in a moment."); return; }
    toast("Saved. Your record is safe.");
    setItem(null); setTitle(""); setTranscript(""); setAccidental(null); checkedRef.current = false;
    load();
  };

  const discard = () => {
    setItem(null); setTitle(""); setTranscript(""); setAccidental(null); checkedRef.current = false;
    discardPending();
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div>
      <div className="label-eyebrow">Live Recording</div>
      <h1 className="mt-2 font-serif text-[34px]">Record a conversation.</h1>

      {!warned && (
        <div className="mt-4 rounded-2xl p-4" style={{ background: "var(--tint-purple)", border: "1px solid var(--border)" }}>
          <p className="text-[13px] leading-relaxed">
            Recording-consent laws vary by state. In NJ you can record any conversation you're part of; other states may require consent. PatternProof can't give legal advice — if you're unsure, ask an attorney. Your safety comes first.
          </p>
          <button onClick={() => setWarned(true)} className="mt-3 text-[13px] font-bold underline-offset-4 hover:underline" style={{ color: "var(--primary)" }}>
            Got it
          </button>
        </div>
      )}

      <div className="mt-6 rounded-2xl p-8 text-center" style={{ background: "var(--sidebar)", color: "var(--sidebar-active)" }}>
        {!isRecording && !item && (
          <>
            <button onClick={beginLocal} className="mx-auto flex h-24 w-24 items-center justify-center rounded-full" style={{ background: "var(--primary)" }}>
              <Mic size={36} color="#fff" />
            </button>
            <p className="mt-4 text-[14px]">Tap to start recording</p>
            <p className="mt-1 text-[12px] opacity-70">Or tap the orange microphone in the corner from any screen.</p>
          </>
        )}
        {isRecording && (
          <>
            <button onClick={() => stop()} className="mx-auto flex h-24 w-24 items-center justify-center rounded-full pulse-rec" style={{ background: "var(--primary)" }}>
              <Square size={32} color="#fff" />
            </button>
            <p className="mt-4 text-[14px]">Recording… {fmt(elapsed)}</p>
          </>
        )}
        {item && !isRecording && (
          <div className="space-y-3 text-left">
            {accidental?.accidental && accidental.confidence === "high" && (
              <div className="rounded-xl px-4 py-3" style={{ background: "rgba(242,232,216,0.95)", color: "#2A1A10", border: "1px solid rgba(78,59,49,0.15)" }}>
                <p className="text-[13px]">This looks like it may have been accidental. Discard it?</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={discard} className="rounded-lg px-3 py-1.5 text-[12px] font-semibold" style={{ background: "#B57E60", color: "#F5E6DF" }}>Discard</button>
                  <button onClick={() => setAccidental(null)} className="rounded-lg px-3 py-1.5 text-[12px] font-semibold" style={{ background: "transparent", color: "#2A1A10" }}>Keep it</button>
                </div>
              </div>
            )}
            <audio src={URL.createObjectURL(item.blob)} controls className="w-full" />
            <input className="input-pp" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="input-pp" placeholder="State where recorded" value={state} onChange={(e) => setState(e.target.value)} />
            {transcript && <textarea className="input-pp" value={transcript} onChange={(e) => setTranscript(e.target.value)} />}
            <div className="flex gap-2">
              <button onClick={save} className="btn-primary">Save Recording</button>
              <button onClick={discard} className="btn-ghost">Discard</button>
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
  const { confirm, dialog } = useConfirm();
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    supabase.storage.from("conversation-recordings").createSignedUrl(r.audio_url, 3600).then(({ data }) => setUrl(data?.signedUrl ?? ""));
  }, [r.audio_url]);
  const del = async () => {
    const ok = await confirm({ title: "Remove this recording?", body: "The audio file will be permanently deleted.", confirmLabel: "Remove", cancelLabel: "Keep" });
    if (!ok) return;
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