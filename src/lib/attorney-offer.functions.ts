import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAttorneyOffer = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readOfferSettings } = await import("./attorney-offer.server");
    const settings = await readOfferSettings(supabaseAdmin);
    return {
      enabled: settings.enabled,
      nurtureEnabled: settings.nurture_enabled && !!process.env.MARKETING_POSTAL_ADDRESS,
    };
  } catch {
    return { enabled: false, nurtureEnabled: false };
  }
});

/** Request review only. This must never set approved_at or confer professional verification. */
export const requestAttorneyOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: auth, error: authError } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (authError || !auth.user?.email_confirmed_at)
      throw new Error("Confirm your email before requesting attorney access.");
    const { readOfferSettings } = await import("./attorney-offer.server");
    if (!(await readOfferSettings(supabaseAdmin)).enabled) return { requested: false };
    const { error } = await (supabaseAdmin as any)
      .from("attorney_conversion_accounts")
      .upsert({ user_id: context.userId }, { onConflict: "user_id", ignoreDuplicates: true });
    if (error) throw new Error("We couldn't save your access request. Please try again.");
    // Role identifies the requested workspace, not verification or data access.
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "attorney" }, { onConflict: "user_id,role" });
    if (roleError) throw new Error("We couldn't prepare your attorney profile.");
    return { requested: true };
  });
