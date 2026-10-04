/**
 * Decide whether a professional may download one shared file, and produce the
 * signed link. Every rule lives here (not in a screen) so it is enforced on the
 * server and can be tested: the file must be inside what the survivor shared,
 * still exist and not be deleted, and really be in storage. A failure says why
 * in plain words; it never returns an empty link that looks like success.
 */
import { idInScope } from "@/lib/attorney-access.server";

type ScopeLink = Parameters<typeof idInScope>[0];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type DownloadDecision =
  | { ok: true; url: string; file_type: string | null; title: string | null }
  | { ok: false; code: "not_shared" | "gone" | "unavailable" | "file_missing"; message: string };

const BUCKET = "evidence-files";

export async function authorizeEvidenceDownload(args: {
  admin: Admin;
  link: ScopeLink;
  clientId: string;
  evidenceId: string;
  ttlSeconds: number;
}): Promise<DownloadDecision> {
  const { admin, link, clientId, evidenceId, ttlSeconds } = args;

  if (!idInScope(link, "evidence", evidenceId)) {
    return { ok: false, code: "not_shared", message: "This file isn't shared with you." };
  }

  // Deleted and not-yet-confirmed ("suggested") files are invisible in every list,
  // so they must not be downloadable by id either.
  const { data: ev } = await admin
    .from("evidence")
    .select("file_url,file_type,title")
    .eq("id", evidenceId)
    .eq("user_id", clientId)
    .is("deleted_at", null)
    .neq("review_status", "suggested")
    .maybeSingle();
  if (!ev) {
    return {
      ok: false,
      code: "gone",
      message: "This file is no longer available. The survivor may have removed it.",
    };
  }

  // Only sign objects inside the owner's own storage folder. Never follow absolute
  // URLs or paths that point at another user's files.
  const path = String(ev.file_url ?? "");
  if (
    !path ||
    /^https?:\/\//i.test(path) ||
    !path.startsWith(`${clientId}/`) ||
    path.includes("..")
  ) {
    return { ok: false, code: "unavailable", message: "This file can't be opened from here." };
  }

  // Signing a link does not check that the object exists. Check, so a shared file
  // that is missing from storage is reported instead of handing back a dead link.
  const exists = await admin.storage.from(BUCKET).exists(path);
  if (exists.error || exists.data !== true) {
    return {
      ok: false,
      code: "file_missing",
      message:
        "This file is shared with you but can't be found in storage, so it can't be opened. Ask the survivor to upload it again.",
    };
  }

  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, ttlSeconds);
  if (error || !signed?.signedUrl) {
    return { ok: false, code: "unavailable", message: "This file can't be opened from here." };
  }
  return {
    ok: true,
    url: signed.signedUrl,
    file_type: ev.file_type ?? null,
    title: ev.title ?? null,
  };
}
