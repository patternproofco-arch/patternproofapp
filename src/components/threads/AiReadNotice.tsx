import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

/**
 * Plain-language consent shown BEFORE anything is uploaded on the three
 * "Message threads" screens that read a survivor's media with a third-party AI
 * service. The on-device import page (/import-messages) never sends anything
 * to an AI, so it is offered here as the private alternative.
 */
type Kind = "screenshots" | "call log photos" | "recording";

const WHAT: Record<Kind, string> = {
  screenshots: "The screenshots you add are sent to an AI service, which reads the text in them.",
  "call log photos":
    "The call log photos you add are sent to an AI service, which reads the call rows in them.",
  recording:
    "The audio from your recording is sent to an AI transcription service, which writes out what was said.",
};

interface Props {
  kind: Kind;
  accepted: boolean;
  onChange: (accepted: boolean) => void;
}

export function AiReadNotice({ kind, accepted, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="How this is read"
      style={{
        display: "flex",
        gap: 12,
        padding: 14,
        background: "rgba(197,103,74,0.08)",
        border: "1px solid rgba(197,103,74,0.2)",
        marginBottom: 14,
      }}
    >
      <ShieldAlert size={20} color="var(--pp-urgent)" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 13.5, color: "#3A3849", lineHeight: 1.55 }}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: "var(--pp-urgent)" }}>
          This option uses a third-party AI
        </div>
        {WHAT[kind]} It goes through Google or OpenAI, our AI providers, and it can be wrong — the
        result is labeled <em>AI-extracted — unverified</em>. Your original files stay yours and are
        what counts as evidence.{" "}
        <strong>
          If you&apos;d rather nothing leaves your device,{" "}
          <Link to="/import-messages" style={{ textDecoration: "underline" }}>
            use the on-device import
          </Link>{" "}
          instead.
        </strong>
        <label className="mt-3 flex items-start gap-2" style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            style={{ marginTop: 3 }}
            checked={accepted}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>I understand, and I want to use the AI option.</span>
        </label>
      </div>
    </div>
  );
}
