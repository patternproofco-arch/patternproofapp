import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { replySupportRequest } from "@/lib/support-inbox.functions";

interface SupportReplyFormProps {
  id: string;
  replyBody: string | null;
  repliedAt: string | null;
  onReplied: () => void;
}

export function SupportReplyForm({ id, replyBody, repliedAt, onReplied }: SupportReplyFormProps) {
  const replyFn = useServerFn(replySupportRequest);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setNote(null);
    try {
      const r = await replyFn({ data: { id, reply: text } });
      setText("");
      setNote(r.emailed ? "Reply sent and saved." : "Reply saved. The email couldn't be sent yet.");
      onReplied();
    } catch {
      setNote("We couldn't send that reply. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 10, display: "grid", gap: 8 }}>
      {replyBody && repliedAt ? (
        <div data-testid="support-reply">
          <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
            Replied · {new Date(repliedAt).toLocaleString()}
          </div>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", fontSize: 14 }}>{replyBody}</p>
        </div>
      ) : null}
      <label style={{ fontSize: 12, color: "var(--ink-muted)" }}>
        {replyBody ? "Send another reply" : "Reply by email"}
        <textarea
          aria-label="Reply"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          style={{ display: "block", width: "100%", marginTop: 4, padding: 8, border: "1px solid var(--rule)", borderRadius: 3, background: "var(--paper)", font: "inherit" }}
        />
      </label>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="btn-primary" disabled={busy || !text.trim()} onClick={send}>
          {busy ? "Sending…" : "Send reply"}
        </button>
        {note ? <span style={{ fontSize: 13 }} aria-live="polite">{note}</span> : null}
      </div>
    </div>
  );
}
