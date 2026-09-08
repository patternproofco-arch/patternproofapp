import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyAccessAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("audit_events")
      .select("id,event_type,actor_kind,created_at,meta,subject_kind")
      .eq("user_id", context.userId)
      .in("event_type", [
        "case.viewed_by_professional",
        "evidence.downloaded_by_professional",
        "packet.downloaded_by_survivor",
        "advocate_access_granted",
        "advocate_access_revoked",
        "org_admin.viewed_assignment_metadata",
        "export.attorney_packet",
      ])
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      return { events: [] as Array<{ id: string; event_type: string; actor_kind: string | null; created_at: string }> };
    }
    return { events: data ?? [] };
  });
