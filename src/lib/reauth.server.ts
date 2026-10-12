/**
 * Proof that it is really her at the screen: her password, or a very recent sign-in when she has
 * no password. Same rule as the assistant-access screens (kept separate so that file is untouched).
 */
import type { EnableCheck } from "@/lib/assistant-access.server";

export async function reauthCheckFor(userId: string): Promise<EnableCheck> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  const user = data?.user as
    | { email?: string; last_sign_in_at?: string; identities?: Array<{ provider?: string }> }
    | null
    | undefined;
  if (error || !user) throw new Error("We couldn't check your account. Try again in a moment.");
  const email = user.email ?? "";
  const hasPassword = !!email && (user.identities ?? []).some((i) => i.provider === "email");
  return {
    hasPassword,
    lastSignInAt: user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : null,
    checkPassword: async (password: string) => {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw new Error("Server misconfigured.");
      const { createClient } = await import("@supabase/supabase-js");
      const c = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      });
      const { error: e } = await c.auth.signInWithPassword({ email, password });
      return !e;
    },
  };
}

/** Resolve true only when the check passes right now. */
export async function reauthPasses(check: EnableCheck, password: string | undefined, now = Date.now()): Promise<boolean> {
  const { RECENT_SIGN_IN_MS } = await import("@/lib/assistant-access.server");
  if (check.hasPassword) return !!password && (await check.checkPassword(password));
  return check.lastSignInAt !== null && now - check.lastSignInAt <= RECENT_SIGN_IN_MS;
}
