import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { drainEmailQueues } from "@/lib/email-queue-drain.server";

/**
 * Cloudflare Cron Trigger entry point — the retry backstop the queue never
 * had. Every send already tries to drain synchronously right after enqueue
 * (email-queue-drain.server.ts), but that's a single best-effort attempt: if
 * it fails (a transient network error, a worker recycled mid-request), the
 * message just sits in the pgmq queue until something reads it again.
 * `process.ts` exposes the same drain over HTTP for a manual nudge, but
 * nothing was calling it automatically. This runs on a schedule instead.
 *
 * A scheduled Worker invocation never goes through `fetch`, so it doesn't
 * get the `process.env` population the request path relies on — bindings
 * only arrive via the `env` argument Cloudflare passes to `scheduled()`.
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
