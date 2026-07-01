import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Manual attorney time / billable-hour entries per case.
 * Access model: any user with case access (owner, firm grantee, or active
 * collaborator) can log their own entries; the case owner sees all entries
 * on the case. Enforced by RLS + the assertion below.
 */

async function assertLinkAccess(userId: string, clientId: string): Promise<{ linkId: string; isOwner: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: owner } = await supabaseAdmin
    .from("attorney_client_links")
    .select("id")
    .eq("attorney_user_id", userId)
    .eq("client_user_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (owner) return { linkId: owner.id, isOwner: true };

  const [{ data: collabs }, { data: grants }] = await Promise.all([
    supabaseAdmin.from("case_collaborators").select("link_id").eq("collaborator_user_id", userId).eq("status", "active"),
    supabaseAdmin.from("case_grants").select("client_link_id").eq("attorney_user_id", userId).is("revoked_at", null),
  ]);
  const ids = [
    ...(collabs ?? []).map((r) => r.link_id),
    ...(grants ?? []).map((r) => r.client_link_id),
  ];
  if (!ids.length) throw new Error("No active access");
  const { data: link } = await supabaseAdmin
    .from("attorney_client_links")
    .select("id")
    .in("id", ids)
    .eq("client_user_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (!link) throw new Error("No active access");
  return { linkId: link.id, isOwner: false };
}

export const listTimeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { linkId, isOwner } = await assertLinkAccess(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Owners see everything on the case; contributors see only their own entries.
    let q = supabaseAdmin
      .from("time_entries")
      .select("id,case_link_id,attorney_user_id,description,minutes,billable,entry_date,created_at,updated_at")
      .eq("case_link_id", linkId);
    if (!isOwner) q = q.eq("attorney_user_id", context.userId);
    const { data: rows, error } = await q.order("entry_date", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const entries = rows ?? [];
    const total_minutes = entries.reduce((s, r) => s + (r.minutes ?? 0), 0);
    const billable_minutes = entries.filter((r) => r.billable).reduce((s, r) => s + (r.minutes ?? 0), 0);
    return { entries, total_minutes, billable_minutes, is_owner: isOwner, link_id: linkId };
  });

export const createTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      clientId: z.string().uuid(),
      description: z.string().trim().min(1).max(500),
      minutes: z.number().int().min(1).max(24 * 60),
      billable: z.boolean(),
      entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { linkId } = await assertLinkAccess(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("time_entries")
      .insert({
        case_link_id: linkId,
        attorney_user_id: context.userId,
        description: data.description,
        minutes: data.minutes,
        billable: data.billable,
        entry_date: data.entry_date,
      })
      .select("id,case_link_id,attorney_user_id,description,minutes,billable,entry_date,created_at,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { entry: row };
  });

export const updateTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      description: z.string().trim().min(1).max(500).optional(),
      minutes: z.number().int().min(1).max(24 * 60).optional(),
      billable: z.boolean().optional(),
      entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      description?: string;
      minutes?: number;
      billable?: boolean;
      entry_date?: string;
    } = {};
    if (data.description !== undefined) patch.description = data.description;
    if (data.minutes !== undefined) patch.minutes = data.minutes;
    if (data.billable !== undefined) patch.billable = data.billable;
    if (data.entry_date !== undefined) patch.entry_date = data.entry_date;
    const { error } = await supabaseAdmin
      .from("time_entries")
      .update(patch)
      .eq("id", data.id)
      .eq("attorney_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("time_entries")
      .delete()
      .eq("id", data.id)
      .eq("attorney_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });