import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth } from "../supabase";

export default defineTool({
  name: "search_case",
  title: "Search the case",
  description:
    "Search the signed-in survivor's incidents, evidence, and voice notes for a keyword or phrase.",
  inputSchema: {
    query: z.string().min(1).max(200).describe("Text to search for."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query }, ctx) => {
    const authError = requireAuth(ctx);
    if (authError) return authError;
    const sb = supabaseForUser(ctx);
    // Escape SQL LIKE metacharacters first, then wrap in double quotes for
    // PostgREST's own or() filter grammar — comma/dot/paren in an unquoted
    // value would otherwise be parsed as filter syntax (extra OR-conditions,
    // etc.), not literal search text. Backslash/quote are escaped for the
    // quoting layer itself. RLS still scopes every query to the caller's own
    // rows regardless, but this keeps the query semantics honest.
    const like = `%${query.replace(/[%_]/g, (m) => "\\" + m)}%`;
    const orValue = `"${like.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    const [inc, ev, vn] = await Promise.all([
      sb.from("incidents")
        .select("id,date,description,location")
        .is("deleted_at", null)
        .or(`description.ilike.${orValue},location.ilike.${orValue},witnesses.ilike.${orValue},emotional_impact.ilike.${orValue}`)
        .order("date", { ascending: false })
        .limit(20),
      sb.from("evidence")
        .select("id,title,date,description,file_type")
        .is("deleted_at", null)
        .or(`title.ilike.${orValue},description.ilike.${orValue}`)
        .order("date", { ascending: false })
        .limit(20),
      sb.from("voice_notes")
        .select("id,title,date")
        .ilike("title", like)
        .order("date", { ascending: false })
        .limit(10),
    ]);
    const results = {
      incidents: inc.data ?? [],
      evidence: ev.data ?? [],
      voice_notes: vn.data ?? [],
    };
    const total = results.incidents.length + results.evidence.length + results.voice_notes.length;
    return {
      content: [{ type: "text", text: `Found ${total} matches for "${query}".` }],
      structuredContent: results,
    };
  },
});