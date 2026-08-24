import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Draft a single incident entry from an evidence transcript (audio or video).
 * Result is returned for review; nothing is auto-saved.
 */
const SYSTEM_PROMPT = `You are an extraction assistant for a domestic-abuse documentation app. The user has a transcript from an audio or video recording and wants you to draft an incident record they can review and edit. Return JSON only, no preamble, no markdown.

Schema (use null when unsure):
{
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM (24h) or null",
  "location": "string or null",
  "description": "string — a calm, factual first-person description of what the transcript shows. 1-5 sentences. Use the user's voice when possible. Quote short relevant phrases and attribute them neutrally (Speaker 1, Speaker 2). Never invent visual details not in the transcript.",
  "abuse_types": ["physical"|"emotional"|"financial"|"coercive"|"custody"|"surveillance"|"location_tracking"|"account_control"|"smart_home"|"impersonation"|"digital_intimidation"|"other"],
  "witnesses": "string or null",
  "emotional_impact": "string or null",
  "people_present": "string or null"
}

Be conservative. Never invent facts. Never diagnose. Never use legal conclusions.
`;

export const extractIncidentFromTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        evidence_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, reason: "missing-key" };

    const { data: row, error } = await supabase
      .from("evidence")
      .select("id, transcript, transcript_status, title, date, exif_captured_at, mime")
      .eq("id", data.evidence_id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !row) return { ok: false as const, reason: "not-found" };
    if (!row.transcript || row.transcript_status !== "ready") {
      return { ok: false as const, reason: "no-transcript" };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Draft an incident record from this transcript. Metadata: title=${row.title ?? "n/a"}, date_hint=${row.exif_captured_at ?? row.date ?? "n/a"}, mime=${row.mime ?? "n/a"}.\n\nTranscript:\n${row.transcript.slice(0, 12000)}`,
          },
        ],
        max_tokens: 800,
      }),
    });

    if (!res.ok) return { ok: false as const, reason: `ai-${res.status}` };
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    try {
      const parsed = JSON.parse(cleaned);
      return { ok: true as const, extracted: parsed, evidence_id: row.id };
    } catch {
      return { ok: false as const, reason: "parse-failed" };
    }
  });
