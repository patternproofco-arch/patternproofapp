import { useState } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/lib/settings-context";
import { usePinLock } from "@/lib/pin-lock";
import { useRecording } from "@/lib/recording-context";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export function PinScreen() {
  const { settings } = useSettings();
  const { unlock } = usePinLock();
  const { user } = useAuth();
  const { isRecording, elapsed, start, stop } = useRecording();
  const [bare, setBare] = useState(false);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [locked, setLocked] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6) return;
    const result = await unlock(pin);
    if (result === "locked-out") {
      setLocked(true);
      setMsg("Please try again in 30 minutes.");
    } else if (result === "wrong") {
      setMsg("That code didn't work. Try again.");
      setPin("");
    }
  };

  const beginBare = async () => {
    const ok = await start();
    if (!ok) { toast("We couldn't access the microphone."); return; }
    setBare(true);
  };

  const endBare = async () => {
    const result = await stop();
    if (result && user) {
      const path = `${user.id}/${crypto.randomUUID()}.webm`;
      const up = await supabase.storage.from("conversation-recordings").upload(path, result.blob, { contentType: "audio/webm" });
      if (!up.error) {
        await supabase.from("recordings").insert({
          user_id: user.id,
          title: null,
          date: new Date().toISOString().slice(0, 10),
          audio_url: path,
          duration_seconds: result.durationSec,
          transcript: result.transcript || null,
          recording_started_at: result.startedAt,
          recording_ended_at: result.endedAt,
          state_recorded_in: null,
        });
      }
    }
    setBare(false);
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (bare) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6" style={{ background: "var(--background)" }}>
        <div className="font-serif text-[20px]" style={{ color: "var(--foreground)" }}>{settings.disguiseName}</div>
        <div className="mt-12 flex flex-col items-center">
          <div className="flex items-end gap-1" aria-hidden>
            {[...Array(20)].map((_, i) => (
              <span
                key={i}
                className="pulse-rec"
                style={{
                  width: 4,
                  background: "#E77B56",
                  borderRadius: 2,
                  height: `${10 + ((i * 7 + elapsed * 5) % 32)}px`,
                  animationDelay: `${i * 60}ms`,
                }}
              />
            ))}
          </div>
          <div className="mt-6 font-serif text-[34px]" style={{ color: "var(--foreground)" }}>{fmt(elapsed)}</div>
          <button
            onClick={endBare}
            className="mt-8 flex h-20 w-20 items-center justify-center rounded-full pulse-rec"
            style={{ background: "#C4674A" }}
            aria-label="Stop recording"
          >
            <Square size={28} color="#fff" />
          </button>
          <p className="mt-6 text-[13px]" style={{ color: "var(--muted-foreground)" }}>Recording. Tap to stop.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-[28px] text-center">{settings.disguiseName}</h1>
        {locked ? (
          <p className="mt-8 text-center text-[14px]" style={{ color: "var(--muted-foreground)" }}>{msg}</p>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="input-pp text-center text-[24px] tracking-[0.5em]"
              placeholder="••••••"
              autoFocus
            />
            <button type="submit" disabled={pin.length !== 6} className="btn-primary w-full">Enter</button>
            {msg && <p className="text-center text-[13px]" style={{ color: "var(--muted-foreground)" }}>{msg}</p>}
          </form>
        )}
      </div>
      {!isRecording && !locked && (
        <button
          onClick={beginBare}
          aria-label="Quick record"
          className="fixed bottom-5 right-5 flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: "#E77B56", color: "#fff", boxShadow: "0 4px 12px rgba(78,59,49,0.2)" }}
        >
          <Mic size={18} />
        </button>
      )}
    </div>
  );
}