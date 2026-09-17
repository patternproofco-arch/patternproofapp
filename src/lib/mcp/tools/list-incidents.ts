import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth } from "../supabase";

export default defineTool({
  name: "list_incidents",
  title: "List incidents",
  description:
    "List the signed-in survivor's documented incidents, most recent first. Returns date, description, location, abuse types, and severity.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum incidents to return (default 25)."),
    since: z
      .string()
      .optional()
      .describe("Optional ISO date (YYYY-MM-DD). Only incidents on or after this date."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, since }, ctx) => {
    const authError = requireAuth(ctx);
    if (authError) return authError;
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("incidents")
      .select(
        "id,date,time,location,description,abuse_types,severity_level,witnesses,emotional_impact,has_escalation_flag",
      )
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .limit(limit ?? 25);
    if (since) q = q.gte("date", since);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} incidents.` }],
      structuredContent: { incidents: data ?? [] },
    };
  },
});
