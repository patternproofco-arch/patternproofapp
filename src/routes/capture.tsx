import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { saveCaptureDraft } from "@/lib/capture-draft";

export const Route = createFileRoute("/capture")({
  head: () => ({
    meta: [
      { title: "60-second note — PatternProof" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Capture,
});

const LIMIT = 60;

function Capture() {
  const [sec, setSec] = useState(0);
  const [rec, setRec] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [aboutWhen, setAboutWhen] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const media = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tick = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (tick.current) window.clearInterval(tick.current);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    },
    [blobUrl],
  );

  const persist = (when: string, duration?: number) => {
    saveCaptureDraft({
      aboutWhen: when,
      savedAt: new Date().toISOString(),
      durationSec: duration,
    });
  };

  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        setBlobUrl(URL.createObjectURL(blob));
        persist(aboutWhen, LIMIT);
      };
      media.current = mr;
      mr.start();
      setRec(true);
      setSec(0);
      tick.current = window.setInterval(() => {
        setSec((s) => {
          if (s + 1 >= LIMIT) {
            stop();
            return LIMIT;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setErr("Microphone permission is needed for a voice note.");
    }
  };

  const stop = () => {
    if (tick.current) window.clearInterval(tick.current);
    if (media.current && media.current.state !== "inactive") media.current.stop();
    setRec(false);
    persist(aboutWhen, sec);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper, #f4f1ea)", color: "var(--ink, #1a1916)" }}>
      <PublicQuickExit />
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "48px 24px" }}>
        <p className="folio-kicker">One minute · optional date</p>
        <h1 style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: "2rem", fontWeight: 400 }}>
          Say what happened.
        </h1>
        <p style={{ color: "var(--ink-muted, #5c574f)", lineHeight: 1.5 }}>
          Sixty seconds. You can add “about when” after. Abuse type is not required.
        </p>
        <button
          type="button"
          onClick={rec ? stop : start}
          style={{
            marginTop: 28,
            width: "100%",
            height: 64,
            borderRadius: 3,
            border: 0,
            background: rec ? "#5F7A5E" : "#1a1916",
            color: "#f4f1ea",
            cursor: "pointer",
          }}
        >
          {rec ? `Stop · ${sec}s` : blobUrl ? "Record again" : "Start"}
        </button>
        {err && <p>{err}</p>}
        {blobUrl && <audio controls src={blobUrl} style={{ width: "100%", marginTop: 16 }} />}
        <label style={{ display: "block", marginTop: 24, fontSize: 13 }}>
          About when (optional)
          <input
            value={aboutWhen}
            onChange={(e) => {
              setAboutWhen(e.target.value);
              persist(e.target.value, sec);
            }}
            placeholder="week of March 2026"
            style={{ display: "block", width: "100%", marginTop: 6, padding: 12, borderRadius: 3, border: "1px solid #d4cfc4" }}
          />
        </label>
        <p style={{ marginTop: 20, fontSize: 13, color: "var(--ink-muted, #5c574f)" }}>
          Create an account to keep this in your vault. The date note is saved on this device.
        </p>
        <Link to="/signup" onClick={() => persist(aboutWhen, sec)}>
          Keep this in an account →
        </Link>
      </main>
    </div>
  );
}
