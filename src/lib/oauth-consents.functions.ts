import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ConsentRow {
  id: string;
  client_id: string;
  client_name: string | null;
  client_uri: string | null;
  scopes: string | null;
  granted_at: string;
}

/** Lists the outside apps this signed-in person has allowed. */
export const listMyOauthConsents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("admin_list_oauth_consents", {
      p_user_id: context.userId,
    });
    if (error) throw new Error("We couldn't load your connected apps. Try again in a moment.");
    return (data ?? []) as ConsentRow[];
  });

/** Turns off one connected app for this signed-in person. */
export const revokeMyOauthConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ consentId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok, error } = await supabaseAdmin.rpc("admin_revoke_oauth_consent", {
      p_user_id: context.userId,
      _consent_id: data.consentId,
    });
    if (error) throw new Error("We couldn't turn off that connection. Try again in a moment.");
    return { revoked: ok === true };
  });
