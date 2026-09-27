import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SupportInboxRow = {
  id: string;
  name: string | null;
  reply_email: string;
  category: string;
  message: string;
  created_at: string;
  user_id: string | null;
};

/** Admin-only list of support requests, newest first. */
export const listSupportRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Not authorized.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("support_requests")
      .select("id,name,reply_email,category,message,created_at,user_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("We couldn't load support messages.");
    return { requests: (data ?? []) as SupportInboxRow[] };
  });
