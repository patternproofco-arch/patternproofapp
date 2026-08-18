import type { SupabaseClient } from "@supabase/supabase-js";

// -----------------------------------------------------------------------------
// Per-user AI processing log. Records that a run happened and how it ended —
// never the content that was sent or returned. Used to show the survivor what
// the AI has touched and to debug failures without reading their records.
// -----------------------------------------------------------------------------

export interface AiUsageEntry {
  feature: string;
  model?: string | null;
  fileType?: string | null;
  evidenceId?: string | null;
  threadId?: string | null;
  status?: "ok" | "failed" | "empty" | "skipped";
  httpStatus?: number | null;
  durationMs?: number | null;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  meta?: Record<string, unknown>;
}

/** Best-effort: logging must never break the feature it is observing. */
export async function logAiUsage(
  supabase: SupabaseClient<never>,
  userId: string,
  entry: AiUsageEntry,
): Promise<void> {
  try {
    await (supabase as unknown as SupabaseClient).from("ai_usage_log").insert({
      user_id: userId,
      feature: entry.feature,
      model: entry.model ?? null,
      file_type: entry.fileType ?? null,
      evidence_id: entry.evidenceId ?? null,
      thread_id: entry.threadId ?? null,
      status: entry.status ?? "ok",
      http_status: entry.httpStatus ?? null,
      duration_ms: entry.durationMs ?? null,
      prompt_tokens: entry.usage?.prompt_tokens ?? null,
      completion_tokens: entry.usage?.completion_tokens ?? null,
      total_tokens: entry.usage?.total_tokens ?? null,
      meta: entry.meta ?? {},
    });
  } catch {
    /* observability only */
  }
}