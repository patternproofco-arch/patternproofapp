import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `You are reviewing a short audio transcript from a safety documentation app used by domestic violence survivors. Determine whether this recording was accidental. An accidental recording contains no meaningful speech — only silence, rustling, muffled noise, pocket sounds, or unintelligible fragments under 10 seconds. Respond in JSON only with no other text: {"accidental": true, "confidence": "high", "reason": "brief reason"}`;

export const checkAccidental = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        transcript: z.string().max(8000),
        durationSec: z.number().min(0).max(86400),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { accidental: false, confidence: "low", reason: "no-key" };
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          max_tokens: 100,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Duration: ${data.durationSec}s\nTranscript: ${data.transcript || "(empty)"}`,
            },
          ],
        }),
      });
      if (!res.ok) return { accidental: false, confidence: "low", reason: "api-error" };
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = json.choices?.[0]?.message?.content ?? "";
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return { accidental: false, confidence: "low", reason: "no-json" };
      const parsed = JSON.parse(match[0]) as {
        accidental?: boolean;
        confidence?: string;
        reason?: string;
      };
      return {
        accidental: Boolean(parsed.accidental),
        confidence: String(parsed.confidence ?? "low"),
        reason: String(parsed.reason ?? ""),
      };
    } catch {
      return { accidental: false, confidence: "low", reason: "exception" };
    }
  });
