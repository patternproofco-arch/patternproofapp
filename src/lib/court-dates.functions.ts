import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  court_name: z.string().trim().min(1).max(120),
  hearing_type: z.string().trim().min(1).max(80),
  hearing_at: z.string().min(1), // ISO string
  location: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const listCourtDates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("court_dates")
      .select("id, court_name, hearing_type, hearing_at, location, notes")
      .eq("user_id", context.userId)
      .order("hearing_at", { ascending: true });
    if (error) throw error;
    return { dates: data ?? [] };
  });

export const upcomingCourtDates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("court_dates")
      .select("id, court_name, hearing_type, hearing_at, location")
      .eq("user_id", context.userId)
      .gte("hearing_at", new Date().toISOString())
      .order("hearing_at", { ascending: true })
      .limit(3);
    if (error) throw error;
    return { dates: data ?? [] };
  });

export const upsertCourtDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      court_name: data.court_name,
      hearing_type: data.hearing_type,
      hearing_at: data.hearing_at,
      location: data.location ?? null,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("court_dates")
        .update(row)
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("court_dates")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: inserted.id };
  });

export const deleteCourtDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("court_dates")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });