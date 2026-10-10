import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

export function supabaseForUser(ctx: ToolContext) {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function requireAuth(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) {
    return { content: [{ type: "text" as const, text: "Not authenticated." }], isError: true };
  }
  return null;
}

/** Rows the survivor marked "no AI" must never be handed to an outside assistant. */
export const AI_BLOCKED = "(none,denied)";

/**
 * Leave a trace the survivor can see: which tool an outside app used and how many
 * items it touched. Counts only, never content. Best effort: a logging problem must
 * never break the tool or hide an answer from the survivor.
 */
export async function recordMcpCall(
  ctx: ToolContext,
  tool: string,
  meta: Record<string, unknown> = {},
) {
  try {
    const userId = ctx.getUserId();
    if (!userId) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("record_audit_event", {
      p_user_id: userId,
      p_event_type: "mcp.tool_called",
      p_subject_kind: "mcp_tool",
      p_actor_kind: "ai",
      p_actor_id: userId,
      p_meta: { tool, ...meta } as Record<string, string | number | boolean | null>,
    });
  } catch {
    /* best effort */
  }
}

/**
 * Every tool starts here. Signed in is not enough: the survivor must have turned assistant
 * access on in Settings, and that is read fresh each call, so switching it off takes effect at
 * once. A problem reading the switch means off.
 */
export async function requireAssistantAccess(ctx: ToolContext) {
  const authError = requireAuth(ctx);
  if (authError) return authError;
  const userId = ctx.getUserId();
  if (!userId) {
    return { content: [{ type: "text" as const, text: "Not authenticated." }], isError: true };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { isAssistantAccessOn } = await import("@/lib/assistant-access.server");
  const on = await isAssistantAccessOn(
    supabaseAdmin as unknown as import("@/lib/assistant-access.server").AccessAdmin,
    userId,
  );
  if (!on) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Assistant access is turned off in PatternProof. The survivor can turn it on in Settings.",
        },
      ],
      isError: true,
    };
  }
  return null;
}
