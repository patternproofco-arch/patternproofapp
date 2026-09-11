import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PublicQuickExit } from "@/components/PublicQuickExit";

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

  useEffect(() => () => {
    if (tick.current) window.clearInterval(tick.current);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

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
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--pp-ground)", color: "var(--pp-ink)", fontFamily: "var(--font-sans)" }}>
      <PublicQuickExit />
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "48px 24px" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--pp-muted)" }}>
          One minute · optional date
        </p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", fontWeight: 400 }}>Say what happened.</h1>
        <p style={{ color: "var(--pp-muted)", lineHeight: 1.5 }}>
          Sixty seconds. You can add “about when” after. Abuse type is not required.
        </p>

        <button
          type="button"
          onClick={rec ? stop : start}
          style={{
            marginTop: 28,
            width: "100%",
            height: 64,
            borderRadius: 999,
            border: 0,
            background: rec ? "#5F7A5E" : "var(--pp-ink)",
            color: "var(--pp-ground)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          {rec ? `Stop · ${sec}s` : blobUrl ? "Record again" : "Hold the room · start"}
        </button>

        {err && <p style={{ color: "var(--pp-muted)", marginTop: 12 }}>{err}</p>}
        {blobUrl && (
          <audio controls src={blobUrl} style={{ width: "100%", marginTop: 16 }} />
        )}

        <label style={{ display: "block", marginTop: 24, fontSize: 13 }}>
          About when (optional)
          <input
            value={aboutWhen}
            onChange={(e) => setAboutWhen(e.target.value)}
            placeholder="week of March 2026"
            style={{ display: "block", width: "100%", marginTop: 6, padding: 12, borderRadius: 12, border: "1px solid var(--pp-shadow-dark)" }}
          />
        </label>

        <p style={{ marginTop: 20, fontSize: 13, color: "var(--pp-muted)" }}>
          This page records in the browser. Create an account to keep the note in your vault.
        </p>
        <Link to="/signup" style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Keep this in an account →
        </Link>
      </main>
    </div>
  );
}
