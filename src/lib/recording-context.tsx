import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export interface PendingRecording {
  blob: Blob;
  transcript: string;
  durationSec: number;
  startedAt: string;
  endedAt: string;
}

interface Ctx {
  isRecording: boolean;
  elapsed: number;
  pending: PendingRecording | null;
  start: () => Promise<boolean>;
  stop: () => Promise<PendingRecording | null>;
  consumePending: () => PendingRecording | null;
  discardPending: () => void;
}

const RecCtx = createContext<Ctx | null>(null);

export function RecordingProvider({ children }: { children: ReactNode }) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pending, setPending] = useState<PendingRecording | null>(null);

  const mr = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const startedAt = useRef<string>("");
  const transcript = useRef<string>("");
  const sr = useRef<{ stop: () => void } | null>(null);

  const start = useCallback(async (): Promise<boolean> => {
    if (isRecording) return false;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const m = new MediaRecorder(s);
      chunks.current = [];
      transcript.current = "";
      m.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.current = m;
      m.start();
      startedAt.current = new Date().toISOString();
      setIsRecording(true);
      setElapsed(0);
      timer.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);

      const SR = (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition
        ?? (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
      if (SR) {
        try {
          const r = new SR() as { continuous: boolean; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; start: () => void; stop: () => void };
          r.continuous = true;
          r.interimResults = true;
          r.onresult = (e) => {
            let t = "";
            for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + " ";
            transcript.current = t.trim();
          };
          r.start();
          sr.current = r;
        } catch { /* ignore */ }
      }
      return true;
    } catch {
      return false;
    }
  }, [isRecording]);

  const stop = useCallback(async (): Promise<PendingRecording | null> => {
    if (!mr.current) return null;
    const m = mr.current;
    const dur = elapsed;
    const started = startedAt.current;
    const tx = transcript.current;

    return await new Promise((resolve) => {
      m.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        stream.current?.getTracks().forEach((t) => t.stop());
        stream.current = null;
        if (timer.current) { clearInterval(timer.current); timer.current = undefined; }
        try { sr.current?.stop(); } catch { /* ignore */ }
        sr.current = null;
        mr.current = null;
        setIsRecording(false);
        const result: PendingRecording = {
          blob, transcript: tx, durationSec: dur,
          startedAt: started, endedAt: new Date().toISOString(),
        };
        setPending(result);
        setElapsed(0);
        resolve(result);
      };
      try { m.stop(); } catch { resolve(null); }
    });
  }, [elapsed]);

  const consumePending = useCallback(() => {
    const p = pending;
    setPending(null);
    return p;
  }, [pending]);

  const discardPending = useCallback(() => setPending(null), []);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return (
    <RecCtx.Provider value={{ isRecording, elapsed, pending, start, stop, consumePending, discardPending }}>
      {children}
    </RecCtx.Provider>
  );
}

export function useRecording() {
  const ctx = useContext(RecCtx);
  if (!ctx) throw new Error("useRecording must be used inside RecordingProvider");
  return ctx;
}