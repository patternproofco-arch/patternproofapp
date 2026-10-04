/**
 * One way to get a file into the evidence vault from the browser.
 *
 * Upload the original, have the server preserve it (SHA-256, record, source link), and
 * report honestly what happened:
 *  - the storage name is chosen once, so every retry refers to the same object;
 *  - the server ingest is idempotent on that name, so a retry after a lost reply can't make
 *    a second record;
 *  - success is returned only when the server confirms a record exists;
 *  - if the server definitively could not record the file, the orphaned upload is removed,
 *    so nothing is left in storage with no record pointing at it;
 *  - if the outcome is UNKNOWN (no reply), the upload is NOT removed (the record may exist),
 *    and the caller gets the key to retry safely or to check Files.
 */

export type IntakeFile = {
  name: string;
  type: string;
  size: number;
  blob: Blob;
};

export type IntakeDating = {
  date?: string | null;
  date_precision?: string | null;
  date_range_start?: string | null;
  date_range_end?: string | null;
  anchor_label?: string | null;
};

export type IngestItem = {
  evidence_id: string | null;
  status: string;
  message?: string;
  duplicate_of?: string | null;
  duplicate_of_title?: string | null;
};

export type IntakeDeps = {
  upload(key: string, blob: Blob): Promise<{ error: { message: string; statusCode?: string } | null }>;
  remove(keys: string[]): Promise<void>;
  ingest(file: {
    storage_key: string;
    original_filename: string;
    mime: string;
    bytes: number;
    linked_incident_id?: string | null;
  } & IntakeDating): Promise<{ items: IngestItem[] }>;
  sleep(ms: number): Promise<void>;
  newKey(userId: string, filename: string): string;
};

export type IntakeResult =
  | {
      ok: true;
      evidenceId: string;
      storageKey: string;
      alreadySaved: boolean;
      duplicateOf: string | null;
      duplicateOfTitle: string | null;
    }
  | {
      ok: false;
      /** upload: nothing was stored. record: stored but not recorded, then removed. unconfirmed: unknown. */
      stage: "upload" | "record" | "unconfirmed";
      message: string;
      storageKey: string;
      /** The orphaned upload was removed. */
      cleanedUp: boolean;
    };

export const INTAKE_ATTEMPTS = 3;

const ALREADY_THERE = /already exists|duplicate|resource already|409/i;

export function safeName(name: string): string {
  return name.replace(/[^\w.-]/g, "_").slice(0, 120) || "file";
}

export async function uploadAndPreserve(
  deps: IntakeDeps,
  args: {
    userId: string;
    file: IntakeFile;
    dating?: IntakeDating;
    linkedIncidentId?: string | null;
    /** Reuse the name from an earlier attempt that came back unconfirmed. */
    resumeKey?: string;
  },
): Promise<IntakeResult> {
  const key = args.resumeKey ?? deps.newKey(args.userId, safeName(args.file.name));

  // 1. Upload the original. A retry that finds it already there is a success.
  let uploaded = false;
  for (let attempt = 0; attempt < INTAKE_ATTEMPTS && !uploaded; attempt++) {
    const res: Awaited<ReturnType<IntakeDeps["upload"]>> = await deps
      .upload(key, args.file.blob)
      .catch((e: unknown) => ({ error: { message: e instanceof Error ? e.message : "network" } }));
    if (!res.error || ALREADY_THERE.test(`${res.error.statusCode ?? ""} ${res.error.message}`)) {
      uploaded = true;
    } else if (attempt < INTAKE_ATTEMPTS - 1) {
      await deps.sleep(400 * 2 ** attempt);
    }
  }
  if (!uploaded) {
    return {
      ok: false,
      stage: "upload",
      message: "We couldn't upload that file. Nothing was saved. Check your connection and try again.",
      storageKey: key,
      cleanedUp: false,
    };
  }

  // 2. Ask the server to preserve and record it. Idempotent on the key, so retrying is safe.
  let definitiveFailure: string | null = null;
  let heardBack = false;
  for (let attempt = 0; attempt < INTAKE_ATTEMPTS; attempt++) {
    let item: IngestItem | undefined;
    try {
      const receipt = await deps.ingest({
        storage_key: key,
        original_filename: args.file.name,
        mime: args.file.type || "application/octet-stream",
        bytes: args.file.size,
        linked_incident_id: args.linkedIncidentId ?? null,
        ...(args.dating ?? {}),
      });
      item = receipt.items[0];
      heardBack = true;
    } catch {
      // No reply. The record may or may not exist.
      if (attempt < INTAKE_ATTEMPTS - 1) await deps.sleep(400 * 2 ** attempt);
      continue;
    }
    if (item?.evidence_id) {
      return {
        ok: true,
        evidenceId: item.evidence_id,
        storageKey: key,
        alreadySaved: /already saved/i.test(item.message ?? ""),
        duplicateOf: item.duplicate_of ?? null,
        duplicateOfTitle: item.duplicate_of_title ?? null,
      };
    }
    definitiveFailure = item?.message ?? "The file could not be recorded.";
    // A refusal that retrying can't change (e.g. not the caller's entry) stops here.
    if (/isn't on your account/i.test(definitiveFailure)) break;
    if (attempt < INTAKE_ATTEMPTS - 1) await deps.sleep(400 * 2 ** attempt);
  }

  if (heardBack && definitiveFailure) {
    // The server answered "no record was made". Leave nothing behind.
    let cleanedUp = false;
    try {
      await deps.remove([key]);
      cleanedUp = true;
    } catch {
      cleanedUp = false;
    }
    return {
      ok: false,
      stage: "record",
      message: `${definitiveFailure} Nothing was saved${cleanedUp ? "" : ", and the upload couldn't be cleaned up"}.`,
      storageKey: key,
      cleanedUp,
    };
  }

  return {
    ok: false,
    stage: "unconfirmed",
    message:
      "We couldn't confirm this saved. It may have. Check Files before uploading again, or try again: it won't be duplicated.",
    storageKey: key,
    cleanedUp: false,
  };
}
