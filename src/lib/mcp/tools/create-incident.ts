import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAssistantAccess, recordMcpCall } from "../supabase";

export default defineTool({
  name: "create_incident",
  title: "Log an incident",
  description:
    "Add a DRAFT incident to the signed-in survivor's private journal, from what she tells you. It is saved as AI-extracted and unconfirmed: she must review and confirm it in PatternProof before it counts as her record. Do not invent details, dates or times she did not give you.",
  inputSchema: {
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("Date the incident occurred (YYYY-MM-DD). Only a date she gave you."),
    description: z
      .string()
      .min(1)
      .max(5000)
      .describe("What happened, in the survivor's own words."),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional()
      .describe("Approximate time (HH:MM, 24h)."),
    location: z.string().max(300).optional().describe("Where it happened."),
    abuse_types: z
      .array(z.string().max(60))
      .max(10)
      .optional()
      .describe("Types of abuse (e.g. emotional, financial, coercive control)."),
    severity_level: z.number().int().min(1).max(5).optional().describe("1 (mild) to 5 (severe)."),
    witnesses: z.string().max(500).optional().describe("Anyone who saw or heard it."),
    emotional_impact: z.string().max(2000).optional().describe("How it affected the survivor."),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async (input, ctx) => {
    const authError = await requireAssistantAccess(ctx);
    if (authError) return authError;
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("incidents")
      .insert({
        user_id: ctx.getUserId()!,
        // Written by an outside assistant, not by her: say so, and leave it unconfirmed so the
        // app asks her to review it before it counts as her record.
        source: "ai_extracted",
        confirmed_at: null,
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
    if (error) return { content: [{ type: "text", text: "Could not save that entry." }], isError: true };
    await recordMcpCall(ctx, "create_incident", { incident_id: data.id });
    return {
      content: [
        {
          type: "text",
          text: `Saved a draft for ${data.date}. It is marked AI-extracted and unconfirmed, and the survivor needs to review and confirm it in PatternProof.`,
        },
      ],
      structuredContent: { incident: data },
    };
  },
});
