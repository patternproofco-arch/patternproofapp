import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OCR_PROMPT = `You are an OCR assistant. The user uploaded a photo of a handwritten journal page or typed notes. Transcribe ALL visible text as faithfully as possible. Preserve line breaks and dates. Do not summarize, do not interpret, do not add words. If a word is unclear, write [unclear]. Return plain text only — no commentary, no markdown.`;

const SPLIT_PROMPT = `You are an extraction assistant for a domestic-abuse documentation app. The user pasted a journal entry that may describe MULTIPLE incidents across different days or moments. Your job is to split it into separate incident records.

Return JSON only, no markdown, no preamble. Schema:
{
  "incidents": [
    {
      "date": "YYYY-MM-DD or null",
      "time": "HH:MM (24h) or null",
      "location": "string or null",
      "description": "Calm, factual first-person description of what happened. 1-4 sentences in the user's voice. No interpretation, no legal jargon.",
      "abuse_types": ["physical"|"emotional"|"financial"|"coercive"|"custody"|"other"],
      "witnesses": "string or null",
      "emotional_impact": "string or null"
    }
  ]
}

Rules:
- If the entry clearly describes only one incident, return a single-item array.
- If different dates, locations, or distinct events are mentioned, split them.
- Never invent facts. If a date isn't in the text, use null.
- abuse_types must reflect only what's actually described.`;

export const ocrJournalImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      signedUrl: z.string().url().max(2000),
      mimeType: z.string().min(1).max(120),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, reason: "missing-key" };
    if (!data.mimeType.startsWith("image/") && data.mimeType !== "application/pdf") {
      return { ok: false as const, reason: "unsupported-format" };
    }
    let dataUri: string;
    try {
      const fileRes = await fetch(data.signedUrl);
      if (!fileRes.ok) return { ok: false as const, reason: "fetch-failed" };
      const buf = Buffer.from(await fileRes.arrayBuffer());
      if (buf.length > 8 * 1024 * 1024) return { ok: false as const, reason: "too-large" };
      dataUri = `data:${data.mimeType};base64,${buf.toString("base64")}`;
    } catch {
      return { ok: false as const, reason: "fetch-failed" };
    }
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: OCR_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe everything written on this page." },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    });
    if (!res.ok) return { ok: false as const, reason: `ai-${res.status}` };
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false as const, reason: "empty" };
    return { ok: true as const, text };
  });

export const splitJournalIntoIncidents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      text: z.string().min(1).max(20000),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, reason: "missing-key" };
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SPLIT_PROMPT },
          { role: "user", content: `Journal entry:\n\n${data.text}` },
        ],
        max_tokens: 2000,
      }),
    });
    if (!res.ok) return { ok: false as const, reason: `ai-${res.status}` };
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    try {
      const parsed = JSON.parse(cleaned) as { incidents?: unknown };
      const arr = Array.isArray(parsed.incidents) ? parsed.incidents : [];
      return { ok: true as const, incidents: arr };
    } catch {
      return { ok: false as const, reason: "parse-failed" };
    }
  });