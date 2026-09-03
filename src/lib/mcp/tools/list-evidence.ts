import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth } from "../supabase";

export default defineTool({
  name: "list_evidence",
  title: "List evidence",
  description:
    "List evidence items in the signed-in survivor's private vault. Returns title, description, date, file type, and any linked incident.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum items to return (default 25)."),
    linked_incident_id: z
      .string()
      .uuid()
      .optional()
      .describe("Only evidence linked to this incident."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, linked_incident_id }, ctx) => {
    const authError = requireAuth(ctx);
    if (authError) return authError;
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("evidence")
      .select("id,title,description,date,file_type,linked_incident_id,created_at")
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .limit(limit ?? 25);
    if (linked_incident_id) q = q.eq("linked_incident_id", linked_incident_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} evidence items.` }],
      structuredContent: { evidence: data ?? [] },
    };
  },
});
