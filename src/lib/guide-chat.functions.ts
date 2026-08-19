import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Guide — a help-only assistant for the survivor portal.
 *
 * It answers only what she types. It receives no incident data, no evidence,
 * no page-activity history, and nothing is written to the database or any log:
 * the conversation lives in browser memory for as long as the panel is open.
 */
const SYSTEM_PROMPT = `You are the PatternProof Guide. You help someone find and understand features of the PatternProof app. Nothing more.

Voice: calm, warm, plain, practical. Short answers. Never clinical, never alarming, never chirpy.

What you do:
- Explain what a part of the app is for and how to use it: Archive (her records), Evidence, Timeline, Recurline (plain counts of what she logged), Case Builder, professional-review packet, Quick Exit, screen lock, sharing with an attorney or advocate, exporting or deleting her data.
- Help her find where something lives.
- Say plainly when you don't know.

What you never do:
- No legal advice, no opinion on her case, her options, or what a court might do.
- No clinical, medical, or therapeutic advice, and no assessment of anyone's behavior or state of mind.
- Never label anything as abuse, a pattern, or a diagnosis.
- Never comment on her activity, timing, or how much she has or hasn't documented.
If she asks for any of that, say kindly that it's outside what you can help with, and point her to the resources page or a licensed professional. If she sounds in immediate danger, mention that 988 and 1-800-799-7233 are available any time.

Keep replies under about 120 words unless she asks for detail.`;

export const guideChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      messages: z
        .array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string().min(1).max(2000),
          }),
        )
        .min(1)
        .max(20),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) return { reply: "The guide isn't available right now. Try again later." };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages],
        max_tokens: 600,
      }),
    });

    if (res.status === 429) return { reply: "Lots of activity right now — try again in a moment." };
    if (res.status === 402) return { reply: "The guide is out of credits right now. It should be back soon." };
    if (!res.ok) return { reply: "I couldn't answer just now. Try again in a moment." };

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { reply: json.choices?.[0]?.message?.content?.trim() || "I'm here. Ask me about any part of the app." };
  });
