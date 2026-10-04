import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  createExhibitPackage,
  getChronologyWorkspace,
  logChronologyExport,
  saveDeclarationDraft,
  type Workspace,
} from "@/lib/chronology.functions";
import {
  BASIS_LABEL,
  DRAFT_BANNER,
  analyzeDraft,
  buildDraftParagraphs,
  generatedParagraph,
  renderChronologyText,
  renderDeclarationText,
  type DeclarationContent,
} from "@/lib/chronology";
import type { ExhibitPackage } from "@/lib/exhibit-numbering";

/**
 * Factual chronology and unsigned declaration draft for the attorney.
 * Everything here restates what the client recorded. Nothing is added to the
 * draft by itself, and the survivor's records are never edited from this screen.
 */

type SaveState = "idle" | "saving" | "saved" | "failed";

const workspaceKey = (clientId: string) => ["chronology", clientId] as const;

export function useChronologyWorkspace(clientId: string) {
  const fetchWs = useServerFn(getChronologyWorkspace);
  return useQuery({
    queryKey: workspaceKey(clientId),
    queryFn: () => fetchWs({ data: { clientId } }),
    retry: false,
  });
}

function msg(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

export function ChronologyWorkspace({ clientId }: { clientId: string }) {
  const q = useChronologyWorkspace(clientId);
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading the chronology…</p>;
  if (q.error || !q.data) {
    return (
      <p role="alert" className="text-sm">
        {msg(q.error, "We couldn't load the chronology. Nothing was left out silently, so please try again.")}
      </p>
    );
  }
  // Remount when a different survivor is opened, so no state from one case leaks into another.
  return <Loaded key={clientId} clientId={clientId} ws={q.data} />;
}

function Loaded({ clientId, ws }: { clientId: string; ws: Workspace }) {
  const qc = useQueryClient();
  const makePackage = useServerFn(createExhibitPackage);
  const saveDraft = useServerFn(saveDeclarationDraft);
  const logExport = useServerFn(logChronologyExport);

  const [content, setContent] = useState<DeclarationContent>(ws.draft.content);
  const [notes, setNotes] = useState(ws.draft.notes);
  const [ack, setAck] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const pkg: ExhibitPackage | null = ws.package ? { version: ws.package.version, entries: [] } : null;
  const rowByKey = useMemo(() => new Map(ws.rows.map((r) => [r.key, r])), [ws.rows]);

  // What the server will record as reviewed, mirrored here so flags are right before saving.
  const reviewed = useMemo(() => {
    const out = { ...ws.draft.content.reviewed };
    const was = new Set(ws.draft.content.included);
    for (const k of content.included) {
      const r = rowByKey.get(k);
      if (!r) continue;
      if (!was.has(k) || ack.includes(k)) out[k] = r.marker;
    }
    for (const [k, t] of Object.entries(content.overrides)) {
      if (ws.draft.content.overrides[k] !== t && rowByKey.get(k)) out[k] = rowByKey.get(k)!.marker;
    }
    return out;
  }, [ws.draft.content, content.included, content.overrides, ack, rowByKey]);

  const view: DeclarationContent = useMemo(() => ({ ...content, reviewed }), [content, reviewed]);
  const analysis = useMemo(() => analyzeDraft(view, ws.rows, pkg), [view, ws.rows, pkg]);
  const paragraphs = useMemo(() => buildDraftParagraphs(view, ws.rows), [view, ws.rows]);

  const edit = (patch: Partial<DeclarationContent>) => {
    setContent((c) => ({ ...c, ...patch }));
    setDirty(true);
    setSaveState("idle");
  };

  const apply = (next: Workspace) => {
    qc.setQueryData(workspaceKey(clientId), next);
  };

  const persist = async (opts: { adoptLatestPackage?: boolean } = {}) => {
    setSaveState("saving");
    setError(null);
    try {
      const next = await saveDraft({
        data: {
          clientId,
          expectedVersion: ws.draft.version,
          content: {
            title: content.title,
            declarantName: content.declarantName,
            included: content.included,
            declined: content.declined,
            overrides: content.overrides,
            added: content.added,
          },
          notes,
          acknowledge: ack,
          adoptLatestPackage: opts.adoptLatestPackage,
        },
      });
      setDirty(false);
      setAck([]);
      setSaveState("saved");
      setContent(next.draft.content);
      setNotes(next.draft.notes);
      apply(next);
    } catch (e) {
      setSaveState("failed");
      setError(msg(e, "We couldn't save. Your changes are still on this page. Try again."));
    }
  };

  const freeze = async () => {
    setWorking(true);
    setError(null);
    try {
      apply(await makePackage({ data: { clientId } }));
      toast("Exhibit numbers saved.");
    } catch (e) {
      setError(msg(e, "We couldn't save the exhibit numbers. Try again in a moment."));
    } finally {
      setWorking(false);
    }
  };

  const copy = async (kind: "chronology" | "declaration_draft") => {
    const text =
      kind === "chronology"
        ? renderChronologyText(ws.rows)
        : renderDeclarationText(view, ws.rows, pkg);
    try {
      await navigator.clipboard.writeText(text);
      toast(kind === "chronology" ? "Chronology copied." : "Draft copied. It is unsigned and unsworn.");
      void logExport({ data: { clientId, kind } }).catch(() => undefined);
    } catch {
      toast("We couldn't copy that. Try again in a moment.");
    }
  };

  const include = (key: string) => {
    if (content.included.includes(key)) return;
    edit({ included: [...content.included, key], declined: content.declined.filter((k) => k !== key) });
  };
  const drop = (key: string) =>
    edit({
      included: content.included.filter((k) => k !== key),
      declined: [...content.declined.filter((k) => k !== key), key],
      overrides: Object.fromEntries(Object.entries(content.overrides).filter(([k]) => k !== key)),
    });
  const accept = (key: string) => {
    setAck((a) => (a.includes(key) ? a : [...a, key]));
    setDirty(true);
    setSaveState("idle");
  };

  const p = ws.package;
  const unresolved = analysis.needsDecision.length;

  return (
    <section className="mb-10 print:hidden">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">Factual chronology and declaration draft</h2>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved"}
          {saveState === "failed" && "Not saved"}
          {saveState === "idle" && dirty && "Unsaved changes"}
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Restates what the client recorded, quoted exactly, with uncertain dates left uncertain. It is not verified,
        draws no conclusions, and the client&apos;s records are never changed from here.
      </p>

      {error && (
        <p role="alert" className="mb-3 text-sm">
          {error}
        </p>
      )}

      {/* Exhibit numbers */}
      <div className="mb-4 rounded-lg border border-border p-3 text-sm">
        {!p ? (
          <>
            <strong>Exhibit numbers are provisional.</strong> They are just the order of dates right now, so adding
            one earlier item would renumber everything after it. Fix them before you cite them in a filing.
            {ws.canCreatePackage ? (
              <div className="mt-2">
                <button
                  className="rounded-lg bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50"
                  onClick={freeze}
                  disabled={working}
                >
                  {working ? "Saving…" : "Fix exhibit numbers"}
                </button>
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Only the attorney on this matter can do this.</p>
            )}
          </>
        ) : (
          <>
            <strong>Exhibit numbers fixed in package v{p.version}.</strong> Numbers never change or get reused.
            {p.diff.added.length + p.diff.changed.length + p.diff.withdrawn.length > 0 ? (
              <ul className="ml-4 mt-1 list-disc text-xs">
                {p.diff.added.length > 0 && <li>{p.diff.added.length} newly shared item(s) are not numbered yet.</li>}
                {p.diff.changed.length > 0 && <li>{p.diff.changed.length} numbered item(s) changed since this package.</li>}
                {p.diff.withdrawn.length > 0 && (
                  <li>
                    {p.diff.withdrawn.length} numbered item(s) are no longer shared (
                    {p.withdrawn.map((w) => `Exhibit ${w.number}`).join(", ")}). Those numbers stay reserved.
                  </li>
                )}
              </ul>
            ) : (
              <span className="text-xs text-muted-foreground"> Nothing has changed since.</span>
            )}
            {ws.canCreatePackage && p.diff.added.length > 0 && (
              <div className="mt-2">
                <button
                  className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50"
                  onClick={freeze}
                  disabled={working}
                >
                  {working ? "Saving…" : `Number the new items (package v${p.version + 1})`}
                </button>
                <span className="ml-2 text-xs text-muted-foreground">Existing numbers stay as they are.</span>
              </div>
            )}
          </>
        )}
        {analysis.packageBehind && (
          <p className="mt-2 text-xs">
            Your draft cites package v{content.packageVersion ?? "none"}; v{p?.version} is newer.{" "}
            <button className="underline" onClick={() => persist({ adoptLatestPackage: true })}>
              Move this draft to v{p?.version}
            </button>
          </p>
        )}
      </div>

      {/* New items needing a decision */}
      {unresolved > 0 && (
        <div className="mb-4 rounded-lg border border-border p-3 text-sm">
          <strong>{unresolved} item(s) are not in your draft yet.</strong> Nothing is added automatically. Choose what
          belongs in it.
          <ul className="mt-2 space-y-1">
            {analysis.needsDecision.map((k) => {
              const r = rowByKey.get(k)!;
              return (
                <li key={k} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span>
                    {r.date.text} · {"“"}
                    {r.title}
                    {"”"} · {r.exhibit.label}
                  </span>
                  <span className="space-x-2">
                    <button className="underline" onClick={() => include(k)}>
                      Add to draft
                    </button>
                    <button
                      className="underline"
                      onClick={() => edit({ declined: [...content.declined.filter((x) => x !== k), k] })}
                    >
                      Leave out
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Chronology */}
      <h3 className="mb-2 font-display text-base">Chronology</h3>
      <ol className="mb-6 space-y-3">
        {ws.rows.map((r, i) => (
          <li key={r.key} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="text-xs text-muted-foreground">{i + 1}.</span> <strong>{r.date.text}</strong>
                {r.timeText && (
                  <span className="text-xs text-muted-foreground"> · {r.timeText} (time as entered; time zone not recorded)</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {BASIS_LABEL[r.basis]} · {r.exhibit.label}
              </div>
            </div>
            <div className="mt-1">
              Title as entered: {"“"}
              {r.title}
              {"”"}
            </div>
            {r.quote && <blockquote className="mt-1 whitespace-pre-wrap border-l-2 border-border pl-3">{r.quote}</blockquote>}
            {r.location && <div className="mt-1 text-xs">Location as entered: {"“"}{r.location}{"”"}</div>}
            {r.witnesses && <div className="mt-1 text-xs">Witnesses as entered: {"“"}{r.witnesses}{"”"}</div>}
            {r.machineText && (
              <details className="mt-1 text-xs">
                <summary>
                  Text read from the file by software{r.machineText.checked ? " (checked)" : " (not checked)"}
                </summary>
                <div className="mt-1 whitespace-pre-wrap">{r.machineText.text}</div>
              </details>
            )}
            {r.enteredOn && (
              <div className="mt-1 text-xs text-muted-foreground">
                Entered by the client on {r.enteredOn} (not the date of the event)
              </div>
            )}
            {r.flags.map((f) => (
              <div key={f} className="mt-1 text-xs">
                Note: {f}
              </div>
            ))}
            {r.exhibit.changedSinceVersion && (
              <div className="mt-1 text-xs">Changed since exhibit package v{p?.version}. The number is the same.</div>
            )}
            <div className="mt-2 text-xs">
              {content.included.includes(r.key) ? (
                <span>
                  In your draft ·{" "}
                  <button className="underline" onClick={() => drop(r.key)}>
                    Remove
                  </button>
                </span>
              ) : (
                <button className="underline" onClick={() => include(r.key)}>
                  Add to draft
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* Declaration draft */}
      <h3 className="mb-2 font-display text-base">Declaration draft</h3>
      <div className="mb-3 rounded-lg border border-border p-3 text-xs">
        {DRAFT_BANNER.map((l) => (
          <p key={l} className="mb-1 last:mb-0">
            {l}
          </p>
        ))}
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          Title
          <input
            className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
            value={content.title}
            maxLength={200}
            onChange={(e) => edit({ title: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Declarant (you type this)
          <input
            className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
            value={content.declarantName ?? ""}
            maxLength={200}
            onChange={(e) => edit({ declarantName: e.target.value || null })}
          />
        </label>
      </div>

      {paragraphs.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">Nothing is in the draft yet. Add items from the chronology.</p>
      ) : (
        <ol className="mb-3 space-y-3">
          {paragraphs.map((para) => {
            const key = para.key;
            const row = key ? rowByKey.get(key) : undefined;
            const flagged = key ? analysis.changedSinceReview.includes(key) : false;
            return (
              <li key={`${para.n}-${key ?? "added"}`} className="rounded-lg border border-border p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {para.n}. {para.basis}
                    {para.exhibit ? ` · ${para.exhibit}` : ""}
                    {para.origin === "edited" ? " · edited by you" : ""}
                  </span>
                  {key && (
                    <button className="underline" onClick={() => drop(key)}>
                      Remove from draft
                    </button>
                  )}
                  {!key && para.addedId && (
                    <button
                      className="underline"
                      onClick={() => edit({ added: content.added.filter((a) => a.id !== para.addedId) })}
                    >
                      Remove paragraph
                    </button>
                  )}
                </div>
                {row ? (
                  <textarea
                    className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                    rows={Math.min(14, Math.max(3, Math.ceil(para.text.length / 90)))}
                    value={para.text}
                    onChange={(e) => {
                      const v = e.target.value;
                      const gen = generatedParagraph(row);
                      const overrides = { ...content.overrides };
                      if (v === gen) delete overrides[row.key];
                      else overrides[row.key] = v;
                      edit({ overrides });
                    }}
                    aria-label={`Paragraph ${para.n}`}
                  />
                ) : key ? (
                  <p>{para.text}</p>
                ) : (
                  <textarea
                    className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                    rows={4}
                    value={para.text}
                    aria-label={`Your paragraph ${para.n}`}
                    onChange={(e) =>
                      edit({
                        added: content.added.map((a) =>
                          a.id === para.addedId ? { ...a, text: e.target.value } : a,
                        ),
                      })
                    }
                  />
                )}
                {para.flags.map((f) => (
                  <div key={f} className="mt-1 text-xs">
                    {f}
                    {flagged && (
                      <>
                        {" "}
                        <button className="underline" onClick={() => accept(key!)}>
                          I&apos;ve reviewed this change
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {row && content.overrides[row.key] && (
                  <button
                    className="mt-1 text-xs underline"
                    onClick={() => {
                      const overrides = { ...content.overrides };
                      delete overrides[row.key];
                      edit({ overrides });
                    }}
                  >
                    Reset to the text generated from the client&apos;s record
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <div className="mb-4">
        <button
          className="rounded-lg border border-border px-3 py-1.5 text-sm"
          onClick={() =>
            edit({
              added: [
                ...content.added,
                {
                  id: `p${Date.now().toString(36)}`,
                  text: "New paragraph (written by you).",
                  afterKey: content.included[content.included.length - 1] ?? null,
                },
              ],
            })
          }
        >
          Add a paragraph of my own
        </button>
      </div>

      <label className="mb-4 block text-xs">
        Private notes (only you can see these. They are never copied or exported.)
        <textarea
          className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
          rows={3}
          maxLength={20000}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setDirty(true);
            setSaveState("idle");
          }}
        />
      </label>

      {(analysis.withdrawn.length > 0 ||
        analysis.changedSinceReview.length > 0 ||
        analysis.uncitedExhibits.length > 0 ||
        unresolved > 0) && (
        <div className="mb-3 rounded-lg border border-border p-3 text-xs">
          <strong>Before you rely on this draft</strong>
          <ul className="ml-4 mt-1 list-disc">
            {analysis.withdrawn.length > 0 && (
              <li>{analysis.withdrawn.length} paragraph(s) rest on items no longer shared. Their text is hidden. Remove or replace them.</li>
            )}
            {analysis.changedSinceReview.length > 0 && (
              <li>{analysis.changedSinceReview.length} item(s) changed after you reviewed them.</li>
            )}
            {analysis.uncitedExhibits.length > 0 && (
              <li>{analysis.uncitedExhibits.length} paragraph(s) cite provisional or missing exhibit numbers.</li>
            )}
            {unresolved > 0 && <li>{unresolved} newly shared item(s) are not in the draft and not left out.</li>}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          onClick={() => persist()}
          disabled={!dirty || saveState === "saving"}
        >
          Save draft
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm"
          onClick={() => copy("chronology")}
        >
          <Copy size={14} /> Copy chronology
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
          onClick={() => copy("declaration_draft")}
          disabled={paragraphs.length === 0}
        >
          <Copy size={14} /> Copy declaration draft
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Once copied, the text is outside PatternProof. If the client later ends sharing, PatternProof can hide it here,
        but it can&apos;t take back what you have already copied.
      </p>
    </section>
  );
}
