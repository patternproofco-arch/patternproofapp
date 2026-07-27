import { useEffect, useState } from "react";
import { Mic, Square, Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/lib/settings-context";
import { usePinLock } from "@/lib/pin-lock";
import { useRecording } from "@/lib/recording-context";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export function PinScreen() {
  const { settings } = useSettings();
  const { unlock, hasPin, hasBiometric, unlockBiometric } = usePinLock();
  const { user } = useAuth();
  const { isRecording, elapsed, start, stop } = useRecording();
  const [bare, setBare] = useState(false);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [locked, setLocked] = useState(false);

  // Auto-prompt biometric on mount if it's the only method set up.
  useEffect(() => {
    if (hasBiometric && !hasPin) {
      void tryBio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tryBio = async () => {
    const r = await unlockBiometric();
    if (r === "failed") setMsg("Biometric unlock didn't work. Try again.");
    if (r === "unsupported") setMsg("Biometric unlock isn't available on this device.");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) return;
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
                  background: "#5B4CD6",
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
          <div className="mt-8 space-y-4">
            {hasBiometric && (
              <button
                type="button"
                onClick={tryBio}
                className="btn-primary w-full inline-flex items-center justify-center gap-2"
              >
                <Fingerprint size={18} />
                Unlock with Face ID / fingerprint
              </button>
            )}
            {hasPin && (
              <form onSubmit={submit} className="space-y-3">
                {hasBiometric && (
                  <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--muted-foreground)" }}>
                    <span className="h-px flex-1" style={{ background: "var(--border)" }} /> or PIN <span className="h-px flex-1" style={{ background: "var(--border)" }} />
                  </div>
                )}
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="input-pp text-center text-[24px] tracking-[0.5em]"
                  placeholder="••••"
                  autoFocus={!hasBiometric}
                />
                <button type="submit" disabled={pin.length !== 4} className="btn-primary w-full">Enter</button>
              </form>
            )}
            {msg && <p className="text-center text-[13px]" style={{ color: "var(--muted-foreground)" }}>{msg}</p>}
          </div>
        )}
      </div>
      {!isRecording && !locked && (
        <button
          onClick={beginBare}
          aria-label="Quick record"
          className="fixed bottom-5 right-5 flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: "#5B4CD6", color: "#fff", boxShadow: "none" }}
        >
          <Mic size={18} />
        </button>
      )}
    </div>
  );
}