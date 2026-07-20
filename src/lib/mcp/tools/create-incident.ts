import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth } from "../supabase";

export default defineTool({
  name: "create_incident",
  title: "Log an incident",
  description:
    "Document a new incident in the signed-in survivor's private journal. Use this to help the user log what happened.",
  inputSchema: {
    date: z.string().describe("Date the incident occurred (YYYY-MM-DD)."),
    description: z.string().min(1).describe("What happened, in the survivor's words."),
    time: z.string().optional().describe("Approximate time (HH:MM, 24h)."),
    location: z.string().optional().describe("Where it happened."),
    abuse_types: z.array(z.string()).optional().describe("Types of abuse (e.g. emotional, financial, coercive control)."),
    severity_level: z.number().int().min(1).max(5).optional().describe("1 (mild) to 5 (severe)."),
    witnesses: z.string().optional().describe("Anyone who saw or heard it."),
    emotional_impact: z.string().optional().describe("How it affected the survivor."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const authError = requireAuth(ctx);
    if (authError) return authError;
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("incidents")
      .insert({
        user_id: ctx.getUserId()!,
        date: input.date,
        description: input.description,
        time: input.time ?? null,
        location: input.location ?? null,
        abuse_types: input.abuse_types ?? [],
        severity_level: input.severity_level ?? null,
        witnesses: input.witnesses ?? null,
        emotional_impact: input.emotional_impact ?? null,
      })
      .select("id,date,description")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Logged incident on ${data.date}.` }],
      structuredContent: { incident: data },
    };
  },
});