import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_PERMISSIONS, DEFAULT_AI_PERMISSION } from "@/lib/ai-permissions";

const precision = z.enum([
  "exact",
  "approximate_month",
  "range",
  "before_anchor",
  "after_anchor",
  "unknown",
]);

const captureSchema = z.object({
  id: z.string().uuid().optional(),
  record_kind: z.enum(["event", "expected"]).default("event"),
  description: z.string().max(20000).optional(),
  /* Dating stays exactly as uncertain as the survivor said it was. */
  date: z.string().optional().nullable(),
  date_precision: precision.default("unknown"),
  date_range_start: z.string().optional().nullable(),
  date_range_end: z.string().optional().nullable(),
  anchor_label: z.string().max(300).optional().nullable(),
  source_type: z.string().max(40).optional().nullable(),
  practical_consequence: z.string().max(2000).optional().nullable(),
  template_key: z.string().max(60).optional().nullable(),
  /* Expected-vs-actual */
  expected_item: z.string().max(2000).optional().nullable(),
  expected_due_date: z.string().optional().nullable(),
  expected_due_range_start: z.string().optional().nullable(),
  expected_due_range_end: z.string().optional().nullable(),
  actual_outcome: z.string().max(20000).optional().nullable(),
  actual_outcome_date: z.string().optional().nullable(),
  expectation_status: z
    .enum(["open", "fulfilled", "partially_fulfilled", "not_fulfilled", "unknown"])
    .default("open"),
  witnesses: z.string().max(2000).optional().nullable(),
  is_draft: z.boolean().default(false),
  is_sealed: z.boolean().default(false),
  ai_permission: z.enum(AI_PERMISSIONS).default(DEFAULT_AI_PERMISSION),
});

export type QuickCaptureInput = z.input<typeof captureSchema>;

const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
const dateOrNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/**
 * Save now, organize later.
 *
 * Nothing here is required except that the record exists. No category, no
 * exact time, no polished description, no narrative. An empty date stays
 * empty — we never manufacture one.
 */
export const saveQuickCapture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => captureSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const row = {
      user_id: userId,
      record_kind: data.record_kind,
      description: blank(data.description) ?? "",
      date: data.date_precision === "exact" ? dateOrNull(data.date) : dateOrNull(data.date),
      date_precision: data.date_precision,
      date_range_start: data.date_precision === "range" ? dateOrNull(data.date_range_start) : null,
      date_range_end: data.date_precision === "range" ? dateOrNull(data.date_range_end) : null,
      anchor_label: blank(data.anchor_label),
      source: "survivor",
      source_type: blank(data.source_type),
      practical_consequence: blank(data.practical_consequence),
      template_key: blank(data.template_key),
      expected_item: blank(data.expected_item),
      expected_due_date: dateOrNull(data.expected_due_date),
      expected_due_range_start: dateOrNull(data.expected_due_range_start),
      expected_due_range_end: dateOrNull(data.expected_due_range_end),
      actual_outcome: blank(data.actual_outcome),
      actual_outcome_date: dateOrNull(data.actual_outcome_date),
      expectation_status: data.expectation_status,
      witnesses: blank(data.witnesses),
      is_draft: data.is_draft,
      is_sealed: data.is_sealed,
      sealed_at: data.is_sealed ? new Date().toISOString() : null,
      ai_permission: data.ai_permission,
    };

    if (data.id) {
      const { data: updated, error } = await supabase
        .from("incidents")
        .update(row)
        .eq("id", data.id)
        .eq("user_id", userId)
        .select("id")
        .single();
      if (error) throw new Error("We couldn't save that. Try again in a moment.");
      return { id: updated.id as string };
    }

    const { data: inserted, error } = await supabase
      .from("incidents")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error("We couldn't save that. Try again in a moment.");
    return { id: inserted.id as string };
  });

/** Drafts the survivor left open, newest first. Nothing is auto-published. */
export const listOpenDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("incidents")
      .select("id,description,date,date_precision,record_kind,expected_item,created_at")
      .eq("user_id", userId)
      .eq("is_draft", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return [];
    return data ?? [];
  });

const permissionSchema = z.object({
  table: z.enum(["incidents", "evidence"]),
  id: z.string().uuid(),
  ai_permission: z.enum(AI_PERMISSIONS).optional(),
  is_sealed: z.boolean().optional(),
});

/**
 * Sealing and per-item AI permission, enforced server-side against the row's
 * owner. The UI mirrors this; it is not the thing that enforces it.
 */
export const setItemProcessing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => permissionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.ai_permission && typeof data.is_sealed !== "boolean") return { ok: true };

    const patch = {
      ...(data.ai_permission ? { ai_permission: data.ai_permission } : {}),
      ...(typeof data.is_sealed === "boolean"
        ? { is_sealed: data.is_sealed, sealed_at: data.is_sealed ? new Date().toISOString() : null }
        : {}),
    };

    const { error } =
      data.table === "incidents"
        ? await supabase.from("incidents").update(patch).eq("id", data.id).eq("user_id", userId)
        : await supabase.from("evidence").update(patch).eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error("We couldn't change that setting. Try again in a moment.");
    return { ok: true };
  });
