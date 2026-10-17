import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { suggestRequestMatches } from "@/lib/jev-proposals.functions";
import { getSignedEvidenceUrl } from "@/lib/attorney-portal.functions";
import { confirmJevProcessing, type JevRequestResult } from "@/lib/jev-proposals";

/** Informational only: a source preview is never a request action or a saved evidence link. */
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
  const openFile = useServerFn(getSignedEvidenceUrl);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<JevRequestResult | null>(null);
  const revision = useRef(0);
  useEffect(() => {
    revision.current++;
    setResult(null);
  }, [clientId, title, details]);
  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(
      () => setResult(null),
      Math.min(5 * 60_000, Math.max(0, Date.parse(result.expiresAt) - Date.now())),
    );
    return () => window.clearTimeout(timer);
  }, [result]);
  async function run() {
    if (!confirmJevProcessing()) return;
    const current = revision.current;
    setBusy(true);
    setResult(null);
    try {
      const response = await check({ data: { clientId, title, details, aiConsent: true } });
      if (revision.current === current) setResult(response);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't check shared files.");
    } finally {
      setBusy(false);
    }
  }
  async function openSource() {
    if (!result?.suggestion || Date.parse(result.expiresAt) <= Date.now()) {
      setResult(null);
      return;
    }
    setOpening(true);
    try {
      const response = await openFile({
        data: { clientId, evidenceId: result.suggestion.evidenceId },
      });
      if (response.url) {
        const a = document.createElement("a");
        a.href = response.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.click();
      } else toast("That file isn't available right now.");
    } catch (e) {
      setResult(null);
      toast(e instanceof Error ? e.message : "Couldn't open that file.");
    } finally {
      setOpening(false);
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
        {busy ? "Checking…" : "Check already-shared files"}
      </button>
      {result && (
        <div className="mt-2" aria-live="polite">
          <p>Software suggestion · {result.model ?? "Local search only"}</p>
          <p>
            Searched {result.searchedCount} eligible shared files locally; Jev checked excerpts from{" "}
            {result.checkedCount} candidates. Other vault files were not searched.
          </p>
          {result.suggestion ? (
            <>
              <p className="mt-2 font-semibold">Possible match: {result.suggestion.title}</p>
              <p>Source: {result.suggestion.sourceField.replaceAll("_", " ")} · excerpt only</p>
              <blockquote className="my-2 whitespace-pre-wrap border-l-2 pl-3">
                {result.suggestion.excerpt}
              </blockquote>
              <button
                type="button"
                className="att-btn-secondary"
                disabled={opening}
                onClick={() => void openSource()}
              >
                {opening ? "Opening…" : "Open shared file"}
              </button>
            </>
          ) : (
            <p className="mt-2">
              No clear match in this check. This does not mean the item is missing or unavailable.
            </p>
          )}
          <p className="mt-2">
            Review the source yourself. This check does not send, resolve, or change your request.
            Results clear after five minutes.
          </p>
          <button type="button" className="att-btn-secondary mt-2" onClick={() => setResult(null)}>
            Dismiss suggestion
          </button>
        </div>
      )}
    </div>
  );
}
