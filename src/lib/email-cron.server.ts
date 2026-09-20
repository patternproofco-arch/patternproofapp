import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { drainEmailQueues } from "@/lib/email-queue-drain.server";

/**
 * Cloudflare Cron Trigger entry for the email-queue retry backstop.
 * Bindings arrive via `env` (scheduled invocations do not populate process.env).
 */
export async function runEmailQueueCron(env: Record<string, string | undefined>): Promise<void> {
  const apiKey = env.LOVABLE_API_KEY;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
    const missing = [
      !apiKey && "LOVABLE_API_KEY",
      !supabaseUrl && "SUPABASE_URL",
      !supabaseServiceKey && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean);
    console.error(`[email-cron] Missing required environment variables: ${missing.join(", ")}`);
    return;
  }

  const supabase: SupabaseClient<any, any> = createClient(supabaseUrl, supabaseServiceKey);
  try {
    const result = await drainEmailQueues(supabase, apiKey, env.LOVABLE_SEND_URL);
    if (result.processed > 0 || result.stopped) {
      console.log("[email-cron] drain result", result);
    }
  } catch (error) {
    console.error("[email-cron] drain failed", error);
  }
}
