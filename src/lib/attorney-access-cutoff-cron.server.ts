import { createClient } from "@supabase/supabase-js";
import { runAttorneyAccessCutoffSweep } from "@/lib/attorney-access-cutoff.server";

/**
 * Cloudflare Cron Trigger entry for the attorney access cutoff sweep.
 * Scheduled invocations do not populate process.env — bindings arrive via env.
 */
export async function runAttorneyAccessCutoffCron(
  env: Record<string, string | undefined>,
): Promise<void> {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    const missing = [
      !supabaseUrl && "SUPABASE_URL",
      !supabaseServiceKey && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean);
    console.error(
      `[attorney-access-cutoff-cron] Missing required environment variables: ${missing.join(", ")}`,
    );
    return;
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const result = await runAttorneyAccessCutoffSweep(admin);
    console.log("[attorney-access-cutoff-cron] sweep result", result);
  } catch (error) {
    console.error("[attorney-access-cutoff-cron] sweep failed", error);
  }
}
