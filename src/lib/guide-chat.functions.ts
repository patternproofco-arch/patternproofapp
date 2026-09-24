import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Guide — a help-only assistant for the survivor portal.
 *
 * UI: GuideHelper inside AppShell under `/_authenticated` (post-login only).
 * Soft claim: requireSupabaseAuth + per-user and per-IP rate limits reduce
 * unauthenticated spend against LOVABLE_API_KEY. Does not claim absolute
 * security. Conversation text is not written to ai_chat_requests (counter
 * rows only) and is not logged beyond the existing in-memory UI design.
 *
 * Needs @Guardian CLEAR before merge/apply of the companion migration.
 */
const SYSTEM_PROMPT = `You are the PatternProof Guide. You help someone find and understand features of the PatternProof app. Nothing more.

Voice: calm, warm, plain, practical. Short answers. Never clinical, never alarming, never chirpy.

What you do:
- Explain what a part of the app is for and how to use it: Archive (their records), Evidence, Timeline, Recurline (plain counts of what they logged), Case Builder, professional-review packet, Quick Exit, screen lock, sharing with an attorney or advocate, exporting or deleting their data.
- Help them find where something lives.
- Say plainly when you don't know.

What you never do:
- No legal advice, no opinion on their case, their options, or what a court might do.
- No clinical, medical, or therapeutic advice, and no assessment of anyone's behavior or state of mind.
- Never label anything as abuse, a pattern, or a diagnosis.
- Never comment on their activity, timing, or how much they have or haven't documented.
If they ask for any of that, say kindly that it's outside what you can help with, and point them to the resources page or a licensed professional. If they sound in immediate danger, mention that 988 and 1-800-799-7233 are available any time.

Keep replies under about 120 words unless they ask for detail.`;

const USER_WINDOW_MS = 60 * 1000;
const USER_MAX_PER_WINDOW = 10;
const IP_WINDOW_MS = 60 * 1000;
const IP_MAX_PER_WINDOW = 20;

const hash = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const guideChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(2000),
            }),
          )
          .min(1)
          .max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { reply: "The guide isn't available right now. Try again later." };

    const { getRequest } = await import("@tanstack/react-start/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const request = getRequest();
    const forwardedIp =
      request?.headers.get("cf-connecting-ip") ||
      request?.headers.get("x-forwarded-for") ||
      request?.headers.get("x-real-ip");
    const ip = forwardedIp?.split(",")[0]?.trim() || null;
    const ipHash = ip ? await hash(ip) : null;

    const userSince = new Date(Date.now() - USER_WINDOW_MS).toISOString();
    const { count: userCount } = await db
      .from("ai_chat_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", userSince);
    if ((userCount ?? 0) >= USER_MAX_PER_WINDOW) {
      return { reply: "Lots of activity right now — try again in a moment." };
    }

    if (ipHash) {
      const ipSince = new Date(Date.now() - IP_WINDOW_MS).toISOString();
      const { count: ipCount } = await db
        .from("ai_chat_requests")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", ipSince);
      if ((ipCount ?? 0) >= IP_MAX_PER_WINDOW) {
        return { reply: "Lots of activity right now — try again in a moment." };
      }
    }

    // Counter row only — do not store Guide message contents.
    await db.from("ai_chat_requests").insert({
      user_id: context.userId,
      ip_hash: ipHash,
    });

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
    if (res.status === 402)
      return { reply: "The guide is out of credits right now. It should be back soon." };
    if (!res.ok) return { reply: "I couldn't answer just now. Try again in a moment." };

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return {
      reply:
        json.choices?.[0]?.message?.content?.trim() ||
        "I'm here. Ask me about any part of the app.",
    };
  });
