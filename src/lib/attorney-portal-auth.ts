import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertApprovedAttorney } from "@/lib/attorney-approval.server";

/**
 * Strict gate for attorney-side server functions that read survivor or shared
 * data through the service role. Any caller holding the attorney role must have
 * an approved attorney_access_applications row — the admin role does NOT bypass
 * this (it only bypasses the account-level gate in requireSupabaseAuth).
 * Callers without the attorney role (e.g. case collaborators) fall through to
 * each function's own link/grant checks, unchanged.
 */
export async function assertAttorneyRoleApproved(db: any, userId: string) {
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (error || !data) throw new Error("Could not verify account access.");
  if (data.some((r: { role: string }) => r.role === "attorney")) {
    await assertApprovedAttorney(db, userId);
  }
}

export const requireAttorneyPortalAuth = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ context, next }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAttorneyRoleApproved(supabaseAdmin, context.userId);
    return next();
  });
