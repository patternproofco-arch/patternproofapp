import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { clearCaptureDraft, readCaptureDraft, type CaptureDraft } from "@/lib/capture-draft";

/** After /capture → signup, point the survivor at the vault recorder. */
export function CaptureVaultNudge() {
  const [draft, setDraft] = useState<CaptureDraft | null>(null);
  useEffect(() => {
    setDraft(readCaptureDraft());
  }, []);
  if (!draft) return null;
  return (
    <aside
      className="card-pp"
      style={{ padding: 16, border: "1px solid var(--rule, #d4cfc4)", borderRadius: 3 }}
    >
      <p className="label-eyebrow">Note started before signup</p>
      <p style={{ margin: "8px 0", fontSize: 14 }}>
        {draft.aboutWhen
          ? `You marked “${draft.aboutWhen}.” Record the 60-second note in your vault so it is stored with your account.`
          : "You started a 60-second note before creating an account. Record it here so it is stored with your vault."}
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link to="/live-recording" style={{ fontSize: 13 }}>
          Record in vault →
        </Link>
        <button
          type="button"
          onClick={() => {
            clearCaptureDraft();
            setDraft(null);
          }}
          style={{ background: "none", border: 0, fontSize: 13, cursor: "pointer" }}
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
}
