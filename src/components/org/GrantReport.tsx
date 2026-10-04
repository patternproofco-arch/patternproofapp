import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  approveGrantReportDraft,
  createGrantReportDraft,
  getGrantReportDraft,
  listGrantReportDrafts,
  recordGrantReportExport,
  recordGrantReportReceipt,
  saveGrantReportDraft,
  type DraftView,
} from "@/lib/org-grant-report-workspace.functions";
import {
  DEFAULT_TEMPLATE,
  SECTION_LABEL,
  SMALL_COUNT_THRESHOLD,
  STATUS_LABEL,
  VALUE_STATE_LABEL,
  toCsvRows,
  type ReportStatus,
  type ResolvedRow,
  type Section,
  type StaffEntry,
} from "@/lib/grant-report-model";
import { csvCell } from "@/lib/csv-safe";

/**
 * Grant report workspace for org owners/admins.
 *
 * One path: start a report → fill what PatternProof can't know → approve →
 * export → record that you submitted it. PatternProof never sends anything to a
 * funder, and this screen never says it did.
 */

type Summary = Awaited<ReturnType<typeof listGrantReportDrafts>>[number];
type SaveState = "idle" | "saving" | "saved" | "failed";
type StaffState = StaffEntry["state"] | "";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function message(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

const STATE_CHOICES: Array<{ value: StaffState; label: string }> = [
  { value: "", label: "Choose…" },
  { value: "staff_entered", label: "Enter a value" },
  { value: "not_collected", label: "We don't collect this" },
  { value: "not_applicable", label: "Doesn't apply" },
  { value: "unknown", label: "Can't determine" },
];

export function GrantReport() {
  const list = useServerFn(listGrantReportDrafts);
  const create = useServerFn(createGrantReportDraft);
  const open = useServerFn(getGrantReportDraft);
  const [drafts, setDrafts] = useState<Summary[] | null>(null);
  const [current, setCurrent] = useState<DraftView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const [from, setFrom] = useState(isoDay(new Date(now.getFullYear(), 0, 1)));
  const [to, setTo] = useState(isoDay(now));

  const refreshList = useCallback(async () => {
    try {
      setDrafts(await list());
    } catch (e) {
      setError(message(e, "We couldn't load your reports. Try again in a moment."));
    }
  }, [list]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      setCurrent(await create({ data: { templateId: DEFAULT_TEMPLATE.id, from, to } }));
      void refreshList();
    } catch (e) {
      setError(message(e, "We couldn't start the report. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  };

  const openDraft = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      setCurrent(await open({ data: { id } }));
    } catch (e) {
      setError(message(e, "We couldn't open that report. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  };

  if (current) {
    return (
      <Editor
        key={current.id}
        view={current}
        onChange={(v) => {
          setCurrent(v);
          void refreshList();
        }}
        onClose={() => {
          setCurrent(null);
          void refreshList();
        }}
      />
    );
  }

  return (
    <section className="card" style={{ padding: 20 }}>
      <div className="label-eyebrow">Grant reports</div>
      <h2 className="mt-1 font-serif text-[22px]">Reports for funders</h2>
      <p className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        PatternProof fills in what it can count from records and leaves the rest for you. It never
        sends anything to a funder: you export the report, send it yourself, and record that here.
        Totals only. No names and no case contents.
      </p>
      <div className="no-print mt-3 flex flex-wrap items-end gap-3">
        <label className="text-[13px]">
          From
          <input type="date" className="input ml-2" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-[13px]">
          To
          <input type="date" className="input ml-2" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="btn-primary" onClick={start} disabled={busy}>
          {busy ? "Working…" : "Start a report"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[14px]">
          {error}
        </p>
      )}
      <div className="mt-5">
        <h3 className="font-serif text-[18px]">Your reports</h3>
        {drafts === null ? (
          <p className="mt-2 text-[13px]">Loading…</p>
        ) : drafts.length === 0 ? (
          <p className="mt-2 text-[13px]">No reports yet.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {drafts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[14px]">
                <span>
                  {d.period_from} to {d.period_to}{" "}
                  <span style={{ color: "var(--muted-foreground)" }}>
                    · {STATUS_LABEL[d.status as ReportStatus]}
                  </span>
                </span>
                <button className="btn-ghost" onClick={() => openDraft(d.id)} disabled={busy}>
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Editor({
  view,
  onChange,
  onClose,
}: {
  view: DraftView;
  onChange: (v: DraftView) => void;
  onClose: () => void;
}) {
  const save = useServerFn(saveGrantReportDraft);
  const approve = useServerFn(approveGrantReportDraft);
  const recordExport = useServerFn(recordGrantReportExport);
  const recordReceipt = useServerFn(recordGrantReportReceipt);

  const [entries, setEntries] = useState<Record<string, StaffEntry | undefined>>(view.entries ?? {});
  const [reviewed, setReviewed] = useState<string[]>(view.small_count_reviewed ?? []);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [dest, setDest] = useState("");
  const [receivedOn, setReceivedOn] = useState(isoDay(new Date()));
  const [reference, setReference] = useState("");

  const locked = view.status === "submitted";
  const rowsBySection = useMemo(() => {
    const map = new Map<Section, ResolvedRow[]>();
    for (const r of view.rows) map.set(r.section, [...(map.get(r.section) ?? []), r]);
    return Array.from(map.entries());
  }, [view.rows]);
  const specById = useMemo(() => new Map(DEFAULT_TEMPLATE.rows.map((s) => [s.id, s])), []);

  const setEntry = (id: string, patch: Omit<Partial<StaffEntry>, "state"> & { state?: StaffState }) => {
    setDirty(true);
    setSaveState("idle");
    setEntries((prev) => {
      const cur = prev[id];
      if (patch.state === "") {
        const { [id]: _drop, ...rest } = prev;
        return rest;
      }
      const state = (patch.state ?? cur?.state ?? "staff_entered") as StaffEntry["state"];
      return { ...prev, [id]: { ...cur, ...patch, state } as StaffEntry };
    });
  };

  const persist = async (refreshNumbers = false) => {
    setSaveState("saving");
    setError(null);
    try {
      const next = await save({
        data: {
          id: view.id,
          expectedVersion: view.version,
          entries: entries as Record<string, unknown>,
          smallCountReviewed: reviewed,
          refreshNumbers,
        },
      });
      setDirty(false);
      setSaveState("saved");
      onChange(next);
      return next;
    } catch (e) {
      setSaveState("failed");
      setError(message(e, "We couldn't save. Your changes are still on this page. Try again."));
      return null;
    }
  };

  const doApprove = async () => {
    setWorking(true);
    setError(null);
    setBlockers([]);
    try {
      const res = await approve({ data: { id: view.id } });
      if (res.ok) onChange(res.view);
      else {
        setBlockers(res.issues.map((i) => i.message));
        onChange(res.view);
      }
    } catch (e) {
      setError(message(e, "We couldn't approve the report. Try again in a moment."));
    } finally {
      setWorking(false);
    }
  };

  // The server checks the approved version is intact and records the export first.
  // The file is only produced if that succeeds.
  const doExport = async (kind: "csv" | "print") => {
    setWorking(true);
    setError(null);
    try {
      const exported = await recordExport({ data: { id: view.id } });
      onChange(exported);
      if (kind === "print") {
        setTimeout(() => window.print(), 50);
      } else {
        const csv = toCsvRows(
          {
            org_name: exported.org_name,
            template_name: exported.template.name,
            period_from: exported.period_from,
            period_to: exported.period_to,
            status: exported.status,
            version: exported.version,
            approved_at: exported.approved_at,
            content_hash: exported.approved_hash,
          },
          exported.rows,
        )
          .map((r) => r.map((c) => csvCell(c)).join(","))
          .join("\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `grant-report-${exported.period_from}-to-${exported.period_to}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError(message(e, "We couldn't export the report. Nothing was downloaded. Try again."));
    } finally {
      setWorking(false);
    }
  };

  const doReceipt = async () => {
    setWorking(true);
    setError(null);
    try {
      onChange(
        await recordReceipt({
          data: { id: view.id, destination: dest, receivedOn, reference: reference || null },
        }),
      );
    } catch (e) {
      setError(message(e, "We couldn't record that. Try again in a moment."));
    } finally {
      setWorking(false);
    }
  };

  const approvedOrLater = view.status !== "draft";
  const header = {
    org_name: view.org_name,
    template_name: view.template.name,
    period_from: view.period_from,
    period_to: view.period_to,
    status: view.status,
    version: view.version,
    approved_at: view.approved_at,
    content_hash: view.approved_hash,
  };

  return (
    <section className="card" style={{ padding: 20 }}>
      <div className="no-print flex items-center justify-between gap-3">
        <button className="btn-ghost" onClick={onClose}>
          ← All reports
        </button>
        <span className="text-[13px]" aria-live="polite">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved"}
          {saveState === "failed" && "Not saved"}
          {saveState === "idle" && dirty && "Unsaved changes"}
        </span>
      </div>

      <div className="label-eyebrow mt-2">{view.template.name}</div>
      <h2 className="mt-1 font-serif text-[22px]">
        {view.org_name ?? "Your organization"} · {view.period_from} to {view.period_to}
      </h2>
      <p className="mt-1 text-[14px]" role="status">
        <strong>{STATUS_LABEL[view.status]}.</strong>{" "}
        {view.status === "draft" && "Not final. It can't be exported until you approve it."}
        {view.status === "approved" && "Approved. Export it, send it to your funder yourself, then record it here."}
        {view.status === "exported" &&
          "Exported. PatternProof can't see whether your funder received it. Record it below once you have sent it."}
        {view.status === "submitted" &&
          `You recorded this as submitted${view.receipt ? ` to ${view.receipt.destination} on ${view.receipt.received_on}` : ""}. PatternProof did not send it and can't confirm delivery.`}
      </p>
      <p className="no-print mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        {view.template.description}
      </p>

      {error && (
        <p role="alert" className="no-print mt-3 text-[14px]">
          {error}
        </p>
      )}

      {approvedOrLater && !locked && (
        <p className="no-print mt-3 text-[13px]">
          Changing anything below returns this report to draft and removes the approval.
        </p>
      )}

      {view.caveats.length > 0 && (
        <div className="no-print mt-3 text-[13px]">
          <strong>Read before you approve</strong>
          <ul className="ml-4 list-disc">
            {view.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="no-print mt-4">
        {rowsBySection.map(([section, rows]) => (
          <div key={section} className="mt-5">
            <h3 className="font-serif text-[18px]">{SECTION_LABEL[section]}</h3>
            {rows.map((r) => {
              const spec = specById.get(r.id)!;
              const entry = entries[r.id];
              const record = !!spec.derivedKey;
              const stateValue: StaffState = record ? "" : (entry?.state ?? "");
              return (
                <div key={r.id} className="mt-3 border-b pb-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-[14px] font-semibold">{r.label}</div>
                    <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                      {r.unit === "unique_clients" ? "Counts people" : r.unit === "service_events" ? "Counts events" : "Text"}
                      {" · "}
                      {VALUE_STATE_LABEL[r.state]}
                    </div>
                  </div>
                  <p className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                    {r.definition}
                  </p>
                  {record ? (
                    <div className="mt-1 text-[18px] font-semibold">{r.display}</div>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-start gap-2">
                      <label className="text-[13px]">
                        <span className="sr-only">{r.label}: how to answer</span>
                        <select
                          className="input"
                          value={stateValue}
                          disabled={locked}
                          onChange={(e) => setEntry(r.id, { state: e.target.value as StaffState })}
                        >
                          {STATE_CHOICES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {entry?.state === "staff_entered" && spec.unit !== "text" && (
                        <label className="text-[13px]">
                          <span className="sr-only">{r.label}: number</span>
                          <input
                            className="input"
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            disabled={locked}
                            value={entry.count ?? ""}
                            onChange={(e) =>
                              setEntry(r.id, {
                                count: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      )}
                      {entry?.state === "staff_entered" && spec.unit === "text" && (
                        <label className="w-full text-[13px]">
                          <span className="sr-only">{r.label}: text</span>
                          <textarea
                            className="input w-full"
                            rows={spec.id === "narrative" ? 6 : 3}
                            disabled={locked}
                            value={entry.text ?? ""}
                            onChange={(e) => setEntry(r.id, { text: e.target.value })}
                          />
                        </label>
                      )}
                    </div>
                  )}
                  {r.small_count && (
                    <label className="mt-2 flex items-start gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        disabled={locked}
                        checked={reviewed.includes(r.id)}
                        onChange={(e) => {
                          setDirty(true);
                          setSaveState("idle");
                          setReviewed((prev) =>
                            e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id),
                          );
                        }}
                      />
                      <span>
                        This count is under {SMALL_COUNT_THRESHOLD}, so the report shows &quot;fewer than{" "}
                        {SMALL_COUNT_THRESHOLD}&quot;. I reviewed it and it is safe to report.
                      </span>
                    </label>
                  )}
                  {!record && entry && (
                    <label className="mt-2 block text-[12px]">
                      <span className="sr-only">{r.label}: note</span>
                      <input
                        className="input w-full"
                        placeholder="Optional note for your funder or your records"
                        maxLength={500}
                        disabled={locked}
                        value={entry.note ?? ""}
                        onChange={(e) => setEntry(r.id, { note: e.target.value })}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {(blockers.length > 0 || (view.status === "draft" && view.issues.some((i) => i.severity === "error"))) && (
        <div className="no-print mt-5 text-[13px]" role="status">
          <strong>Before you can approve</strong>
          <ul className="ml-4 list-disc">
            {(blockers.length ? blockers : view.issues.filter((i) => i.severity === "error").map((i) => i.message)).map(
              (m) => (
                <li key={m}>{m}</li>
              ),
            )}
          </ul>
        </div>
      )}
      {view.issues.some((i) => i.severity === "warning") && (
        <div className="no-print mt-3 text-[13px]">
          <strong>Worth a second look</strong>
          <ul className="ml-4 list-disc">
            {view.issues
              .filter((i) => i.severity === "warning")
              .map((i) => (
                <li key={i.message}>{i.message}</li>
              ))}
          </ul>
        </div>
      )}

      <div className="no-print mt-5 flex flex-wrap gap-2">
        {!locked && (
          <button className="btn-ghost" onClick={() => persist(false)} disabled={!dirty || saveState === "saving" || working}>
            Save
          </button>
        )}
        {!locked && (
          <button className="btn-ghost" onClick={() => persist(true)} disabled={dirty || saveState === "saving" || working}>
            Re-read the numbers from records
          </button>
        )}
        {view.status === "draft" && (
          <button className="btn-primary" onClick={doApprove} disabled={dirty || working}>
            {working ? "Checking…" : "Approve"}
          </button>
        )}
        {(view.status === "approved" || view.status === "exported" || view.status === "submitted") && (
          <>
            <button className="btn-primary" onClick={() => doExport("csv")} disabled={working || view.status === "submitted"}>
              Export spreadsheet
            </button>
            <button className="btn-ghost" onClick={() => doExport("print")} disabled={working || view.status === "submitted"}>
              Print or save as PDF
            </button>
          </>
        )}
      </div>
      {dirty && !locked && (
        <p className="no-print mt-2 text-[12px]">Save your changes before approving or exporting.</p>
      )}

      {view.status === "exported" && (
        <div className="no-print mt-6 border-t pt-4">
          <h3 className="font-serif text-[18px]">Record that you submitted it</h3>
          <p className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Only after you have sent it to your funder yourself. This is your own record. PatternProof
            can&apos;t check that it arrived.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <label className="text-[13px]">
              Where you sent it
              <input className="input ml-2" value={dest} onChange={(e) => setDest(e.target.value)} maxLength={200} />
            </label>
            <label className="text-[13px]">
              Date received
              <input type="date" className="input ml-2" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
            </label>
            <label className="text-[13px]">
              Confirmation number (optional)
              <input className="input ml-2" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={200} />
            </label>
            <button className="btn-primary" onClick={doReceipt} disabled={working || !dest.trim()}>
              Record it
            </button>
          </div>
        </div>
      )}

      {/* What prints, and what the spreadsheet contains, in the same words. */}
      <div className="print-only mt-4">
        {view.status === "draft" && (
          <p>
            <strong>DRAFT — not approved. Do not submit.</strong>
          </p>
        )}
        <p>
          {header.template_name} · {header.period_from} to {header.period_to} · {STATUS_LABEL[header.status]} · version{" "}
          {header.version}
          {header.content_hash ? ` · fingerprint ${header.content_hash.slice(0, 16)}` : ""}
        </p>
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr>
              <th>Section</th>
              <th>Row</th>
              <th>Counts</th>
              <th>Value</th>
              <th>Basis</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td>{SECTION_LABEL[r.section]}</td>
                <td>
                  {r.label}
                  <div>{r.definition}</div>
                </td>
                <td>{r.unit === "unique_clients" ? "Unique survivors" : r.unit === "service_events" ? "Service events" : "Text"}</td>
                <td>{r.display}</td>
                <td>{VALUE_STATE_LABEL[r.state]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Counts under {SMALL_COUNT_THRESHOLD} are shown as &quot;fewer than {SMALL_COUNT_THRESHOLD}&quot;. Rows marked
          &quot;From PatternProof records&quot; count activity recorded in PatternProof, not services outside it. This is
          not a certified outcome report.
        </p>
      </div>
    </section>
  );
}
