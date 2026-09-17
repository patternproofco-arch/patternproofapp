import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// Screenshot message import. No AI, no model calls, no telemetry on content —
// OCR happens in the survivor's browser and only the results land here.

const sideEnum = z.enum(["incoming", "outgoing", "unknown"]);
const dateConfEnum = z.enum(["explicit_date", "relative", "time_only", "none"]);
const fieldEnum = z.enum(["sender", "sender_side", "sent_on", "sent_at_time", "body"]);

type Sb = SupabaseClient<Database>;

async function writeAudit(supabase: Sb, userId: string, action: string, ref: string) {
  try {
    await supabase.from("audit_log").insert({
      user_id: userId,
      action_type: action,
      actor: "survivor",
      record_reference: ref,
      timestamp_utc: new Date().toISOString(),
    });
  } catch {
    /* audit must never block the survivor's work */
  }
}

/** Creates (or resumes) a draft import thread. */
export const startMessageImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        participant: z.string().max(200).optional(),
        notes: z.string().max(500).optional(),
        captureMethod: z.enum(["multi_screenshot", "screen_recording"]).default("multi_screenshot"),
        /** Storage path of the original recording, when this import came from video. */
        videoPath: z.string().max(500).optional(),
        videoDurationSec: z.number().int().min(0).optional(),
        frameIntervalSec: z.number().min(0.1).max(30).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const isVideo = data.captureMethod === "screen_recording";
    const { data: row, error } = await supabase
      .from("message_threads")
      .insert({
        user_id: userId,
        source_type: "txt",
        source_filename: `${isVideo ? "Screen recording" : "Screenshot"} import · ${new Date().toLocaleDateString()}`,
        file_url: data.videoPath ?? "",
        parse_status: "pending",
        capture_method: data.captureMethod,
        captured_at: new Date().toISOString(),
        conversation_participant: data.participant?.trim() || null,
        capture_notes: data.notes?.trim() || null,
        primary_artifact_urls: data.videoPath ? [data.videoPath] : [],
        screenshot_count: 0,
        video_duration_sec: data.videoDurationSec ?? null,
        frame_interval_sec: data.frameIntervalSec ?? null,
        import_status: "draft",
        processed_count: 0,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error("We couldn't start that import. Try again in a moment.");
    await writeAudit(supabase, userId, "message_import_started", row.id);
    return { threadId: row.id as string };
  });

/** Records one uploaded screenshot. Called before its OCR result is saved. */
export const addSourceDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        threadId: z.string().uuid(),
        storagePath: z.string().min(1).max(500),
        originalFilename: z.string().max(260).optional(),
        uploadIndex: z.number().int().min(0).max(500),
        bytes: z.number().int().min(0).optional(),
        mime: z.string().max(120).optional(),
        kind: z.enum(["screenshot", "video_frame"]).default("screenshot"),
        frameTimeSec: z.number().min(0).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("thread_source_documents")
      .insert({
        user_id: userId,
        thread_id: data.threadId,
        storage_path: data.storagePath,
        original_filename: data.originalFilename ?? null,
        upload_index: data.uploadIndex,
        bytes: data.bytes ?? null,
        mime: data.mime ?? null,
        kind: data.kind,
        frame_time_sec: data.frameTimeSec ?? null,
        ocr_status: "pending",
      })
      .select("id")
      .single();
    if (error || !row) throw new Error("We couldn't save that screenshot record.");
    return { sourceDocumentId: row.id as string };
  });

const draftSchema = z.object({
  body: z.string().max(8000),
  sender_side: sideEnum,
  sent_on: z.string().max(10).nullable(),
  sent_at_time: z.string().max(8).nullable(),
  date_confidence: dateConfEnum,
  has_attachment_marker: z.boolean(),
  attachment_marker_text: z.string().max(120).nullable(),
  ocr_confidence: z.number(),
  source_document_ids: z.array(z.string().uuid()).min(1),
});

/**
 * Replaces the extracted message set for a thread. Autosaved after each image,
 * so closing the tab mid-import never loses work.
 */
export const saveExtractedMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        threadId: z.string().uuid(),
        processedCount: z.number().int().min(0),
        participant: z.string().max(200).nullable().optional(),
        complete: z.boolean().default(false),
        messages: z.array(draftSchema).max(4000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: docs } = await supabase
      .from("thread_source_documents")
      .select("storage_path,upload_index")
      .eq("thread_id", data.threadId)
      .eq("user_id", userId)
      .order("upload_index", { ascending: true });
    const paths = (docs ?? []).map((d) => d.storage_path as string);

    // Corrections reference message ids, so a rebuild would orphan them: only
    // rows that were never corrected get replaced.
    const { data: existing } = await supabase
      .from("thread_messages")
      .select("id")
      .eq("thread_id", data.threadId)
      .eq("user_id", userId);
    const existingIds = (existing ?? []).map((r) => r.id as string);
    let corrected: string[] = [];
    if (existingIds.length) {
      const { data: corr } = await supabase
        .from("thread_message_corrections")
        .select("message_id")
        .eq("user_id", userId)
        .in("message_id", existingIds);
      corrected = Array.from(new Set((corr ?? []).map((c) => c.message_id as string)));
    }
    const removable = existingIds.filter((id) => !corrected.includes(id));
    if (removable.length) {
      await supabase.from("thread_messages").delete().eq("user_id", userId).in("id", removable);
    }

    const rows = data.messages.map((m, idx) => ({
      thread_id: data.threadId,
      user_id: userId,
      position: idx + 1 + corrected.length,
      sender: null,
      recipient: null,
      sent_on: m.sent_on,
      sent_at_time: m.sent_at_time,
      body: m.body,
      attachment_name: m.attachment_marker_text,
      flags: {},
      source_document_id: m.source_document_ids[0]!,
      source_document_ids: m.source_document_ids,
      sender_side: m.sender_side,
      date_confidence: m.date_confidence,
      has_attachment_marker: m.has_attachment_marker,
      attachment_marker_text: m.attachment_marker_text,
      ocr_confidence: m.ocr_confidence,
      field_provenance: {
        body: "extracted",
        sender_side: "extracted",
        sent_on: "extracted",
        sent_at_time: "extracted",
      },
    }));
    if (rows.length) {
      const { error } = await supabase.from("thread_messages").insert(rows);
      if (error)
        throw new Error("We couldn't save those messages. Your screenshots are still stored.");
    }

    await supabase
      .from("message_threads")
      .update({
        message_count: rows.length + corrected.length,
        processed_count: data.processedCount,
        screenshot_count: paths.length,
        primary_artifact_urls: paths,
        file_url: paths[0] ?? "",
        import_status: data.complete ? "complete" : "in_progress",
        parse_status: data.complete ? (rows.length ? "parsed" : "partial") : "pending",
        ...(data.participant !== undefined ? { conversation_participant: data.participant } : {}),
      })
      .eq("id", data.threadId)
      .eq("user_id", userId);

    if (data.complete)
      await writeAudit(supabase, userId, "message_import_completed", data.threadId);
    return { saved: rows.length };
  });

/** Corrections ADD a value — the original OCR guess is never overwritten. */
export const correctMessageField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        messageId: z.string().uuid(),
        field: fieldEnum,
        value: z.string().max(8000).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: msg, error: readErr } = await supabase
      .from("thread_messages")
      .select("id,body,sender,sender_side,sent_on,sent_at_time,field_provenance")
      .eq("id", data.messageId)
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr || !msg) throw new Error("We couldn't find that message.");

    const current = (msg as Record<string, unknown>)[data.field];
    const oldValue = current == null ? null : String(current);
    if (oldValue === data.value) return { ok: true };

    await supabase.from("thread_message_corrections").insert({
      user_id: userId,
      message_id: data.messageId,
      field: data.field,
      old_value: oldValue,
      new_value: data.value,
      source: "user",
    });

    const provenance = {
      ...((msg.field_provenance as Record<string, string> | null) ?? {}),
      [data.field]: "corrected",
    };
    const patch: Record<string, unknown> = { field_provenance: provenance };
    patch[data.field] = data.value;
    const { error } = await supabase
      .from("thread_messages")
      .update(patch as never)
      .eq("id", data.messageId)
      .eq("user_id", userId);
    if (error) throw new Error("We couldn't save that change. Try again in a moment.");

    await writeAudit(supabase, userId, `message_field_corrected:${data.field}`, data.messageId);
    return { ok: true };
  });

/** Permanently removes an import: messages, corrections, records, and files. */
export const deleteMessageImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ threadId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: docs } = await supabase
      .from("thread_source_documents")
      .select("storage_path")
      .eq("thread_id", data.threadId)
      .eq("user_id", userId);
    const paths = (docs ?? []).map((d) => d.storage_path as string).filter(Boolean);
    if (paths.length) {
      await supabase.storage.from("evidence-files").remove(paths);
    }
    await supabase
      .from("thread_messages")
      .delete()
      .eq("thread_id", data.threadId)
      .eq("user_id", userId);
    await supabase
      .from("thread_source_documents")
      .delete()
      .eq("thread_id", data.threadId)
      .eq("user_id", userId);
    const { error } = await supabase
      .from("message_threads")
      .delete()
      .eq("id", data.threadId)
      .eq("user_id", userId);
    if (error) throw new Error("We couldn't delete that import. Try again in a moment.");
    await writeAudit(supabase, userId, "message_import_deleted", data.threadId);
    return { ok: true, filesRemoved: paths.length };
  });
