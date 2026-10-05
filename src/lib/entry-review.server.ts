/**
 * Attorney review queue (server logic; the admin client is passed in so the rules run in tests).
 *
 *  - starts from assertCaseAccess; only entries shared RIGHT NOW can be triaged or asked about,
 *    and an entry that stops being shared disappears from the queue;
 *  - status is per attorney. "Reviewed" returns to New if the survivor changes the entry;
 *  - the attorney's note is stored apart from the survivor's words, is private to its author,
 *    and no export reads this table;
 *  - a question to the survivor goes through the existing requests flow: it names only the entry's
 *    DATE (never its text), sends no notification, and the answer reaches the attorney only when
 *    the client presses Submit.
 */

import { assertCaseAccess } from "@/lib/attorney-access.server";
import { loadSharedItems } from "@/lib/chronology-workspace.server";
import { selectAllPages, selectInChunks } from "@/lib/in-chunks.server";
import { buildChronology, type ChronologyRow } from "@/lib/chronology";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type ReviewStatus = "new" | "needs_clarification" | "reviewed";
export const MAX_NOTE = 5000;
export const MAX_QUESTION = 1000;

export type QueueRow = {
  key: string;
  title: string;
  dateText: string;
  status: ReviewStatus;
  /** Was reviewed, then the survivor changed it. */
  changedSinceReview: boolean;
  note: string;
  question: { requestId: string; status: "open" | "answered" | "declined" } | null;
};

export type Queue = {
  rows: QueueRow[];
  counts: Record<ReviewStatus, number>;
};

type ReviewRow = {
  item_key: string;
  status: ReviewStatus;
  reviewed_marker: string | null;
  attorney_note: string | null;
  question_request_id: string | null;
};

async function currentRows(admin: Admin, userId: string, clientId: string) {
  const { link } = await assertCaseAccess(admin, userId, clientId);
  const items = await loadSharedItems(admin, link, clientId);
  const rows = buildChronology(items.incidents, items.evidence, items.requests, null);
  return { link, rows };
}

export async function getQueue(admin: Admin, userId: string, clientId: string): Promise<Queue> {
  const { link, rows } = await currentRows(admin, userId, clientId);
  // Paged: a long case must not silently lose the tail of its review state past 1,000 rows.
  const stored = await selectAllPages<ReviewRow>(
    (a, b) =>
      admin
        .from("attorney_entry_reviews")
        .select("item_key,status,reviewed_marker,attorney_note,question_request_id")
        .eq("link_id", link.id)
        .eq("user_id", userId)
        .order("item_key", { ascending: true })
        .range(a, b),
    { what: "review" },
  );
  const mine = new Map(stored.map((r) => [r.item_key, r]));

  const requestIds = Array.from(mine.values())
    .map((r) => r.question_request_id)
    .filter((x): x is string => !!x);
  const requestStatus = new Map<string, string>();
  if (requestIds.length) {
    const reqs = await selectInChunks<{ id: string; status: string }>(
      requestIds,
      (chunk) =>
        admin
          .from("attorney_document_requests")
          .select("id,status")
          .eq("link_id", link.id)
          .eq("attorney_user_id", userId)
          .in("id", chunk),
      { what: "question" },
    );
    for (const r of reqs) requestStatus.set(r.id, r.status);
  }

  const queue: QueueRow[] = rows.map((r) => {
    const stored = mine.get(r.key);
    const changed = !!stored && stored.status === "reviewed" && stored.reviewed_marker !== r.marker;
    const status: ReviewStatus = !stored || changed ? "new" : stored.status;
    const reqId = stored?.question_request_id ?? null;
    const rs = reqId ? requestStatus.get(reqId) : undefined;
    return {
      key: r.key,
      title: r.title,
      dateText: r.date.text,
      status,
      changedSinceReview: changed,
      note: stored?.attorney_note ?? "",
      question: reqId
        ? { requestId: reqId, status: rs === "submitted" ? "answered" : rs === "declined" ? "declined" : "open" }
        : null,
    };
  });
  const counts = { new: 0, needs_clarification: 0, reviewed: 0 } as Record<ReviewStatus, number>;
  for (const q of queue) counts[q.status]++;
  return { rows: queue, counts };
}

async function findShared(admin: Admin, userId: string, clientId: string, itemKey: string) {
  const { link, rows } = await currentRows(admin, userId, clientId);
  const row = rows.find((r) => r.key === itemKey);
  // Only what the survivor shares right now. A key from anywhere else is refused.
  if (!row) throw new Error("That item isn't shared with you.");
  return { link, row };
}

export async function setReview(
  admin: Admin,
  userId: string,
  input: { clientId: string; itemKey: string; status: ReviewStatus; note?: string },
): Promise<void> {
  const { link, row } = await findShared(admin, userId, input.clientId, input.itemKey);
  const patch: Record<string, unknown> = {
    link_id: link.id,
    user_id: userId,
    item_key: input.itemKey,
    status: input.status,
    reviewed_marker: input.status === "reviewed" ? (row as ChronologyRow).marker : null,
    updated_at: new Date().toISOString(),
  };
  if (input.note !== undefined) patch.attorney_note = input.note.slice(0, MAX_NOTE);
  const { error } = await admin
    .from("attorney_entry_reviews")
    .upsert(patch, { onConflict: "link_id,user_id,item_key" });
  if (error) throw new Error("We couldn't save that. Try again in a moment.");
}

export async function askAboutEntry(
  admin: Admin,
  userId: string,
  input: { clientId: string; itemKey: string; question: string },
): Promise<{ requestId: string }> {
  const question = input.question.trim().slice(0, MAX_QUESTION);
  if (!question) throw new Error("Write the question first.");
  const { link, row } = await findShared(admin, userId, input.clientId, input.itemKey);
  const { data: req, error } = await admin
    .from("attorney_document_requests")
    .insert({
      link_id: link.id,
      attorney_user_id: userId,
      client_user_id: input.clientId,
      title: "A question about one of your entries",
      // The date identifies the entry for her. The entry's own words are not copied into the question.
      details: `About your entry from ${row.date.text}: ${question}`,
      kind: "note",
    })
    .select("id")
    .single();
  if (error || !req) throw new Error("We couldn't send that question. Try again in a moment.");
  const requestId = (req as { id: string }).id;
  const { error: rErr } = await admin.from("attorney_entry_reviews").upsert(
    {
      link_id: link.id,
      user_id: userId,
      item_key: input.itemKey,
      status: "needs_clarification",
      reviewed_marker: null,
      question_request_id: requestId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "link_id,user_id,item_key" },
  );
  if (rErr) throw new Error("The question was sent, but we couldn't mark this entry. Reload to see it.");
  return { requestId };
}

export type ReviewSummaryRow = { clientId: string; newCount: number; clarifyCount: number };
export type ReviewSummary = { rows: ReviewSummaryRow[]; checked: number; couldNotCheck: number; capped: boolean };

export const SUMMARY_MAX_CLIENTS = 25;

/**
 * Across the attorney's active clients: where is there something new to read or an open
 * clarification. Each client goes through getQueue, so access, sharing scope and the
 * subscription check are the same as opening that client. A client that can't be checked is
 * counted as "couldn't check", never as "nothing new".
 */
export async function getReviewSummary(
  admin: Admin,
  userId: string,
  opts: { entitled: (clientId: string) => Promise<boolean> },
): Promise<ReviewSummary> {
  const { isRevoked, isExpired } = await import("@/lib/attorney-access.server");
  const links = await selectAllPages<{
    client_user_id: string;
    status: string;
    revoked_at: string | null;
    expires_at: string | null;
  }>(
    (a, b) =>
      admin
        .from("attorney_client_links")
        .select("client_user_id,status,revoked_at,expires_at")
        .eq("attorney_user_id", userId)
        .eq("status", "active")
        .order("client_user_id", { ascending: true })
        .range(a, b),
    { what: "client" },
  );
  const clients = Array.from(
    new Set(links.filter((l) => !isRevoked(l.revoked_at) && !isExpired(l.expires_at)).map((l) => l.client_user_id)),
  );
  const capped = clients.length > SUMMARY_MAX_CLIENTS;
  const batch = clients.slice(0, SUMMARY_MAX_CLIENTS);

  let rows: ReviewSummaryRow[] = [];
  let couldNotCheck = 0;
  for (let i = 0; i < batch.length; i += 5) {
    const results = await Promise.all(
      batch.slice(i, i + 5).map(async (clientId) => {
        try {
          if (!(await opts.entitled(clientId))) return null;
          const q = await getQueue(admin, userId, clientId);
          return { clientId, newCount: q.counts.new, clarifyCount: q.counts.needs_clarification };
        } catch {
          couldNotCheck++;
          return null;
        }
      }),
    );
    rows = rows.concat(results.filter((r): r is ReviewSummaryRow => !!r && (r.newCount > 0 || r.clarifyCount > 0)));
  }
  return { rows, checked: batch.length - couldNotCheck, couldNotCheck, capped };
}
