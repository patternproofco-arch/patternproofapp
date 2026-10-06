import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getClioAvailability, getClioStatus } from "@/lib/clio.functions";
import { listClioMatterLinks } from "@/lib/clio-matter-links.functions";
import {
  getClioTransfer,
  previewClioTransfer,
  resumeClioTransfer,
  retryClioTransferItem,
  startClioTransfer,
  stepClioTransfer,
  type JobView,
  type TransferPreview,
} from "@/lib/clio-transfer.functions";
import { useChronologyWorkspace } from "@/components/attorney/ChronologyWorkspace";

/**
 * Send numbered exhibits to the linked Clio matter.
 * Connect → Select matter → Review exhibits → Transfer.
 *
 * Nothing is sent until the attorney has seen the matter and the list. "Sent" is only
 * shown for a document after Clio confirmed it. Revoking later, or disconnecting Clio,
 * does not remove what was already sent.
 */

const STATUS_TEXT: Record<string, string> = {
  pending: "Waiting",
  uploading: "Sending…",
  confirmed: "Confirmed in Clio",
  failed: "Failed — not sent",
  skipped: "Skipped",
  needs_review: "Check Clio (partial / unclear)",
};

const JOB_STATUS_TEXT: Record<string, string> = {
  running: "In progress (resumable)",
  stopped: "Paused",
  completed: "Confirmed complete",
  completed_with_errors: "Partly completed — some items failed",
};

function msg(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

export function ClioTransferPanel({ clientId }: { clientId: string }) {
  const ws = useChronologyWorkspace(clientId);
  const availability = useServerFn(getClioAvailability);
  const status = useServerFn(getClioStatus);
  const matterLinks = useServerFn(listClioMatterLinks);
  const preview = useServerFn(previewClioTransfer);
  const start = useServerFn(startClioTransfer);
  const step = useServerFn(stepClioTransfer);
  const reload = useServerFn(getClioTransfer);
  const retry = useServerFn(retryClioTransferItem);
  const resume = useServerFn(resumeClioTransfer);

  const linkId = ws.data?.linkId ?? null;
  const [available, setAvailable] = useState<boolean | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [matter, setMatter] = useState<string | null | undefined>(undefined);
  const [includeZip, setIncludeZip] = useState(false);
  const [review, setReview] = useState<TransferPreview | null>(null);
  const [job, setJob] = useState<JobView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    void availability()
      .then((a) => setAvailable(a.available))
      .catch(() => setAvailable(false));
    void status()
      .then((s) => setConnected(s.connected))
      .catch(() => setConnected(false));
  }, [availability, status]);

  useEffect(() => {
    if (!linkId) return;
    void matterLinks()
      .then((r) => {
        const m = (r.links ?? []).find((l) => l.attorney_client_link_id === linkId);
        setMatter(m ? [m.clio_matter_display_number, m.clio_matter_description].filter(Boolean).join(" · ") || "Linked matter" : null);
      })
      .catch(() => setMatter(null));
  }, [linkId, matterLinks]);

  const drive = useCallback(
    async (id: string) => {
      stopRef.current = false;
      setBusy(true);
      setError(null);
      try {
        let last = "";
        for (;;) {
          const v = await step({ data: { jobId: id } });
          setJob(v);
          const sig = JSON.stringify(v.items.map((i) => [i.status, i.attempts]));
          if (v.status !== "running" || stopRef.current || sig === last) break;
          last = sig;
        }
      } catch (e) {
        setError(msg(e, "We couldn't continue the transfer. What was already sent is in Clio. Reload to see where it stands."));
        try {
          setJob(await reload({ data: { jobId: id } }));
        } catch {
          /* leave the last known state */
        }
      } finally {
        setBusy(false);
      }
    },
    [step, reload],
  );

  if (!ws.data) return null;
  if (!ws.data.package) {
    return (
      <section className="mb-10 print:hidden">
        <h2 className="mb-2 font-display text-lg">Send exhibits to Clio</h2>
        <p className="text-sm text-muted-foreground">
          Fix the exhibit numbers above first, so what goes to Clio carries numbers that won&apos;t change.
        </p>
      </section>
    );
  }

  const ready = available && connected && matter;

  const doReview = async () => {
    if (!linkId) return;
    setBusy(true);
    setError(null);
    try {
      setReview(await preview({ data: { linkId, includeZip } }));
    } catch (e) {
      setReview(null);
      setError(msg(e, "We couldn't prepare the list. Nothing was sent."));
    } finally {
      setBusy(false);
    }
  };

  const doStart = async () => {
    if (!linkId) return;
    setBusy(true);
    setError(null);
    try {
      const j = await start({ data: { linkId, includeZip } });
      setJob(j);
      setReview(null);
      setBusy(false);
      await drive(j.id);
    } catch (e) {
      setError(msg(e, "We couldn't start the transfer. Nothing was sent."));
      setBusy(false);
    }
  };

  return (
    <section className="mb-10 print:hidden">
      <h2 className="mb-2 font-display text-lg">Send exhibits to Clio</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Sends each numbered exhibit as its own document, plus an exhibit index, to the Clio matter linked to this case.
        Once a document is in Clio, withdrawing access or disconnecting Clio here does not remove it from Clio.
      </p>

      <ol className="mb-3 space-y-1 text-sm">
        <li>
          1. Connect Clio:{" "}
          {available === false ? (
            <span>Clio isn&apos;t available for this account yet.</span>
          ) : connected ? (
            "connected"
          ) : (
            <>
              not connected.{" "}
              <Link to="/billing" className="underline">
                Connect in Billing
              </Link>
            </>
          )}
        </li>
        <li>
          2. Matter:{" "}
          {matter === undefined ? (
            "checking…"
          ) : matter ? (
            <strong>{matter}</strong>
          ) : (
            <>
              no matter linked to this case.{" "}
              <Link to="/billing" className="underline">
                Link one in Billing
              </Link>{" "}
              (the client must have approved Clio sharing)
            </>
          )}
        </li>
        <li>3. Review the exhibits below.</li>
        <li>4. Transfer.</li>
      </ol>

      {error && (
        <p role="alert" className="mb-3 text-sm">
          {error}
        </p>
      )}

      {!job && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="text-xs">
            <input type="checkbox" checked={includeZip} onChange={(e) => setIncludeZip(e.target.checked)} /> Also send one ZIP of the
            whole binder
          </label>
          <button
            className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={doReview}
            disabled={!ready || busy}
          >
            {busy ? "Preparing…" : "Review what will be sent"}
          </button>
        </div>
      )}

      {review && !job && (
        <div className="mb-3 rounded-lg border border-border p-3 text-sm">
          <p>
            <strong>To Clio matter: {review.matterLabel}</strong>
            <br />
            Exhibit package v{review.packageVersion}. {review.plan.items.length} document(s):
          </p>
          <ul className="ml-4 mt-1 list-disc text-xs">
            {review.plan.items.map((i) => (
              <li key={i.seq}>
                {i.documentName}
                {review.alreadySent.includes(i.documentName) ? " (already in Clio, won't be sent again)" : ""}
                {i.note ? `. ${i.note}` : ""}
              </li>
            ))}
          </ul>
          {review.plan.filesWithoutPath.length > 0 && (
            <p className="mt-2 text-xs">
              {review.plan.filesWithoutPath.length} file(s) have no readable stored file. They will be reported as NOT sent.
            </p>
          )}
          {review.plan.excluded.length > 0 && (
            <div className="mt-2 text-xs">
              <strong>Not being sent ({review.plan.excluded.length}):</strong>
              <ul className="ml-4 list-disc">
                {review.plan.excluded.map((e) => (
                  <li key={e.itemKey}>
                    {"“"}
                    {e.label}
                    {"”"}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            The client has approved sharing with Clio for this case. Nothing is sent until you press Send.
          </p>
          <button
            className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            onClick={doStart}
            disabled={busy}
          >
            Send to Clio
          </button>
        </div>
      )}

      {job && (
        <div className="rounded-lg border border-border p-3 text-sm" aria-live="polite">
          <p>
            <strong>{job.summary}</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Transfer: {JOB_STATUS_TEXT[job.status] ?? job.status} · Matter: {job.matterLabel}
            {typeof job.packageVersion === "number" ? ` · Exhibit package v${job.packageVersion}` : ""}
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {job.items.map((i) => (
              <li key={i.id}>
                <span className="font-semibold">{STATUS_TEXT[i.status] ?? i.status}</span> · {i.documentName}
                {i.errorMessage ? <div>{i.errorMessage}</div> : null}
                {i.note ? <div className="text-muted-foreground">{i.note}</div> : null}
                {i.orphanClioDocumentIds.length > 0 && (
                  <div>Partly uploaded copies may remain in Clio (document id {i.orphanClioDocumentIds.join(", ")}).</div>
                )}
                {(i.status === "failed" || i.status === "needs_review") && (
                  <button
                    className="underline"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        i.status === "needs_review" &&
                        !window.confirm("Have you checked the matter in Clio and this document is NOT there?")
                      )
                        return;
                      try {
                        await retry({ data: { jobId: job.id, itemId: i.id, confirmNotInClio: i.status === "needs_review" } });
                        await drive(job.id);
                      } catch (e) {
                        setError(msg(e, "We couldn't retry that document."));
                      }
                    }}
                  >
                    Try again
                  </button>
                )}
              </li>
            ))}
          </ul>
          {job.excluded.length > 0 && (
            <p className="mt-2 text-xs">{job.excluded.length} item(s) were not sent because they have no fixed exhibit number.</p>
          )}
          {job.status === "stopped" && (
            <button
              className="mt-2 rounded-lg border border-border px-3 py-1.5 text-sm"
              disabled={busy}
              onClick={async () => {
                try {
                  await resume({ data: { jobId: job.id } });
                  await drive(job.id);
                } catch (e) {
                  setError(msg(e, "We couldn't continue. Check the reason above."));
                }
              }}
            >
              Resume paused transfer
            </button>
          )}
          {job.status === "running" && !busy && (
            <button className="mt-2 rounded-lg border border-border px-3 py-1.5 text-sm" onClick={() => drive(job.id)}>
              Continue partial transfer
            </button>
          )}
          {job.status !== "running" && (
            <button className="ml-2 mt-2 text-xs underline" onClick={() => setJob(null)}>
              Done
            </button>
          )}
        </div>
      )}
    </section>
  );
}
