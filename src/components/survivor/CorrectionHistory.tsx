import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listIncidentRevisions, type IncidentRevision } from "@/lib/incident-revisions.functions";

export function CorrectionHistory({ incidentId }: { incidentId: string }) {
  const load = useServerFn(listIncidentRevisions);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<IncidentRevision[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRows(null);
    setError(false);
    load({ data: { incident_id: incidentId } }).then(
      (r) => {
        if (!cancelled) setRows(r);
      },
      () => {
        if (!cancelled) setError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [incidentId, open, attempt, load]);

  return (
    <section className="mt-3 text-[13px]" aria-label="Correction history">
      <button
        type="button"
        className="btn-ghost"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Hide correction history" : "See correction history"}
      </button>
      {open && (
        <div className="mt-2" aria-live="polite">
          <p>
            Earlier versions are kept privately in your account. This history is not included in
            shared views or exports.
          </p>
          {error ? (
            <p role="alert">
              We couldn't load the history.{" "}
              <button type="button" className="underline" onClick={() => setAttempt(attempt + 1)}>
                Try again
              </button>
            </p>
          ) : rows === null ? (
            <p>Loading…</p>
          ) : rows.length === 0 ? (
            <p>No earlier corrections recorded.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {rows.map((r) => (
                <li key={r.id} className="rounded border p-3">
                  <p>
                    Before the change on {new Date(r.changedAt).toLocaleString()} · {r.dateText}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{r.description}</p>
                </li>
              ))}
            </ul>
          )}
          {rows?.length === 100 && <p>Showing the latest 100 corrections.</p>}
        </div>
      )}
    </section>
  );
}
