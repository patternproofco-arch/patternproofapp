import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ActivityWindow {
  label: string;
  signups: number;
  confirmed: number;
  signins: number;
  abandoned: number;
}

export interface SigninActivity {
  total: number;
  windows: ActivityWindow[];
  generatedAt: string;
}

/** Admin-only counts of sign-ups, sign-ins, and unfinished sign-ups. No emails or content returned. */
export const getSigninActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SigninActivity> => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Not authorized.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const users: { created_at: string; email_confirmed_at?: string | null; last_sign_in_at?: string | null }[] = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("We couldn't load activity.");
      users.push(...data.users);
      if (data.users.length < 1000) break;
    }
    const now = Date.now();
    const day = 86_400_000;
    const windows = [
      { label: "Last 24 hours", ms: day },
      { label: "Last 7 days", ms: 7 * day },
      { label: "Last 30 days", ms: 30 * day },
      { label: "All time", ms: Infinity },
    ].map(({ label, ms }) => {
      const since = (d?: string | null) => !!d && now - new Date(d).getTime() <= ms;
      const joined = users.filter((u) => since(u.created_at));
      return {
        label,
        signups: joined.length,
        confirmed: joined.filter((u) => u.email_confirmed_at).length,
        signins: users.filter((u) => since(u.last_sign_in_at)).length,
        abandoned: joined.filter((u) => !u.email_confirmed_at || !u.last_sign_in_at).length,
      };
    });
    return { total: users.length, windows, generatedAt: new Date().toISOString() };
  });
