import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getEmailSiteOrigin } from "@/lib/email/site-origin.server";
import { passwordRecoveryRedirectTo } from "@/lib/password-recovery-redirect";

async function requireAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Not authorized.");
  return supabaseAdmin;
}

/**
 * Admin-only: send the same recovery email the user would get from
 * /forgot-password. Never generates or emails a temporary password.
 */
export const adminSendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ email: z.string().email().max(255) }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const email = data.email.trim().toLowerCase();
    const redirectTo = passwordRecoveryRedirectTo(getEmailSiteOrigin());
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
