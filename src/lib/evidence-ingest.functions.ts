import { createServerFn } from "@tanstack/react-start";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type IngestFileInput = {
  storage_key: string;
  original_filename: string;
  mime: string;
  bytes: number;
};

type IngestInput = {
  files: IngestFileInput[];
};

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