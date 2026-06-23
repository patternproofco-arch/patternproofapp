import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getTrustPanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({}).parse(input ?? {}))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [linksRes, invitesRes, auditRes] = await Promise.all([
      supabaseAdmin
        .from("attorney_client_links")
        .select("id,client_user_id,status,created_at,revoked_at,include_all_incidents,include_all_evidence,include_patterns")
        .eq("attorney_user_id", context.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("attorney_survivor_invites")
        .select("id,survivor_email,status,created_at,accepted_at,expires_at")
        .eq("attorney_user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(25),
      supabaseAdmin
        .from("audit_log")
        .select("id,action_type,record_reference,timestamp_utc")
        .eq("user_id", context.userId)
        .order("timestamp_utc", { ascending: false })
        .limit(50),
    ]);

    return {
      links: linksRes.data ?? [],
      invites: invitesRes.data ?? [],
      audit: auditRes.data ?? [],
    };
  });