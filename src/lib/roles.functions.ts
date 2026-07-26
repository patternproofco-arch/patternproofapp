import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Persist "survivor" as a real role row rather than leaving it as an implicit
 * code fallback. Idempotent, and deliberately non-destructive: if the account
 * already holds any role (attorney, admin), we leave it completely alone.
 */
export const ensureSurvivorRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (existing && existing.length > 0) {
      return { role: existing[0].role, created: false };
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "survivor" }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { role: "survivor" as const, created: true };
  });
