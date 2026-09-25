import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
      m.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      mr.current = m;
      m.start(1000);
      // Best-effort live transcript where the browser supports it.
      try {
        const w = window as unknown as Record<string, unknown>;
        const SR = (w.SpeechRecognition || w.webkitSpeechRecognition) as
          | (new () => {
              continuous: boolean;
              interimResults: boolean;
              onresult: (e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void;
              onend: () => void;
              start: () => void;
              stop: () => void;
            })
          | undefined;
        if (SR) {
          const rec = new SR();
          rec.continuous = true;
          rec.interimResults = false;
          let active = true;
          rec.onresult = (e) => {
            for (let i = e.resultIndex; i < e.results.length; i++) {
              if (e.results[i].isFinal) transcript.current += `${e.results[i][0].transcript} `;
            }
          };
          rec.onend = () => {
            if (active && mr.current) {
              try { rec.start(); } catch { /* ignore */ }
            }
          };
          rec.start();
          sr.current = { stop: () => { active = false; rec.stop(); } };
        }
      } catch {
        /* transcript is optional */
      }
      startedAt.current = new Date().toISOString();
      setIsRecording(true);
      setElapsed(0);
      timer.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
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
    
    return await new Promise((resolve) => {
      m.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        stream.current?.getTracks().forEach((t) => t.stop());
        stream.current = null;
        if (timer.current) {
          clearInterval(timer.current);
          timer.current = undefined;
        }
        try {
          sr.current?.stop();
        } catch {
          /* ignore */
        }
        sr.current = null;
        mr.current = null;
        setIsRecording(false);
        const result: PendingRecording = {
          blob,
          transcript: transcript.current.trim(),
          durationSec: dur,
          startedAt: started,
          endedAt: new Date().toISOString(),
        };
        setPending(result);
        setElapsed(0);
        resolve(result);
      };
      try {
        m.stop();
      } catch {
        resolve(null);
      }
    });
  }, [elapsed]);

  const consumePending = useCallback(() => {
    const p = pending;
    setPending(null);
    return p;
  }, [pending]);

  const discardPending = useCallback(() => setPending(null), []);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return (
    <RecCtx.Provider
      value={{ isRecording, elapsed, pending, start, stop, consumePending, discardPending }}
    >
      {children}
    </RecCtx.Provider>
  );
}

export function useRecording() {
  const ctx = useContext(RecCtx);
  if (!ctx) throw new Error("useRecording must be used inside RecordingProvider");
  return ctx;
}
