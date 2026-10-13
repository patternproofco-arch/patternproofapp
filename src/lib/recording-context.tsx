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

export const RECORDING_LIMIT_SEC = 60;
export const RECORDING_WARN_SEC = 45;

interface Ctx {
  isRecording: boolean;
  /** Seconds left before the recording stops on its own. */
  remaining: number;
  /** True in the last 15 seconds before the limit. */
  nearLimit: boolean;
  /** True when the last recording was stopped by the limit, not the user. */
  stoppedAtLimit: boolean;
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
  const [stoppedAtLimit, setStoppedAtLimit] = useState(false);

  const mr = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const startedAt = useRef<string>("");
  const transcript = useRef<string>("");

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
      // Browser speech recognition can send audio to a remote service. It is
      // not started by recording; optional transcription is a separate action.
      startedAt.current = new Date().toISOString();
      setIsRecording(true);
      setStoppedAtLimit(false);
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

  // Stop at the limit — the warning has been visible for the last 15 seconds.
  useEffect(() => {
    if (isRecording && elapsed >= RECORDING_LIMIT_SEC) {
      setStoppedAtLimit(true);
      void stop();
    }
  }, [isRecording, elapsed, stop]);

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
      value={{
        isRecording,
        remaining: Math.max(0, RECORDING_LIMIT_SEC - elapsed),
        nearLimit: isRecording && elapsed >= RECORDING_WARN_SEC,
        stoppedAtLimit,
        elapsed,
        pending,
        start,
        stop,
        consumePending,
        discardPending,
      }}
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
