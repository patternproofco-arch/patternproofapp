import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

export function supabaseForUser(_ctx: ToolContext): SupabaseClient<Database> {
  // Keep direct helper callers closed as well as the registered tools.
  assertExternalAppsReleased();
}

export function requireAuth(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) {
    return { content: [{ type: "text" as const, text: "Not authenticated." }], isError: true };
  }
  return { content: [{ type: "text" as const, text: EXTERNAL_APPS_PAUSED }], isError: true };
}

export const EXTERNAL_APPS_PAUSED =
  "External app access is paused while access and revocation controls are reviewed.";

function assertExternalAppsReleased(): never {
  // Intentionally no environment override before live consent, token and RLS review.
  throw new Error(EXTERNAL_APPS_PAUSED);
}
