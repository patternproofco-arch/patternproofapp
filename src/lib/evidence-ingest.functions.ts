import { createServerFn } from "@tanstack/react-start";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type IngestFileInput = {
  storage_key: string;
  original_filename: string;
  mime: string;
  bytes: number;
  /**
   * Optional dating. Absent means "no date claimed" — nothing here forces a
   * date onto a file, and we never quietly stamp today's date as a fact.
   */
  date?: string | null;
  date_precision?: string | null;
  date_range_start?: string | null;
  date_range_end?: string | null;
  anchor_label?: string | null;
  /** Whether the survivor chose to keep or remove embedded photo metadata. */
  exif_choice?: "none" | "kept" | "stripped" | null;
  /** Optional spoken caption, already transcribed client-side or later. */
  voice_caption?: string | null;
  voice_caption_audio_url?: string | null;
};

type IngestInput = {
  files: IngestFileInput[];
  /** Links this preservation run to a resumable intake batch, when there is one. */
  intake_batch_id?: string | null;
};

const PRECISIONS = new Set([
  "exact",
  "approximate_month",
  "range",
  "before_anchor",
  "after_anchor",
  "unknown",
]);

export type PreservationStatus =
  | "preserved"
  | "extraction_pending"
  | "needs_attention"
  | "unsupported_but_preserved"
  | "upload_incomplete";

export type PreservationReceiptItem = {
  storage_key: string;
  original_filename: string;
  evidence_id: string | null;
  status: PreservationStatus | "failed";
  sha256: string | null;
  bytes: number | null;
  mime: string | null;
  message?: string;
  duplicate_of?: string | null;
  duplicate_of_title?: string | null;
  family_id?: string | null;
  near_duplicate_of?: string | null;
  near_duplicate_of_title?: string | null;
  near_duplicate_distance?: number | null;
};

export type PreservationReceipt = {
  batch_id: string;
  preserved_at: string;
  items: PreservationReceiptItem[];
};

function fileKind(mime: string): "image" | "audio" | "video" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

function classify(mime: string): PreservationStatus {
  if (
    mime.startsWith("image/") ||
    mime === "application/pdf" ||
    mime.startsWith("text/")
  ) {
    return "preserved";
  }
  if (mime.startsWith("audio/") || mime.startsWith("video/")) {
    return "extraction_pending";
  }
  return "unsupported_but_preserved";
}

// dHash 8x8 → 64-bit perceptual hash, encoded as 16 hex chars. Compare with
// Hamming distance. Threshold of 10/64 bits is the conservative default for
// dHash — tight enough to avoid false positives on genuinely different photos
// while still catching re-encoded/cropped screenshots of the same source.
const PHASH_MATCH_MAX_DISTANCE = 10;

const HASHABLE_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/gif",
  "image/tiff",
]);

async function computeDHash(buf: Buffer): Promise<string | null> {
  try {
    const { Jimp } = await import("jimp");
    const img = await Jimp.read(buf);
    // 9x8 grayscale — 8 dHash bits per row via horizontal gradient.
    img.resize({ w: 9, h: 8 }).greyscale();
    let bits = "";
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = (img.bitmap.data[(y * 9 + x) * 4] ?? 0);
        const right = (img.bitmap.data[(y * 9 + x + 1) * 4] ?? 0);
        bits += left < right ? "1" : "0";
      }
    }
    // Pack 64 bits into 16 hex chars.
    let hex = "";
    for (let i = 0; i < 64; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex;
  } catch {
    return null;
  }
}

function hammingHex(a: string, b: string): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

/**
 * Preserve a batch of already-uploaded files:
 *   - Streams each object from the private `evidence-files` bucket.
 *   - Computes SHA-256 server-side (the survivor cannot forge it).
 *   - Writes an `evidence` row per file with integrity metadata.
 *   - Records an audit_events row per file (server-only via SECURITY DEFINER).
 * Never mutates the originally uploaded object.
 */
export const ingestEvidenceBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: IngestInput) => {
    if (!input || !Array.isArray(input.files) || input.files.length === 0) {
      throw new Error("No files provided");
    }
    if (input.files.length > 50) throw new Error("Too many files in one batch");
    for (const f of input.files) {
      if (!f.storage_key || typeof f.storage_key !== "string") {
        throw new Error("Missing storage_key");
      }
      if (!f.original_filename) throw new Error("Missing original_filename");
      if (typeof f.bytes !== "number" || f.bytes < 0) throw new Error("Invalid bytes");
      if (typeof f.mime !== "string") throw new Error("Invalid mime");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Every survivor-uploaded key must be scoped under their user_id prefix.
    for (const f of data.files) {
      if (!f.storage_key.startsWith(`${userId}/`)) {
        throw new Error("Storage key not owned by caller");
      }
    }

    // Open a batch record.
    const batchInsert = await supabase
      .from("import_batches")
      .insert({
        user_id: userId,
        source_kind: "evidence_upload",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (batchInsert.error || !batchInsert.data) {
      throw new Error("Could not open import batch");
    }
    const batchId = batchInsert.data.id as string;
    const items: PreservationReceiptItem[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const f of data.files) {
      try {
        const dl = await supabase.storage.from("evidence-files").download(f.storage_key);
        if (dl.error || !dl.data) {
          items.push({
            storage_key: f.storage_key,
            original_filename: f.original_filename,
            evidence_id: null,
            status: "failed",
            sha256: null,
            bytes: null,
            mime: null,
            message: "Could not read the uploaded file.",
          });
          continue;
        }
        const buf = Buffer.from(await dl.data.arrayBuffer());
        const sha256 = createHash("sha256").update(buf).digest("hex");
        const bytes = buf.byteLength;
        const status = classify(f.mime);
        const nowIso = new Date().toISOString();

        // Exact-duplicate detection: earliest non-deleted evidence row for this
        // user with the same sha256. We still preserve the new file — dedupe
        // only records the relationship via evidence_families.
        const dupRes = await supabase
          .from("evidence")
          .select("id, title, family_id, created_at")
          .eq("user_id", userId)
          .eq("sha256", sha256)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        const existing = dupRes.data ?? null;

        let familyId: string | null = existing?.family_id ?? null;
        let canonicalId: string | null = existing?.id ?? null;
        let canonicalTitle: string | null = existing?.title ?? null;

        if (existing && !familyId) {
          // Neither row has a family yet — create one anchored on the existing (earlier) row.
          const famIns = await supabase
            .from("evidence_families")
            .insert({ user_id: userId, canonical_evidence_id: existing.id })
            .select("id")
            .single();
          if (!famIns.error && famIns.data) {
            familyId = famIns.data.id as string;
            await supabase
              .from("evidence")
              .update({ family_id: familyId })
              .eq("id", existing.id)
              .eq("user_id", userId);
          }
        }

        // Perceptual-hash (near-duplicate) detection — images only, and only
        // when this file isn't already an exact duplicate.
        let perceptualHash: string | null = null;
        let nearDupId: string | null = null;
        let nearDupTitle: string | null = null;
        let nearDupDistance: number | null = null;
        let nearDupStatus: "unreviewed" | null = null;
        if (!existing && HASHABLE_IMAGE_MIMES.has(f.mime)) {
          perceptualHash = await computeDHash(buf);
          if (perceptualHash) {
            const candidates = await supabase
              .from("evidence")
              .select("id, title, perceptual_hash")
              .eq("user_id", userId)
              .is("deleted_at", null)
              .not("perceptual_hash", "is", null);
            const rows = candidates.data ?? [];
            let best: { id: string; title: string | null; d: number } | null = null;
            for (const r of rows) {
              if (!r.perceptual_hash) continue;
              const d = hammingHex(perceptualHash, r.perceptual_hash);
              if (d <= PHASH_MATCH_MAX_DISTANCE && (!best || d < best.d)) {
                best = { id: r.id as string, title: (r.title as string | null) ?? null, d };
              }
            }
            if (best) {
              nearDupId = best.id;
              nearDupTitle = best.title;
              nearDupDistance = best.d;
              nearDupStatus = "unreviewed";
            }
          }
        }

        const insert = await supabase
          .from("evidence")
          .insert({
            user_id: userId,
            title: f.original_filename.replace(/\.[^.]+$/, "") || f.original_filename,
            date: today,
            description: null,
            file_url: f.storage_key,
            file_type: fileKind(f.mime),
            sha256,
            bytes,
            mime: f.mime || null,
            original_filename: f.original_filename,
            preservation_status: status,
            preserved_at: nowIso,
            integrity_verified_at: nowIso,
            import_batch_id: batchId,
            family_id: familyId,
            perceptual_hash: perceptualHash,
            near_duplicate_of: nearDupId,
            near_duplicate_status: nearDupStatus,
          })
          .select("id")
          .single();

        if (insert.error || !insert.data) {
          items.push({
            storage_key: f.storage_key,
            original_filename: f.original_filename,
            evidence_id: null,
            status: "failed",
            sha256,
            bytes,
            mime: f.mime,
            message: "Preserved the file, but could not record it.",
          });
          continue;
        }

        // Server-only audit event.
        await supabaseAdmin.rpc("record_audit_event", {
          p_user_id: userId,
          p_event_type: "evidence.preserved",
          p_subject_kind: "evidence",
          p_subject_id: insert.data.id,
          p_actor_kind: "user",
          p_actor_id: userId,
          p_meta: { sha256, bytes, mime: f.mime, batch_id: batchId },
        });

        if (existing) {
          await supabaseAdmin.rpc("record_audit_event", {
            p_user_id: userId,
            p_event_type: "evidence.duplicate_detected",
            p_subject_kind: "evidence",
            p_subject_id: insert.data.id,
            p_actor_kind: "user",
            p_actor_id: userId,
            p_meta: {
              sha256,
              duplicate_of: canonicalId,
              family_id: familyId,
              batch_id: batchId,
            },
          });
        }

        if (nearDupId && insert.data) {
          await supabaseAdmin.rpc("record_audit_event", {
            p_user_id: userId,
            p_event_type: "evidence.near_duplicate_flagged",
            p_subject_kind: "evidence",
            p_subject_id: insert.data.id,
            p_actor_kind: "user",
            p_actor_id: userId,
            p_meta: {
              near_duplicate_of: nearDupId,
              distance: nearDupDistance,
              perceptual_hash: perceptualHash,
              batch_id: batchId,
            },
          });
        }

        items.push({
          storage_key: f.storage_key,
          original_filename: f.original_filename,
          evidence_id: insert.data.id as string,
          status,
          sha256,
          bytes,
          mime: f.mime,
          duplicate_of: canonicalId,
          duplicate_of_title: existing ? canonicalTitle : null,
          family_id: familyId,
          near_duplicate_of: nearDupId,
          near_duplicate_of_title: nearDupTitle,
          near_duplicate_distance: nearDupDistance,
        });
      } catch (err) {
        items.push({
          storage_key: f.storage_key,
          original_filename: f.original_filename,
          evidence_id: null,
          status: "failed",
          sha256: null,
          bytes: null,
          mime: null,
          message: err instanceof Error ? err.message : "Unknown error.",
        });
      }
    }

    const finishedAt = new Date().toISOString();
    const receipt: PreservationReceipt = {
      batch_id: batchId,
      preserved_at: finishedAt,
      items,
    };
    await supabase
      .from("import_batches")
      // JSON round-trip strips class instances and satisfies Supabase's Json type.
      .update({ finished_at: finishedAt, receipt: JSON.parse(JSON.stringify(receipt)) })
      .eq("id", batchId)
      .eq("user_id", userId);

    return receipt;
  });
/**
 * Survivor confirms the flagged near-duplicate is the same underlying record.
 * Reuses evidence_families: attaches the new row (and its canonical target)
 * to the same family, so export/court-packet grouping picks it up unchanged.
 */
export const confirmNearDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { evidence_id: string }) => {
    if (!input?.evidence_id) throw new Error("Missing evidence_id");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const cur = await supabase
      .from("evidence")
      .select("id, near_duplicate_of, family_id")
      .eq("id", data.evidence_id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (cur.error || !cur.data) throw new Error("Evidence not found");
    const target = cur.data.near_duplicate_of as string | null;
    if (!target) throw new Error("No pending near-duplicate on this item");

    const other = await supabase
      .from("evidence")
      .select("id, family_id")
      .eq("id", target)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (other.error || !other.data) throw new Error("Similar evidence not found");

    let familyId: string | null = (other.data.family_id as string | null) ?? (cur.data.family_id as string | null);
    if (!familyId) {
      const fam = await supabase
        .from("evidence_families")
        .insert({ user_id: userId, canonical_evidence_id: other.data.id })
        .select("id")
        .single();
      if (fam.error || !fam.data) throw new Error("Could not create family");
      familyId = fam.data.id as string;
      await supabase.from("evidence").update({ family_id: familyId })
        .eq("id", other.data.id).eq("user_id", userId);
    }

    await supabase.from("evidence")
      .update({ family_id: familyId, near_duplicate_status: "confirmed" })
      .eq("id", cur.data.id).eq("user_id", userId);

    return { ok: true, family_id: familyId };
  });

/**
 * Survivor rejects the near-duplicate flag. The row stays fully independent
 * (no family link), and it won't be flagged again.
 */
export const rejectNearDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { evidence_id: string }) => {
    if (!input?.evidence_id) throw new Error("Missing evidence_id");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const up = await supabase.from("evidence")
      .update({ near_duplicate_status: "rejected" })
      .eq("id", data.evidence_id)
      .eq("user_id", userId);
    if (up.error) throw new Error(up.error.message);
    return { ok: true };
  });
