import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { suggestRequestMatches } from "@/lib/jev-proposals.functions";
import { confirmJevProcessing } from "@/lib/jev-proposals";
import type { JevChoiceProposal } from "@/lib/jev-proposals";

/** Informational only: does not create, resolve or send a request. */
export function JevRequestNudge({
  clientId,
  title,
  details,
}: {
  clientId: string;
  title: string;
  details: string;
}) {
  const check = useServerFn(suggestRequestMatches);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    model: string | null;
    suggestion: JevChoiceProposal | null;
    checkedCount: number;
  } | null>(null);
  const revision = useRef(0);
  useEffect(() => {
    revision.current++;
    setResult(null);
  }, [clientId, title, details]);
  async function run() {
    if (
      !confirmJevProcessing("this request text and saved text from up to 40 currently shared files")
    )
      return;
    const current = revision.current;
    setBusy(true);
    setResult(null);
    try {
      const r = await check({ data: { clientId, title, details, aiConsent: true } });
      if (revision.current === current) setResult(r);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't check shared files.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="text-xs">
      <button
        type="button"
        className="att-btn-secondary"
        disabled={busy || !title.trim()}
        onClick={() => void run()}
      >
        {busy ? "Checking…" : "Check shared files with Jev"}
      </button>
      {result && (
        <div className="mt-2" aria-live="polite">
          <p>
            Software suggestion · {result.model ?? "No AI call needed"} · {result.checkedCount}{" "}
            eligible files checked
          </p>
          <p>
            {result.suggestion
              ? `A shared file may match: ${result.suggestion.label}. Review it before requesting another copy.`
              : "No confident match in the checked files. This does not mean the item is missing or unavailable."}
          </p>
          <p>This check does not send, resolve, or change your request.</p>
          <button type="button" className="att-btn-secondary mt-2" onClick={() => setResult(null)}>
            Dismiss suggestion
          </button>
        </div>
      )}
    </div>
  );
}
