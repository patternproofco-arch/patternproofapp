import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Persist "survivor" as a real role row rather than leaving it as an implicit
 * code fallback.
 *
 * Idempotent and deliberately non-destructive. If the account already holds any
 * role we leave it alone — in particular we never add a survivor row to an
 * attorney-only account, because that's what lets the app tell the two apart.
 * Accounts that legitimately hold both roles keep both.
 */
export const ensureSurvivorRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    const roles = (existing ?? []).map((r) => String(r.role));
    if (roles.length > 0) {
      return { roles, is_survivor: roles.includes("survivor"), created: false };
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "survivor" }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { roles: ["survivor"], is_survivor: true, created: true };
  });
