import { useState } from "react";
import { History, Paperclip } from "lucide-react";

export interface ImportedMessage {
  id: string;
  body: string | null;
  sender_side: string;
  sent_on: string | null;
  sent_at_time: string | null;
  date_confidence: string;
  has_attachment_marker: boolean;
  attachment_marker_text: string | null;
  field_provenance: Record<string, string> | null;
  source_document_ids: string[] | null;
  source_document_id: string | null;
  ocr_confidence?: number | null;
}

export interface Correction {
  id: string;
  message_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

type Field = "body" | "sender_side" | "sent_on" | "sent_at_time";

interface Props {
  message: ImportedMessage;
  thumbUrls: string[];
  corrections: Correction[];
  onCorrect: (field: Field, value: string | null) => void;
}

function Badge({ state }: { state: string | undefined }) {
  const corrected = state === "corrected";
  return (
    <span
      className="mono-meta"
      style={{
        fontSize: 10,
        padding: "1px 5px",
        borderRadius: 2,
        border: "1px solid rgba(26,18,36,0.14)",
        background: corrected ? "#1A1224" : "transparent",
        color: corrected ? "#FAF8F4" : "rgba(26,18,36,0.55)",
      }}
    >
      {corrected ? "corrected" : "extracted"}
    </span>
  );
}

const DATE_NOTE: Record<string, string> = {
  explicit_date: "date read from the screenshot",
  relative: "from “Today”/“Yesterday” — please double-check",
  time_only: "only a time was visible — no date",
  none: "no date or time was visible",
};

export function MessageRow({ message, thumbUrls, corrections, onCorrect }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const prov = message.field_provenance ?? {};
  const mine = message.sender_side === "outgoing";
  // Old, blurry, or flip-phone screenshots read badly. Rather than leaving a
  // blank or garbled row, we say so plainly and invite her to type it herself.
  const hardToRead =
    prov.body !== "corrected" &&
    ((message.ocr_confidence != null && message.ocr_confidence < 55) ||
      !(message.body ?? "").trim());

  return (
    <div
      style={{
        background: "var(--pp-card)",
        border: "1px solid rgba(26,18,36,0.14)",
        borderRadius: 2,
        borderLeft: `3px solid ${mine ? "#1A1224" : "rgba(26,18,36,0.25)"}`,
        padding: 14,
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Who sent this"
          value={message.sender_side}
          onChange={(e) => onCorrect("sender_side", e.target.value)}
          className="input-pp"
          style={{ width: "auto", minHeight: 40, fontSize: 13, padding: "6px 8px" }}
        >
          <option value="incoming">They sent it</option>
          <option value="outgoing">I sent it</option>
          <option value="unknown">Not sure</option>
        </select>
        <Badge state={prov.sender_side} />

        <input
          type="date"
          aria-label="Date"
          value={message.sent_on ?? ""}
          onChange={(e) => onCorrect("sent_on", e.target.value || null)}
          className="input-pp"
          style={{ width: "auto", minHeight: 40, fontSize: 13, padding: "6px 8px" }}
        />
        <input
          type="time"
          step={60}
          aria-label="Time"
          value={(message.sent_at_time ?? "").slice(0, 5)}
          onChange={(e) =>
            onCorrect("sent_at_time", e.target.value ? `${e.target.value}:00` : null)
          }
          className="input-pp"
          style={{ width: "auto", minHeight: 40, fontSize: 13, padding: "6px 8px" }}
        />
        <Badge
          state={
            prov.sent_on === "corrected" || prov.sent_at_time === "corrected"
              ? "corrected"
              : "extracted"
          }
        />
        <span className="mono-meta mono-meta--muted" style={{ fontSize: 10.5 }}>
          {DATE_NOTE[message.date_confidence] ?? ""}
        </span>
      </div>

      <textarea
        aria-label="Message text"
        defaultValue={message.body ?? ""}
        placeholder={hardToRead ? "Type what this message says" : undefined}
        onBlur={(e) => {
          if (e.target.value !== (message.body ?? "")) onCorrect("body", e.target.value);
        }}
        rows={Math.min(6, Math.max(2, Math.ceil((message.body?.length ?? 0) / 70)))}
        className="input-pp mt-2"
        style={{ fontSize: 14.5, lineHeight: 1.5 }}
      />
      {hardToRead && (
        <p className="mt-1 text-[12px]" style={{ color: "rgba(26,18,36,0.6)" }}>
          This one came out unclear. Type what it says if you can — or leave it and come back later.
          It stays in your record either way.
        </p>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Badge state={prov.body} />
        {message.has_attachment_marker && (
          <span className="mono-meta mono-meta--muted" style={{ fontSize: 10.5 }}>
            <Paperclip size={11} style={{ display: "inline", marginRight: 3 }} />
            an attachment was referenced ({message.attachment_marker_text}) — the file itself
            isn&apos;t recoverable from a screenshot
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {thumbUrls.map((u, i) => (
          <a key={u} href={u} target="_blank" rel="noreferrer" title="Open the original screenshot">
            <img
              src={u}
              alt={`Original screenshot ${i + 1} for this message`}
              style={{
                width: 44,
                height: 44,
                objectFit: "cover",
                border: "1px solid rgba(26,18,36,0.14)",
                borderRadius: 2,
              }}
            />
          </a>
        ))}
        {corrections.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="mono-meta"
            style={{ fontSize: 10.5, textDecoration: "underline", color: "rgba(26,18,36,0.6)" }}
          >
            <History size={11} style={{ display: "inline", marginRight: 3 }} />
            {corrections.length} correction{corrections.length === 1 ? "" : "s"}
          </button>
        )}
      </div>

      {showHistory && (
        <ul className="mt-2 space-y-1" style={{ fontSize: 12, color: "rgba(26,18,36,0.65)" }}>
          {corrections.map((c) => (
            <li key={c.id}>
              <span className="mono-meta mono-meta--muted">
                {new Date(c.created_at).toLocaleString()}
              </span>{" "}
              {c.field}: “{c.old_value ?? "—"}” → “{c.new_value ?? "—"}”
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
