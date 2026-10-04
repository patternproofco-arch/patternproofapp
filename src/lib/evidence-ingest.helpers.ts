/**
 * Small, testable rules used by the evidence ingest server function.
 *
 *  - Idempotent by stored object: if a record for this uploaded file already exists, ingest
 *    hands it back instead of creating a second one. A retry after a lost response, or two
 *    tabs, can never make duplicate records for one file.
 *  - A file can only be linked to an entry the caller owns.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type ExistingIngest = {
  id: string;
  sha256: string | null;
  bytes: number | null;
  mime: string | null;
  preservation_status: string | null;
  family_id: string | null;
};

/** The live record already made for this uploaded object, if any. Throws if the read fails. */
export async function findExistingIngest(
  db: Db,
  userId: string,
  storageKey: string,
): Promise<ExistingIngest | null> {
  const { data, error } = await db
    .from("evidence")
    .select("id,sha256,bytes,mime,preservation_status,family_id")
    .eq("user_id", userId)
    .eq("file_url", storageKey)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("Could not check whether this file was already saved.");
  return (data as ExistingIngest | null) ?? null;
}

/** True only if the entry exists and belongs to this user and isn't deleted. */
export async function ownsIncident(db: Db, userId: string, incidentId: string): Promise<boolean> {
  const { data, error } = await db
    .from("incidents")
    .select("id")
    .eq("id", incidentId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("Could not check the entry this file belongs to.");
  return !!data;
}
