import { useState } from "react";

export function DocumentAiReadConsent({ onRead }: { onRead: () => Promise<void> }) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <p>
        This file needs text recognition. You can keep it without using AI and enter a note
        yourself.
      </p>
      <label className="mt-2 flex items-start gap-2">
        <input
          type="checkbox"
          checked={accepted}
          disabled={busy}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        <span>
          I agree to send this file to OpenAI through Lovable for AI text recognition this time. It
          may contain private information. Check the returned text against the original. This cannot
          undo information already sent to the provider.
        </span>
      </label>
      <a href="/privacy" className="underline">
        Read how AI providers handle data
      </a>
      <button
        type="button"
        className="btn-ghost mt-2"
        disabled={!accepted || busy}
        onClick={async () => {
          if (!accepted || busy) return;
          setBusy(true);
          setError(null);
          try {
            await onRead();
          } catch {
            setError("Text could not be read. You can keep the file and enter a note yourself.");
          } finally {
            setBusy(false);
            setAccepted(false);
          }
        }}
      >
        {busy ? "Reading text…" : "Send this file for AI text recognition"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
