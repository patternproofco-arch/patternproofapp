import { CALL_RECORD_SENDER, type MatrixInputMessage } from "@/lib/frequency-matrix";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Page size for reads. PostgREST caps a single response at 1000 rows. */
export const MATRIX_PAGE_SIZE = 1000;
/** Upper bound on messages read for one sheet. */
export const MATRIX_MAX_MESSAGES = 50_000;

/**
 * Only the columns a count needs. Message text is never selected, so the
 * matrix can be built without the words of any message leaving the database.
 */
export const MATRIX_MESSAGE_COLUMNS =
  "sender,sender_side,sent_on,sent_at_time,has_attachment_marker,flags";

type Row = {
  sender: string | null;
  sender_side: string | null;
  sent_on: string | null;
  sent_at_time: string | null;
  has_attachment_marker: boolean | null;
  flags: unknown;
};

export function toMatrixInput(r: Row): MatrixInputMessage {
  const flags = r.flags && typeof r.flags === "object" && !Array.isArray(r.flags) ? r.flags : {};
  return {
    sender: r.sender,
    sender_side: r.sender_side,
    sent_on: r.sent_on,
    sent_at_time: r.sent_at_time,
    has_attachment_marker: !!r.has_attachment_marker,
    is_call_record:
      (r.sender ?? "").trim() === CALL_RECORD_SENDER ||
      (flags as Record<string, unknown>).call_row === true,
  };
}

/**
 * Reads every message of one thread owned by `ownerId`, page by page. A failed
 * page throws rather than returning a partial count that looks complete.
 */
export async function readThreadMatrixRows(
  db: Db,
  ownerId: string,
  threadId: string,
): Promise<{ messages: MatrixInputMessage[]; truncated: boolean }> {
  const messages: MatrixInputMessage[] = [];
  for (let from = 0; from < MATRIX_MAX_MESSAGES; from += MATRIX_PAGE_SIZE) {
    const { data, error } = await db
      .from("thread_messages")
      .select(MATRIX_MESSAGE_COLUMNS)
      .eq("thread_id", threadId)
      .eq("user_id", ownerId)
      .order("position", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + MATRIX_PAGE_SIZE - 1);
    if (error)
      throw new Error(
        "We couldn't count every message. Nothing was left out silently, so please try again.",
      );
    const page = (data ?? []) as Row[];
    for (const r of page) messages.push(toMatrixInput(r));
    if (page.length < MATRIX_PAGE_SIZE) return { messages, truncated: false };
  }
  return { messages, truncated: true };
}

export const MATRIX_THREAD_COLUMNS =
  "id,source_filename,source_type,conversation_participant,capture_method,message_count,created_at";

export type MatrixThread = {
  id: string;
  source_filename: string | null;
  source_type: string | null;
  conversation_participant: string | null;
  capture_method: string | null;
  message_count: number | null;
  created_at: string;
};
