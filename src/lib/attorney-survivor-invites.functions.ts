import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ---------- attorney → survivor invites ---------- */

export const createSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        survivor_email: z.string().email().max(255),
        survivor_name: z.string().trim().max(120).optional().nullable(),
        personal_note: z.string().trim().max(2000).optional().nullable(),
        expires_days: z.number().int().min(1).max(365).default(30),
      })
      .parse(input),
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
