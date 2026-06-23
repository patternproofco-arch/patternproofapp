import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ---------- attorney → survivor invites ---------- */

export const createSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      survivor_email: z.string().email().max(255),
      survivor_name: z.string().trim().max(120).optional().nullable(),
      personal_note: z.string().trim().max(2000).optional().nullable(),
      expires_days: z.number().int().min(1).max(365).default(30),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expires = new Date(Date.now() + data.expires_days * 86400000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("attorney_survivor_invites")
      .insert({
        attorney_user_id: context.userId,
        survivor_email: data.survivor_email.toLowerCase(),
        survivor_name: data.survivor_name ?? null,
        personal_note: data.personal_note ?? null,
        expires_at: expires,
      })
      .select("id,invite_token,expires_at,survivor_email,status,created_at")
      .single();
    if (error) throw new Error(error.message);
    return { invite: row };
  });

export const listSurvivorInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("attorney_survivor_invites")
      .select("id,survivor_email,survivor_name,personal_note,invite_token,status,expires_at,accepted_at,created_at")
      .eq("attorney_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const now = Date.now();
    const invites = (data ?? []).map((i) => ({
      ...i,
      effective_status:
        i.status === "pending" && i.expires_at && new Date(i.expires_at).getTime() < now
          ? ("expired" as const)
          : (i.status as "pending" | "accepted" | "revoked" | "expired"),
    }));
    return { invites };
  });

export const revokeSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("attorney_survivor_invites")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("attorney_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resendSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      expires_days: z.number().int().min(1).max(365).default(30),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expires = new Date(Date.now() + data.expires_days * 86400000).toISOString();
    const { error } = await supabaseAdmin
      .from("attorney_survivor_invites")
      .update({ status: "pending", expires_at: expires })
      .eq("id", data.id)
      .eq("attorney_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });