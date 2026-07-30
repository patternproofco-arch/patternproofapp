import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Resumable mixed-media intake.
 *
 * The files themselves stay in the browser's local queue until they upload;
 * this table only records that a batch is open, so the app can offer to pick
 * it back up on another day or another device.
 */

export interface IntakeBatch {
  id: string;
  status: string;
  kind_counts: Record<string, number>;
  queued_files: Array<{ name: string; bytes: number; mime: string }>;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export const openIntakeBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { note?: string | null } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("intake_batches")
      .insert({ user_id: context.userId, note: data.note ?? null })
      .select("id")
      .single();
    if (res.error || !res.data) throw new Error("We couldn't start this batch. Try again in a moment.");
    return { batchId: res.data.id as string };
  });

export const updateIntakeBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    batchId: string;
    status?: "in_progress" | "complete" | "abandoned";
    kindCounts?: Record<string, number>;
    queuedFiles?: Array<{ name: string; bytes: number; mime: string }>;
  }) => {
    if (!input?.batchId) throw new Error("Missing batch");
    return input;
  })
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.status) patch.status = data.status;
    if (data.kindCounts) patch.kind_counts = data.kindCounts;
    if (data.queuedFiles) patch.queued_files = data.queuedFiles;
    const res = await context.supabase
      .from("intake_batches")
      .update(patch)
      .eq("id", data.batchId)
      .eq("user_id", context.userId);
    if (res.error) throw new Error("We couldn't save your progress. Your files are still here.");
    return { ok: true };
  });

export const listOpenIntakeBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const res = await context.supabase
      .from("intake_batches")
      .select("id, status, kind_counts, queued_files, note, created_at, updated_at")
      .eq("user_id", context.userId)
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(5);
    if (res.error) return { batches: [] as IntakeBatch[] };
    return { batches: (res.data ?? []) as unknown as IntakeBatch[] };
  });
