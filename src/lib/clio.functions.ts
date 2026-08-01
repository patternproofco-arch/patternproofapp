import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startClioConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildClioAuthorizeUrl } = await import("@/lib/clio.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const state = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabaseAdmin
      .from("clio_oauth_states")
      .insert({ state, user_id: context.userId, redirect_to: "/billing" });
    if (error) throw new Error("We couldn't start the Clio connection. Try again in a moment.");
    return { url: buildClioAuthorizeUrl(state) };
  });

export const getClioStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("clio_connections")
      .select("firm_name, clio_user_email, created_at, expires_at")
      .eq("user_id", context.userId)
      .is("revoked_at", null)
      .maybeSingle();
    if (!data) return { connected: false as const };
    return {
      connected: true as const,
      firmName: data.firm_name,
      email: data.clio_user_email,
      connectedAt: data.created_at,
    };
  });

export const disconnectClio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("clio_connections")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error("We couldn't disconnect Clio. Try again in a moment.");
    return { ok: true };
  });
