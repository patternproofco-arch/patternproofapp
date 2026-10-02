import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Soft draft entries for uploaded photos, audio, and video.
 *
 * Same tray as AI / request-answer drafts (`proposed_incidents` → /drafts).
 * Soft claims only: no event date invented from upload time, no legal outcome
 * language, model null. Survivor must approve before anything hits the timeline.
 *
 * Does not call AI or OCR. Uses title, description, and any transcript /
 * extracted_text already stored on the evidence row.
 */

type EvidenceRow = {
  id: string;
  title: string | null;
  description: string | null;
  mime: string | null;
  file_type: string | null;
  transcript: string | null;
  transcript_status: string | null;
  extracted_text: string | null;
  original_filename: string | null;
};

/** When browser File.type is empty, ingest may store application/octet-stream. */
function kindFromFilename(name: string | null): "photo" | "audio" | "video" | null {
  const n = (name ?? "").toLowerCase();
  if (/\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/.test(n)) return "photo";
  if (/\.(mp3|m4a|aac|wav|ogg|flac|opus)$/.test(n)) return "audio";
  if (/\.(mp4|mov|webm|mkv|m4v|avi)$/.test(n)) return "video";
  return null;
}

function isMediaMime(
  mime: string | null,
  fileType: string | null,
  filename?: string | null,
): "photo" | "audio" | "video" | null {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/") || fileType === "image") return "photo";
  if (m.startsWith("audio/") || fileType === "audio") return "audio";
  if (m.startsWith("video/") || fileType === "video") return "video";
  // Fallback when mime was lost (octet-stream / null) but the filename is clear.
  return kindFromFilename(filename ?? null);
}

function softLabel(kind: "photo" | "audio" | "video"): string {
  if (kind === "photo") return "photo";
  if (kind === "audio") return "audio recording";
  return "video";
}

function buildDescription(row: EvidenceRow, kind: "photo" | "audio" | "video"): string {
  const parts: string[] = [];
  const title = (row.title || row.original_filename || softLabel(kind)).trim();
  const desc = (row.description ?? "").trim();
  if (desc) parts.push(desc);

  const transcript =
    row.transcript_status === "ready" ? (row.transcript ?? "").trim() : "";
  if (transcript) {
    parts.push(`From "${title}":\n${transcript}`);
  } else {
    const extracted = (row.extracted_text ?? "").trim();
    if (extracted) parts.push(`From "${title}":\n${extracted}`);
  }

  if (parts.length === 0) {
    parts.push(
      `${softLabel(kind).charAt(0).toUpperCase()}${softLabel(kind).slice(1)} uploaded: "${title}". Add what happened and when.`,
    );
  }
  return parts.join("\n\n").slice(0, 4000);
}

export type SoftDraftEnsureResult = {
  queued: number;
  skipped: number;
  /** Discriminator when queued is 0 — for logs / soft-check, not survivor UI. */
  reason?:
    | "empty_ids"
    | "evidence_lookup_failed"
    | "not_media"
    | "already_pending"
    | "insert_failed"
    | "thrown";
};

/**
 * Insert one pending draft per media file that is not already waiting in
 * Drafts to review. Safe to call repeatedly; failures never throw to the
 * upload path.
 */
export async function ensureSoftMediaDraftsForEvidence(
  userId: string,
  evidenceIds: string[],
): Promise<SoftDraftEnsureResult> {
  const ids = [...new Set(evidenceIds.filter(Boolean))];
  if (!ids.length) return { queued: 0, skipped: 0, reason: "empty_ids" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: files, error: filesError } = await supabaseAdmin
    .from("evidence")
    .select(
      "id,title,description,mime,file_type,transcript,transcript_status,extracted_text,original_filename",
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("id", ids);

  if (filesError || !files?.length) {
    return { queued: 0, skipped: 0, reason: "evidence_lookup_failed" };
  }

  const mediaRows = (files as EvidenceRow[]).filter((row) =>
    isMediaMime(row.mime, row.file_type, row.original_filename),
  );
  if (!mediaRows.length) return { queued: 0, skipped: ids.length, reason: "not_media" };

  const { data: pending } = await supabaseAdmin
    .from("proposed_incidents")
    .select("source_evidence_ids")
    .eq("user_id", userId)
    .eq("status", "pending");

  const alreadyProposed = new Set<string>(
    (pending ?? []).flatMap((row) => (row.source_evidence_ids ?? []) as string[]),
  );

  let queued = 0;
  let skipped = 0;
  let sawAlreadyPending = false;
  let sawInsertFailed = false;
  const batchId = crypto.randomUUID();

  for (const row of mediaRows) {
    if (alreadyProposed.has(row.id)) {
      skipped += 1;
      sawAlreadyPending = true;
      continue;
    }
    const kind = isMediaMime(row.mime, row.file_type, row.original_filename);
    if (!kind) {
      skipped += 1;
      continue;
    }
    const description = buildDescription(row, kind);
    const { error } = await supabaseAdmin.from("proposed_incidents").insert({
      user_id: userId,
      batch_id: batchId,
      sort_key: null,
      sort_key_kind: null,
      date_certainty: "unknown",
      draft: { date: null, description, abuse_types: [] },
      source_evidence_ids: [row.id],
      source_summary: `Uploaded ${softLabel(kind)}: ${row.title || row.original_filename || "untitled"}`,
      confidence_notes: [
        "Built from your upload. Check the text and add the event date yourself.",
        "Nothing reaches your timeline until you approve this draft.",
      ],
      status: "pending",
      model: null,
    });
    if (error) {
      skipped += 1;
      sawInsertFailed = true;
      continue;
    }
    alreadyProposed.add(row.id);
    queued += 1;
  }

  const reason =
    queued > 0
      ? undefined
      : sawInsertFailed
        ? "insert_failed"
        : sawAlreadyPending
          ? "already_pending"
          : "not_media";

  return { queued, skipped, ...(reason ? { reason } : {}) };
}

/**
 * After a successful photo / audio / video upload (and after transcription
 * when applicable), queue soft draft entries into Drafts to review.
 */
export const ensureMediaUploadDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        evidence_ids: z.array(z.string().uuid()).min(1).max(40),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
      const result = await ensureSoftMediaDraftsForEvidence(context.userId, data.evidence_ids);
      return { ok: true as const, ...result };
    } catch {
      // Upload already succeeded; drafts are a convenience.
      return {
        ok: true as const,
        queued: 0,
        skipped: data.evidence_ids.length,
        reason: "thrown" as const,
      };
    }
  });
