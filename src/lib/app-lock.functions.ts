import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side memory of "this account has a screen lock turned on".
 *
 * The PIN hash and biometric credential live on the device, which means
 * clearing site data used to remove the lock silently. Keeping a single
 * boolean on the server lets the app notice that mismatch and ask her to sign
 * in again instead of quietly opening.
 */
export const getAppLockState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_security_settings")
      .select("app_lock_enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { app_lock_enabled: !!data?.app_lock_enabled };
  });

export const setAppLockEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enabled: boolean }) => ({ enabled: !!input.enabled }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_security_settings")
      .upsert(
        { user_id: context.userId, app_lock_enabled: data.enabled, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) return { ok: false as const };
    return { ok: true as const };
  });
