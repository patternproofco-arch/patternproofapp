/**
 * Unfinished entries.
 *
 * What she types is kept for her, privately, so that locking the app, navigating away,
 * refreshing or losing the connection doesn't lose it. It is stored in her own row of the
 * database (readable and writable only by her), NOT in the browser's local storage, where
 * sensitive text would sit in plain form on a device someone else may be able to open.
 *
 *  - one draft per account per kind, replaced as she types;
 *  - removed as soon as the entry is really saved, and whenever she discards it;
 *  - never restored into a different account's screen (rows are per account);
 *  - the screen only says "saved" after the database confirms it.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const DRAFT_KIND = "journal_entry";
export const MAX_FIELD = 20_000;

export type EntryDraft = {
  description: string;
  time: string;
  location: string;
  witnesses: string;
  emotional_impact: string;
  abuse_types: string[];
  date_precision: string;
  date: string;
  approx_month: string;
  date_range_start: string;
  date_range_end: string;
  anchor_incident_id: string;
  anchor_label: string;
};

const TEXT_KEYS: Array<keyof Omit<EntryDraft, "abuse_types">> = [
  "description",
  "time",
  "location",
  "witnesses",
  "emotional_impact",
  "date_precision",
  "date",
  "approx_month",
  "date_range_start",
  "date_range_end",
  "anchor_incident_id",
  "anchor_label",
];

/** Nothing worth keeping: she hasn't typed anything or chosen anything. */
export function draftIsEmpty(d: Partial<EntryDraft>): boolean {
  return (
    !(d.description ?? "").trim() &&
    !(d.location ?? "").trim() &&
    !(d.witnesses ?? "").trim() &&
    !(d.emotional_impact ?? "").trim() &&
    !(d.time ?? "").trim() &&
    !(d.abuse_types ?? []).length &&
    !(d.date ?? "").trim() &&
    !(d.approx_month ?? "").trim() &&
    !(d.date_range_start ?? "").trim() &&
    !(d.date_range_end ?? "").trim() &&
    !(d.anchor_label ?? "").trim()
  );
}

/** Shape stored data back into a form, ignoring anything unexpected. */
export function parseDraft(raw: unknown): EntryDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out = { abuse_types: [] as string[] } as EntryDraft;
  for (const k of TEXT_KEYS) {
    const v = r[k];
    (out as Record<string, unknown>)[k] = typeof v === "string" ? v.slice(0, MAX_FIELD) : "";
  }
  if (Array.isArray(r.abuse_types)) {
    out.abuse_types = r.abuse_types.filter((t): t is string => typeof t === "string").slice(0, 20);
  }
  if (!out.date_precision) out.date_precision = "unknown";
  return draftIsEmpty(out) ? null : out;
}

export type DraftLoad = { draft: EntryDraft; savedAt: string } | null;

/** Her saved draft, if she has one. A failed read throws; it is never read as "no draft". */
export async function loadDraft(db: Db, userId: string): Promise<DraftLoad> {
  const { data, error } = await db
    .from("entry_drafts")
    .select("content,updated_at")
    .eq("user_id", userId)
    .eq("kind", DRAFT_KIND)
    .maybeSingle();
  if (error) throw new Error("Couldn't check for an unfinished entry.");
  if (!data) return null;
  const draft = parseDraft(data.content);
  return draft ? { draft, savedAt: String(data.updated_at) } : null;
}

/** Stores the draft. Resolves only once the database confirmed it. */
export async function saveDraft(db: Db, userId: string, draft: EntryDraft, now = new Date()): Promise<void> {
  if (draftIsEmpty(draft)) return removeDraft(db, userId);
  const { error } = await db.from("entry_drafts").upsert(
    {
      user_id: userId,
      kind: DRAFT_KIND,
      content: draft,
      updated_at: now.toISOString(),
    },
    { onConflict: "user_id,kind" },
  );
  if (error) throw new Error("Draft not saved.");
}

export async function removeDraft(db: Db, userId: string): Promise<void> {
  const { error } = await db.from("entry_drafts").delete().eq("user_id", userId).eq("kind", DRAFT_KIND);
  if (error) throw new Error("Couldn't remove the draft.");
}

export type DraftStatus = "idle" | "saving" | "saved" | "failed";

export function draftStatusText(s: DraftStatus): string {
  switch (s) {
    case "saving":
      return "Saving your draft…";
    case "saved":
      return "Draft saved privately to your account.";
    case "failed":
      return "Draft NOT saved. What you typed is still on this screen. If you leave, it will be lost.";
    default:
      return "";
  }
}
