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

    // Org partners are advocates who own at least one referral code — they
    // belong in /org-portal, not the survivor app and not the advocate caseload.
    let is_org_partner = false;
    if (roles.includes("advocate")) {
      const { count } = await supabaseAdmin
        .from("referral_links")
        .select("code", { count: "exact", head: true })
        .eq("org_user_id", context.userId);
      is_org_partner = (count ?? 0) > 0;
    }

    if (roles.length > 0) {
      return { roles, is_survivor: roles.includes("survivor"), is_org_partner, created: false };
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "survivor" }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { roles: ["survivor"], is_survivor: true, is_org_partner: false, created: true };
  });
