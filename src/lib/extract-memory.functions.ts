import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `You are an extraction assistant for a domestic-abuse documentation app. The user is recalling a past incident from memory. Convert their free-text memory into a single structured incident record. Return JSON only — no markdown, no preamble.

Schema (use null when unsure):
{
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM (24h) or null",
  "location": "string or null",
  "description": "Calm, factual first-person description of what happened, 1-4 sentences, in the user's voice. No legal jargon, no interpretation.",
  "abuse_types": ["physical"|"emotional"|"financial"|"coercive"|"custody"|"other"],
  "witnesses": "string or null",
  "emotional_impact": "string or null",
  "clarifying_question": "string or null — one short, gentle question to help pin down the date or a key fact if it's missing or vague. null if you have enough."
}

Rules:
- The user's memory may be vague (e.g. "sometime last summer"). If the date is fuzzy but a year/month is implied, pick the most likely first-of-month date and ask a clarifying question.
- If the user gives an absolute date, use it. Constrain dates to the relationship window provided.
- Never invent facts. abuse_types must reflect only what's described.
- Keep the description in the user's voice, calm and factual.`;

export const extractMemoryAsIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      memory: z.string().min(1).max(4000),
      relationshipStart: z.string().max(20).optional(),
      relationshipEnd: z.string().max(20).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, reason: "missing-key" };
    const ctx = `Relationship window: ${data.relationshipStart ?? "unknown"} to ${data.relationshipEnd ?? "unknown"}.\n\nUser's memory:\n${data.memory}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: ctx },
        ],
        max_tokens: 700,
      }),
    });
    if (!res.ok) return { ok: false as const, reason: `ai-${res.status}` };
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      return { ok: true as const, extracted: parsed };
    } catch {
      return { ok: false as const, reason: "parse-failed" };
    }
  });