/**
 * Minimal study_profiles + user_lesson_progress CRUD.
 * Never accepts county, practice answers, child names/DOBs, docket, or judge fields.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STUDY_MODULES } from "./modules-content";

const hearingTypeSchema = z.enum([
  "protective_order",
  "custody",
  "divorce",
  "support",
  "other_family",
]);
const bracketSchema = z.enum(["under_5", "5_to_11", "12_plus"]);
const orderStatusSchema = z.enum(["none", "temporary_order", "decree_in_place"]);
const learningModeSchema = z.enum(["coach", "guide", "both"]);

const moduleIdSchema = z
  .string()
  .min(1)
  .max(80)
  .refine((id) => STUDY_MODULES.some((m) => m.id === id), "Unknown module");

/** Reject any attempt to smuggle never-collected keys through a loose object. */
const FORBIDDEN_KEYS = [
  "county",
  "court_name",
  "court_branch",
  "address",
  "confidential_address",
  "acp_status",
  "case_number",
  "docket_number",
  "judge_name",
  "department_name",
  "child_name",
  "child_names",
  "children_names",
  "child_dob",
  "child_birthdate",
  "practice_answer",
  "practice_answers",
  "coach_transcript",
  "mock_testimony",
] as const;

function assertNoForbiddenKeys(input: unknown): void {
  if (!input || typeof input !== "object") return;
  for (const key of Object.keys(input as object)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_KEYS.some((f) => lower === f || lower.includes(f))) {
      throw new Error("That field is not collected in court-prep.");
    }
  }
}

const upsertProfileSchema = z.object({
  state: z
    .string()
    .trim()
    .length(2)
    .regex(/^[A-Za-z]{2}$/)
    .optional()
    .nullable(),
  hearing_types: z.array(hearingTypeSchema).max(5).default([]),
  hearing_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date only (YYYY-MM-DD)")
    .optional()
    .nullable(),
  order_status: orderStatusSchema.optional().nullable(),
  learning_mode: learningModeSchema.default("both"),
  children_brackets: z.array(bracketSchema).max(3).default([]),
});

export type StudyProfile = {
  user_id: string;
  state: string | null;
  hearing_types: string[];
  hearing_date: string | null;
  order_status: string | null;
  learning_mode: string;
  children_brackets: string[];
  updated_at?: string;
};

export type LessonProgress = {
  module_id: string;
  status: "in_progress" | "completed";
  completed_at: string | null;
};

export const getStudyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data, error } = await db
      .from("study_profiles")
      .select(
        "user_id, state, hearing_types, hearing_date, order_status, learning_mode, children_brackets, updated_at",
      )
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;

    const { data: progress, error: pErr } = await db
      .from("user_lesson_progress")
      .select("module_id, status, completed_at")
      .eq("user_id", context.userId);
    if (pErr) throw pErr;

    return {
      profile: (data as StudyProfile | null) ?? null,
      progress: (progress as LessonProgress[] | null) ?? [],
    };
  });

export const upsertStudyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    assertNoForbiddenKeys(input);
    return upsertProfileSchema.parse(input);
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const row = {
      user_id: context.userId,
      state: data.state ? data.state.toUpperCase() : null,
      hearing_types: data.hearing_types,
      hearing_date: data.hearing_date || null,
      order_status: data.order_status ?? null,
      learning_mode: data.learning_mode,
      children_brackets: data.children_brackets,
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from("study_profiles").upsert(row, { onConflict: "user_id" });
    if (error) throw error;
    return { ok: true as const };
  });

export const markLessonProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    assertNoForbiddenKeys(input);
    return z
      .object({
        module_id: moduleIdSchema,
        status: z.enum(["in_progress", "completed"]),
      })
      .parse(input);
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const completed_at = data.status === "completed" ? new Date().toISOString() : null;
    const { error } = await db.from("user_lesson_progress").upsert(
      {
        user_id: context.userId,
        module_id: data.module_id,
        status: data.status,
        completed_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,module_id" },
    );
    if (error) throw error;
    // Soft claim: only binary progress is stored. No practice text column exists.
    return { ok: true as const, stored: { module_id: data.module_id, status: data.status } };
  });
