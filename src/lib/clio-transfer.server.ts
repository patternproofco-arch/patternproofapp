/**
 * Clio transfer engine (server logic; the Clio client and storage are injected so
 * every rule here runs in tests against fakes).
 *
 * Why it works one document per call: the app runs where a single request cannot be
 * trusted to finish a large binder, and there is no background worker. The browser
 * calls `runStep` repeatedly; each call sends ONE document, records the outcome, and
 * can be repeated after a refresh or failure. Per-file state lives in the database.
 *
 * Rules:
 *  - access, Clio consent and the linked matter are re-checked on EVERY step;
 *  - the content is rebuilt from what is shared right now; if it changed, was
 *    renumbered or is no longer shared, that document is not sent;
 *  - an item is claimed before it is sent, so two tabs cannot send it twice;
 *  - an item left "uploading" after a crash is NOT retried automatically: Clio may
 *    already have it, so a person decides;
 *  - retries are bounded; a document only counts as sent after Clio confirms the upload;
 *  - nothing is overwritten in Clio: a changed exhibit goes beside the earlier copy;
 *  - disconnecting or revoking later does not delete what was already sent.
 */

import { isActiveShareLink } from "@/lib/attorney-access.server";
import { getWorkspace } from "@/lib/chronology-workspace.server";
import { selectInChunks } from "@/lib/in-chunks.server";
import {
  exhibitPageText,
  indexText,
  planTransfer,
  type ExcludedItem,
  type IndexLine,
  type PlannedItem,
  type PriorDocument,
  type TransferPlan,
} from "@/lib/clio-transfer-plan";
import type { ChronologyRow } from "@/lib/chronology";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;
type Row = Record<string, unknown>;

export const MAX_ATTEMPTS = 3;
/** An item "uploading" longer than this is treated as an unknown outcome. */
export const STALE_UPLOAD_MS = 10 * 60 * 1000;

export class ClioHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ClioHttpError";
  }
}

export type ClioApi = {
  createDocument(name: string): Promise<{
    id: string;
    versionUuid: string | null;
    putUrl: string | null;
    putHeaders: Record<string, string>;
  }>;
  putBytes(target: { putUrl: string; putHeaders: Record<string, string> }, bytes: Uint8Array): Promise<void>;
  markFullyUploaded(documentId: string, versionUuid: string): Promise<void>;
};

export type TransferDeps = {
  getToken(userId: string): Promise<string | null>;
  makeApi(token: string, matterId: string): ClioApi;
  /** Bytes of a stored evidence file, or null if it can't be read. */
  downloadEvidence(path: string): Promise<Uint8Array | null>;
  buildZip(args: { rows: ChronologyRow[]; files: Map<string, { bytes: Uint8Array; extension: string }> }): Promise<Uint8Array>;
  sha256(bytes: Uint8Array): Promise<string>;
  now(): Date;
};

type Guard =
  | { ok: true; linkId: string; clientId: string; matterId: string; matterLabel: string }
  | { ok: false; reason: string };

const DISCONNECTED = "Clio isn't connected. Reconnect and try again.";

/** The same gates as every Clio upload, re-run on every step. */
export async function checkGuards(admin: Admin, userId: string, linkId: string): Promise<Guard> {
  const { data: link } = await admin
    .from("attorney_client_links")
    .select("id,client_user_id,attorney_user_id,status,revoked_at,expires_at,clio_share_consent")
    .eq("id", linkId)
    .eq("attorney_user_id", userId)
    .maybeSingle();
  if (!link || !isActiveShareLink(link)) {
    return { ok: false, reason: "That case file isn't active for your account." };
  }
  if (!link.clio_share_consent) {
    return { ok: false, reason: "This client hasn't approved Clio sharing. Nothing was sent." };
  }
  const { data: matter } = await admin
    .from("clio_matter_links")
    .select("clio_matter_id,clio_matter_display_number,clio_matter_description")
    .eq("attorney_client_link_id", linkId)
    .is("unlinked_at", null)
    .maybeSingle();
  if (!matter) return { ok: false, reason: "Link this case to a Clio matter first." };
  const label = [matter.clio_matter_display_number, matter.clio_matter_description]
    .filter((x: unknown): x is string => typeof x === "string" && !!x.trim())
    .join(" · ");
  return {
    ok: true,
    linkId,
    clientId: link.client_user_id as string,
    matterId: matter.clio_matter_id as string,
    matterLabel: label || "Linked matter",
  };
}

// ---------------------------------------------------------------------------
// Preview (Review exhibits)
// ---------------------------------------------------------------------------

export type TransferPreview = {
  linkId: string;
  matterLabel: string;
  packageVersion: number;
  plan: TransferPlan;
  /** Exhibits already sent with identical content: they are not sent again. */
  alreadySent: string[];
};

function ext(path: string | null | undefined): string | null {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(path ?? "");
  return m ? m[1]!.toLowerCase() : null;
}

function safePath(clientId: string, path: unknown): string | null {
  if (typeof path !== "string" || !path) return null;
  if (/^https?:\/\//i.test(path)) return null;
  if (!path.startsWith(`${clientId}/`) || path.includes("..")) return null;
  return path;
}

async function evidencePaths(admin: Admin, clientId: string, ids: string[]): Promise<Map<string, string | null>> {
  if (!ids.length) return new Map();
  const rows = await selectInChunks<Row>(
    ids,
    (chunk) => admin.from("evidence").select("id,file_url").eq("user_id", clientId).in("id", chunk),
    { what: "file" },
  );
  return new Map(rows.map((r) => [String(r.id), safePath(clientId, r.file_url)]));
}

async function priorDocuments(admin: Admin, linkId: string, matterId: string): Promise<PriorDocument[]> {
  const { data: jobs, error } = await admin
    .from("clio_transfer_jobs")
    .select("id")
    .eq("link_id", linkId)
    .eq("clio_matter_id", matterId);
  if (error) throw new Error("We couldn't check what was already sent. Try again in a moment.");
  const ids = ((jobs ?? []) as Array<{ id: string }>).map((j) => j.id);
  if (!ids.length) return [];
  const items = await selectInChunks<Row>(
    ids,
    (chunk) =>
      admin
        .from("clio_transfer_items")
        .select("document_name,marker")
        .in("job_id", chunk)
        .eq("status", "confirmed"),
    { what: "earlier transfer" },
  );
  return items.map((i) => ({ documentName: String(i.document_name), marker: (i.marker as string | null) ?? null }));
}

async function requireAttorney(admin: Admin, userId: string, linkId: string) {
  const g = await checkGuards(admin, userId, linkId);
  if (!g.ok) throw new Error(g.reason);
  const ws = await getWorkspace(admin, userId, g.clientId);
  if (!ws.canCreatePackage) throw new Error("Only the attorney on this matter can send exhibits to Clio.");
  if (!ws.package) {
    throw new Error("Fix the exhibit numbers first, so what goes to Clio carries numbers that won't change.");
  }
  return { g, ws, packageVersion: ws.package.version };
}

export async function previewTransfer(
  admin: Admin,
  userId: string,
  input: { linkId: string; includeZip: boolean },
): Promise<TransferPreview> {
  const { g, ws, packageVersion } = await requireAttorney(admin, userId, input.linkId);
  const evIds = ws.rows.filter((r) => r.kind === "evidence").map((r) => r.id);
  const paths = await evidencePaths(admin, g.clientId, evIds);
  const files = new Map(
    evIds.map((id) => [id, paths.get(id) ? { extension: ext(paths.get(id)) } : null] as const),
  );
  const prior = await priorDocuments(admin, g.linkId, g.matterId);
  const plan = planTransfer({ rows: ws.rows, packageVersion, files, prior, includeZip: input.includeZip });
  const priorKey = new Set(prior.map((p) => `${p.documentName}\u0000${p.marker}`));
  return {
    linkId: g.linkId,
    matterLabel: g.matterLabel,
    packageVersion,
    plan,
    alreadySent: plan.items
      .filter((i) => i.kind === "exhibit" && priorKey.has(`${i.documentName}\u0000${i.marker}`))
      .map((i) => i.documentName),
  };
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export type ItemStatus = "pending" | "uploading" | "confirmed" | "failed" | "skipped" | "needs_review";

export type JobItemView = {
  id: string;
  seq: number;
  kind: "exhibit" | "index" | "zip";
  documentName: string;
  exhibitNumber: number | null;
  status: ItemStatus;
  attempts: number;
  errorMessage: string | null;
  note: string | null;
  clioDocumentId: string | null;
  orphanClioDocumentIds: string[];
};

export type JobView = {
  id: string;
  linkId: string;
  matterLabel: string;
  packageVersion: number;
  status: "running" | "completed" | "completed_with_errors" | "stopped";
  stopReason: string | null;
  excluded: ExcludedItem[];
  items: JobItemView[];
  counts: { total: number; confirmed: number; skipped: number; failed: number; pending: number; needsReview: number };
  /** The honest summary line for the screen. */
  summary: string;
};

type JobRow = {
  id: string;
  attorney_user_id: string;
  link_id: string;
  clio_matter_id: string;
  matter_label: string;
  package_version: number;
  include_zip: boolean;
  status: JobView["status"];
  stop_reason: string | null;
  excluded: ExcludedItem[] | null;
};

type ItemRow = {
  id: string;
  job_id: string;
  seq: number;
  kind: "exhibit" | "index" | "zip";
  item_key: string | null;
  exhibit_number: number | null;
  document_name: string;
  marker: string | null;
  source: PlannedItem["source"];
  note: string | null;
  status: ItemStatus;
  attempts: number;
  error_code: string | null;
  error_message: string | null;
  clio_document_id: string | null;
  orphan_clio_document_ids: string[] | null;
  bytes: number | null;
  sha256: string | null;
  started_at: string | null;
};

const ITEM_COLUMNS =
  "id,job_id,seq,kind,item_key,exhibit_number,document_name,marker,source,note,status,attempts,error_code,error_message,clio_document_id,orphan_clio_document_ids,bytes,sha256,started_at";
const JOB_COLUMNS =
  "id,attorney_user_id,link_id,clio_matter_id,matter_label,package_version,include_zip,status,stop_reason,excluded";

function summarize(job: JobRow, c: JobView["counts"]): string {
  if (job.status === "stopped") return `Stopped: ${job.stop_reason ?? "see the reason shown"}. Nothing further was sent.`;
  const problems = c.failed + c.needsReview;
  if (job.status === "running") {
    return `${c.confirmed} of ${c.total} sent to Clio${c.failed ? `, ${c.failed} failed` : ""}${c.needsReview ? `, ${c.needsReview} need your check` : ""}.`;
  }
  if (problems > 0) {
    return `${c.confirmed} of ${c.total} sent. ${problems} did NOT go to Clio. Fix or retry them below; the rest are already there and won't be sent twice.`;
  }
  return `All ${c.confirmed + c.skipped} documents are in Clio${c.skipped ? ` (${c.skipped} were skipped: already there or no longer shared)` : ""}.`;
}

async function loadJob(admin: Admin, userId: string, jobId: string): Promise<JobRow> {
  const { data, error } = await admin
    .from("clio_transfer_jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .eq("attorney_user_id", userId)
    .maybeSingle();
  if (error) throw new Error("We couldn't open that transfer. Try again in a moment.");
  if (!data) throw new Error("That transfer wasn't found.");
  return data as JobRow;
}

async function loadItems(admin: Admin, jobId: string): Promise<ItemRow[]> {
  const { data, error } = await admin
    .from("clio_transfer_items")
    .select(ITEM_COLUMNS)
    .eq("job_id", jobId)
    .order("seq", { ascending: true });
  if (error) throw new Error("We couldn't open that transfer. Try again in a moment.");
  return (data ?? []) as ItemRow[];
}

/** An item stuck "uploading" has an unknown outcome. Never retried blindly. */
async function settleStale(admin: Admin, items: ItemRow[], now: Date): Promise<ItemRow[]> {
  const out: ItemRow[] = [];
  for (const it of items) {
    if (it.status === "uploading" && it.started_at && now.getTime() - Date.parse(it.started_at) > STALE_UPLOAD_MS) {
      const patch = {
        status: "needs_review" as const,
        error_code: "outcome_unknown",
        error_message:
          "We don't know whether this reached Clio. Check the matter's documents before sending it again, so it isn't duplicated.",
      };
      await admin.from("clio_transfer_items").update(patch).eq("id", it.id).eq("status", "uploading");
      out.push({ ...it, ...patch });
    } else out.push(it);
  }
  return out;
}

function toView(job: JobRow, items: ItemRow[]): JobView {
  const count = (s: ItemStatus) => items.filter((i) => i.status === s).length;
  const counts = {
    total: items.length,
    confirmed: count("confirmed"),
    skipped: count("skipped"),
    failed: count("failed"),
    pending: count("pending") + count("uploading"),
    needsReview: count("needs_review"),
  };
  return {
    id: job.id,
    linkId: job.link_id,
    matterLabel: job.matter_label,
    packageVersion: job.package_version,
    status: job.status,
    stopReason: job.stop_reason,
    excluded: job.excluded ?? [],
    items: items.map((i) => ({
      id: i.id,
      seq: i.seq,
      kind: i.kind,
      documentName: i.document_name,
      exhibitNumber: i.exhibit_number,
      status: i.status,
      attempts: i.attempts,
      errorMessage: i.error_message,
      note: i.note,
      clioDocumentId: i.clio_document_id,
      orphanClioDocumentIds: i.orphan_clio_document_ids ?? [],
    })),
    counts,
    summary: summarize(job, counts),
  };
}

export async function getJob(admin: Admin, deps: Pick<TransferDeps, "now">, userId: string, jobId: string): Promise<JobView> {
  const job = await loadJob(admin, userId, jobId);
  const items = await settleStale(admin, await loadItems(admin, jobId), deps.now());
  return toView(job, items);
}

export async function startTransfer(
  admin: Admin,
  userId: string,
  input: { linkId: string; includeZip: boolean },
): Promise<JobView> {
  const preview = await previewTransfer(admin, userId, input);
  const g = await checkGuards(admin, userId, input.linkId);
  if (!g.ok) throw new Error(g.reason);

  const { data: job, error } = await admin
    .from("clio_transfer_jobs")
    .insert({
      attorney_user_id: userId,
      link_id: input.linkId,
      clio_matter_id: g.matterId,
      matter_label: g.matterLabel,
      package_version: preview.packageVersion,
      include_zip: input.includeZip,
      excluded: preview.plan.excluded,
    })
    .select(JOB_COLUMNS)
    .single();
  if (error || !job) throw new Error("We couldn't start the transfer. Nothing was sent.");

  const already = new Set(preview.alreadySent);
  for (const it of preview.plan.items) {
    const dup = already.has(it.documentName);
    const { error: e } = await admin.from("clio_transfer_items").insert({
      job_id: (job as JobRow).id,
      seq: it.seq,
      kind: it.kind,
      item_key: it.itemKey,
      exhibit_number: it.exhibitNumber,
      document_name: it.documentName,
      marker: it.marker,
      source: it.source,
      note: dup ? "Already in Clio with identical content. Not sent again." : it.note,
      status: dup ? "skipped" : "pending",
      attempts: 0,
      orphan_clio_document_ids: [],
    });
    if (e) throw new Error("We couldn't set up the transfer. Nothing was sent.");
  }
  return toView(job as JobRow, await loadItems(admin, (job as JobRow).id));
}

// ---------------------------------------------------------------------------
// One step
// ---------------------------------------------------------------------------

function friendly(e: unknown): { code: string; message: string; stop?: string } {
  if (e instanceof ClioHttpError) {
    if (e.status === 401 || e.status === 403) {
      return {
        code: `http_${e.status}`,
        message: "Clio refused the request. Your Clio connection may have expired or lost permission.",
        stop: "Clio refused access. Reconnect Clio, then continue",
      };
    }
    if (e.status === 429) return { code: "http_429", message: "Clio asked us to slow down. Try again in a minute." };
    if (e.status >= 500) return { code: `http_${e.status}`, message: "Clio had a problem on its side. Try again shortly." };
    return { code: `http_${e.status}`, message: "Clio wouldn't accept this document." };
  }
  return { code: "exception", message: "We couldn't finish sending this document. Try again." };
}

async function recomputeJob(admin: Admin, job: JobRow, items: ItemRow[]) {
  // A failed document that still has attempts left keeps the job running.
  const open = items.some(
    (i) => i.status === "pending" || i.status === "uploading" || (i.status === "failed" && i.attempts < MAX_ATTEMPTS),
  );
  const bad = items.some((i) => i.status === "failed" || i.status === "needs_review");
  const status: JobRow["status"] = job.status === "stopped" ? "stopped" : open ? "running" : bad ? "completed_with_errors" : "completed";
  if (status !== job.status) {
    await admin
      .from("clio_transfer_jobs")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", job.id);
  }
  return { ...job, status };
}

export async function runStep(
  admin: Admin,
  deps: TransferDeps,
  userId: string,
  jobId: string,
): Promise<JobView> {
  let job = await loadJob(admin, userId, jobId);
  let items = await settleStale(admin, await loadItems(admin, jobId), deps.now());
  if (job.status === "stopped") return toView(job, items);

  const stop = async (reason: string): Promise<JobView> => {
    await admin
      .from("clio_transfer_jobs")
      .update({ status: "stopped", stop_reason: reason, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    job = { ...job, status: "stopped", stop_reason: reason };
    return toView(job, items);
  };

  // Permissions, consent and the linked matter, re-checked for THIS step.
  const g = await checkGuards(admin, userId, job.link_id);
  if (!g.ok) return stop(g.reason);
  if (g.matterId !== job.clio_matter_id) {
    return stop("The linked Clio matter changed after this transfer started");
  }
  const token = await deps.getToken(userId);
  if (!token) return stop(DISCONNECTED);

  // Next document: waiting ones first, then failed ones with attempts left. The index and ZIP
  // come after every exhibit has settled, so they describe what actually went.
  const settled = (i: ItemRow) => i.status !== "pending" && i.status !== "uploading";
  const exhibits = items.filter((i) => i.kind === "exhibit");
  const eligible = (i: ItemRow) =>
    i.status === "pending" || (i.status === "failed" && i.attempts < MAX_ATTEMPTS);
  let next = exhibits.find((i) => i.status === "pending");
  if (!next && exhibits.every((i) => settled(i))) {
    next = items.filter((i) => i.kind !== "exhibit").find(eligible);
  }
  if (!next) next = exhibits.find(eligible);
  if (!next) {
    job = await recomputeJob(admin, job, items);
    return toView(job, items);
  }

  // Claim it. If another tab already did, report where things stand.
  const { data: claimed } = await admin
    .from("clio_transfer_items")
    .update({ status: "uploading", started_at: deps.now().toISOString(), attempts: next.attempts + 1 })
    .eq("id", next.id)
    .eq("status", next.status)
    .select("id")
    .maybeSingle();
  if (!claimed) return toView(job, await loadItems(admin, jobId));

  // Problems a retry can't fix are not retried automatically.
  const TERMINAL = new Set(["file_missing", "changed_since_plan", "renumbered", "no_put_url"]);
  const fail = async (code: string, message: string, status: ItemStatus = "failed", extra: Row = {}) => {
    await admin
      .from("clio_transfer_items")
      .update({
        status,
        error_code: code,
        error_message: message,
        ...(TERMINAL.has(code) ? { attempts: MAX_ATTEMPTS } : {}),
        ...extra,
      })
      .eq("id", next!.id);
  };

  try {
    // Rebuild from what is shared right now.
    const ws = await getWorkspace(admin, userId, g.clientId);
    const rows = ws.rows;
    let bytes: Uint8Array;

    if (next.kind === "exhibit") {
      const row = rows.find((r) => r.key === next!.item_key);
      if (!row) {
        await fail("no_longer_shared", "The client no longer shares this item, so it was not sent.", "skipped");
        return finish(admin, job, jobId);
      }
      if (row.marker !== next.marker) {
        await fail("changed_since_plan", "This item changed after you started. It was not sent. Start a new transfer to send the current version.");
        return finish(admin, job, jobId);
      }
      if (row.exhibit.number !== next.exhibit_number) {
        await fail("renumbered", "This item's exhibit number changed after you started. It was not sent. Start a new transfer.");
        return finish(admin, job, jobId);
      }
      if (next.source === "evidence_file") {
        const paths = await evidencePaths(admin, g.clientId, [row.id]);
        const path = paths.get(row.id) ?? null;
        const got = path ? await deps.downloadEvidence(path) : null;
        if (!got || got.byteLength === 0) {
          await fail("file_missing", "We couldn't read this file from storage, so it was NOT sent. The exhibit is still listed; re-upload the file or contact support.");
          return finish(admin, job, jobId);
        }
        bytes = got;
      } else {
        bytes = new TextEncoder().encode(exhibitPageText(row));
      }
    } else if (next.kind === "index") {
      const lines: IndexLine[] = items
        .filter((i) => i.kind === "exhibit")
        .map((i) => ({
          exhibitNumber: i.exhibit_number!,
          row: rows.find((r) => r.key === i.item_key) ?? null,
          documentName: i.document_name,
          status: i.status,
          sha256: i.sha256,
        }))
        .filter((l): l is IndexLine => l.row !== null);
      bytes = new TextEncoder().encode(
        indexText({
          packageVersion: job.package_version,
          matterLabel: job.matter_label,
          generatedAt: deps.now().toISOString(),
          lines,
          excluded: job.excluded ?? [],
          withdrawn: (ws.package?.withdrawn ?? []).map((w) => ({ number: w.number })),
        }),
      );
    } else {
      const files = new Map<string, { bytes: Uint8Array; extension: string }>();
      const sentRows = items.filter((i) => i.kind === "exhibit" && i.status === "confirmed");
      const keep = new Set(sentRows.map((i) => i.item_key));
      const paths = await evidencePaths(admin, g.clientId, rows.filter((r) => r.kind === "evidence").map((r) => r.id));
      for (const r of rows.filter((x) => x.kind === "evidence" && keep.has(x.key))) {
        const p = paths.get(r.id);
        const got = p ? await deps.downloadEvidence(p) : null;
        if (!got) {
          await fail("file_missing", "A file in the binder couldn't be read, so the ZIP was NOT built. The individual exhibits already sent are unaffected.");
          return finish(admin, job, jobId);
        }
        files.set(r.id, { bytes: got, extension: ext(p) ?? "bin" });
      }
      bytes = await deps.buildZip({ rows: rows.filter((r) => keep.has(r.key)), files });
    }

    const digest = await deps.sha256(bytes);
    const api = deps.makeApi(token, job.clio_matter_id);
    const doc = await api.createDocument(next.document_name);
    if (!doc.id || !doc.putUrl || !doc.versionUuid) {
      await fail("no_put_url", "Clio didn't return an upload target for this document.");
      return finish(admin, job, jobId);
    }
    try {
      await api.putBytes({ putUrl: doc.putUrl, putHeaders: doc.putHeaders }, bytes);
      await api.markFullyUploaded(doc.id, doc.versionUuid);
    } catch (e) {
      // Clio created the document but it never finished. Say so; don't hide the leftover.
      const f = friendly(e);
      await fail(f.code, `${f.message} A partly uploaded document may remain in Clio.`, "failed", {
        orphan_clio_document_ids: [...(next.orphan_clio_document_ids ?? []), doc.id],
      });
      if (f.stop) await stop(f.stop);
      return finish(admin, job, jobId);
    }
    await admin
      .from("clio_transfer_items")
      .update({
        status: "confirmed",
        clio_document_id: doc.id,
        bytes: bytes.byteLength,
        sha256: digest,
        confirmed_at: deps.now().toISOString(),
        error_code: null,
        error_message: null,
      })
      .eq("id", next.id);
    try {
      await admin.rpc("record_audit_event", {
        p_user_id: g.clientId,
        p_event_type: "clio.exhibit_transferred",
        p_subject_kind: "export",
        p_actor_kind: "attorney",
        p_actor_id: userId,
        p_meta: { job_id: job.id, kind: next.kind, exhibit_number: next.exhibit_number },
      });
    } catch {
      /* audit is best-effort */
    }
  } catch (e) {
    const f = friendly(e);
    await fail(f.code, f.message);
    if (f.stop) await stop(f.stop);
  }
  return finish(admin, job, jobId);
}

async function finish(admin: Admin, job: JobRow, jobId: string): Promise<JobView> {
  const { data: fresh } = await admin
    .from("clio_transfer_jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .maybeSingle();
  const cur = (fresh as JobRow | null) ?? job;
  const items = await loadItems(admin, jobId);
  const updated = await recomputeJob(admin, cur, items);
  return toView(updated, items);
}

/** A person's decision to try a failed or unknown-outcome document again. */
export async function retryItem(
  admin: Admin,
  userId: string,
  input: { jobId: string; itemId: string; confirmNotInClio?: boolean },
): Promise<void> {
  const job = await loadJob(admin, userId, input.jobId);
  const items = await loadItems(admin, input.jobId);
  const it = items.find((i) => i.id === input.itemId);
  if (!it) throw new Error("That document wasn't found in this transfer.");
  if (it.status === "needs_review" && !input.confirmNotInClio) {
    throw new Error("Check the matter in Clio first. If the document isn't there, confirm and we'll send it.");
  }
  if (it.status !== "failed" && it.status !== "needs_review") {
    throw new Error("Only a document that didn't go through can be retried.");
  }
  await admin
    .from("clio_transfer_items")
    .update({ status: "pending", attempts: 0, error_code: null, error_message: null })
    .eq("id", it.id)
    .eq("job_id", job.id);
  await admin
    .from("clio_transfer_jobs")
    .update({ status: "running", stop_reason: null, updated_at: new Date().toISOString() })
    .eq("id", job.id);
}

/** Matter identification and the ability to resume after Clio access was fixed. */
export async function resumeJob(admin: Admin, userId: string, jobId: string): Promise<void> {
  const job = await loadJob(admin, userId, jobId);
  if (job.status !== "stopped") return;
  await admin
    .from("clio_transfer_jobs")
    .update({ status: "running", stop_reason: null, updated_at: new Date().toISOString() })
    .eq("id", job.id);
}

