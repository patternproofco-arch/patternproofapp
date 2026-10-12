import { fetchReviewedAi, isAiProcessingPolicyReviewed } from "@/lib/ai-processing-policy.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSupabaseStorageUrl } from "./safe-fetch.server";

const SYSTEM_PROMPT = `Extract only what is visible in this uploaded source for the user to review. Return JSON, using null when uncertain:
{"date":"YYYY-MM-DD or null","time":"HH:MM or null","location":"string or null","description":"A source-attributed summary of visible text; keep exact quotations in quotation marks and summaries separate.","abuse_types":[],"witnesses":null,"emotional_impact":null}
Do not write as if you are the survivor. Do not label abuse, diagnose, infer intent, emotion or credibility, or predict admissibility. Do not invent missing context, dates or speakers. Say when text is unreadable or dates conflict. The output is an unconfirmed software suggestion, not the user's account.`;

export const extractIncidentFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        signedUrl: z.string().url().max(2000),
        mimeType: z.string().min(1).max(120),
        ai_consent: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!isAiProcessingPolicyReviewed())
      return { ok: false as const, reason: "processing-disabled" };
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, reason: "missing-key" };

    if (!data.mimeType.startsWith("image/") && data.mimeType !== "application/pdf") {
      return { ok: false as const, reason: "unsupported-format" };
    }

    let dataUri: string;
    try {
      assertSupabaseStorageUrl(data.signedUrl);
      const fileRes = await fetch(data.signedUrl);
      if (!fileRes.ok) return { ok: false as const, reason: "fetch-failed" };
      const buf = Buffer.from(await fileRes.arrayBuffer());
      if (buf.length > 8 * 1024 * 1024) return { ok: false as const, reason: "too-large" };
      dataUri = `data:${data.mimeType};base64,${buf.toString("base64")}`;
    } catch {
      return { ok: false as const, reason: "fetch-failed" };
    }

    const res = await fetchReviewedAi("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Draft an incident record from this image. Return JSON only." },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
        max_tokens: 700,
      }),
    });

    if (!res.ok) return { ok: false as const, reason: `ai-${res.status}` };
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    try {
      const parsed = JSON.parse(cleaned);
      const extracted = z
        .object({
          date: z.string().nullable().optional(),
          time: z.string().nullable().optional(),
          location: z.string().nullable().optional(),
          description: z.string().max(4000),
        })
        .parse(parsed);
      return {
        ok: true as const,
        extracted: {
          ...extracted,
          abuse_types: [] as string[],
          witnesses: "",
          emotional_impact: "",
        },
      };
    } catch {
      return { ok: false as const, reason: "parse-failed" };
    }
  });
