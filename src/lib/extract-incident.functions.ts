import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSupabaseStorageUrl } from "./safe-fetch.server";

const SYSTEM_PROMPT = `You are an extraction assistant for a domestic-abuse documentation app. The user uploaded a screenshot (often a text message, email, or photo) and wants you to draft an incident record they can review and edit. Return JSON only, no preamble, no markdown.

Schema (use null when unsure):
{
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM (24h) or null",
  "location": "string or null",
  "description": "string — a calm, factual first-person description of what appears to have happened. 1-4 sentences. Use the user's voice, not legal jargon.",
  "abuse_types": ["physical"|"emotional"|"financial"|"coercive"|"custody"|"surveillance"|"location_tracking"|"account_control"|"smart_home"|"impersonation"|"digital_intimidation"|"other"],
  "witnesses": "string or null",
  "emotional_impact": "string or null"
}

Category guidance (use only what's clearly shown):
- surveillance: hidden cameras, listening devices, spyware, or monitoring apps on phones/computers/accounts.
- location_tracking: AirTags, Tiles, GPS trackers, Find My / Life360 / shared-account tracking of where the person goes.
- account_control: forced password changes, account lockouts, forced login sharing, control over email/bank/social accounts.
- smart_home: remote control of thermostats, locks, lights, cameras, or voice assistants (Alexa/Ring/Nest) used to watch or unsettle.
- impersonation: fake profiles, deepfakes, edited photos/videos, someone pretending to be the person online or in messages.
- digital_intimidation: relentless texting/calling/DMs, monitoring online status, harassment across multiple platforms or through new accounts after being blocked.

Be conservative. If you only see a single text message, the abuse_types should reflect what is actually shown (often "emotional" or "coercive"). Never invent facts.`;

export const extractIncidentFromImage = createServerFn({ method: "POST" })
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
      assertSupabaseStorageUrl(data.signedUrl);
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
