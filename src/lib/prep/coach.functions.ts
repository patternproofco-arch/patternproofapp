/**
 * Court-prep practice coach — zero-persistence (spec Tier 3 / R-02 / R-03).
 *
 * Practice answers are accepted in-flight, used to generate feedback, then discarded.
 * Only binary module progress is written (via markLessonProgress separately).
 * Counter rows in ai_chat_requests store no message contents.
 *
 * Soft claims. UPL boundary: procedural education, binder/decorum, redirect to aid.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STUDY_MODULES } from "./modules-content";
import { EDUCATIONAL_DISCLAIMER } from "./constants";

const SYSTEM_PROMPT = `You are the PatternProof Court-Prep Coach. You help a survivor practice courtroom procedure and decorum for educational preparation only.

${EDUCATIONAL_DISCLAIMER}

Hard boundaries (Unauthorized Practice of Law):
- You teach procedure, binder organization, exhibit logistics questions for the clerk, and calm delivery.
- You never give tactical legal advice, never suggest which motion to file, never predict case outcomes, never tell them what a judge will do.
- You never invent local filing deadlines or claim PatternProof exhibits are automatically admitted.
- If they ask for strategy or predictions, warmly redirect them to a court facilitator, legal aid clinic, or licensed attorney. Mention the resources page.
- If they sound in immediate danger, mention 988 and 1-800-799-7233.

Privacy:
- Their practice text is ephemeral. Do not ask them to store drafts in the app. Remind them practice answers are not saved.

Voice: calm, warm, plain, short. No markdown asterisks. Under about 150 words unless they ask for detail.
When they practice a foundation script, keep FLAG-01 through FLAG-04 attorney-review markers visible and remind them counsel must confirm each flag before courtroom use.`;

const USER_WINDOW_MS = 60 * 1000;
const USER_MAX_PER_WINDOW = 8;
const IP_WINDOW_MS = 60 * 1000;
const IP_MAX_PER_WINDOW = 16;

const hash = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const moduleIds = STUDY_MODULES.map((m) => m.id) as [string, ...string[]];

/**
 * Returns coach feedback. Does NOT write practice_answer or transcript anywhere.
 * Intentionally non-streaming JSON for reliability with existing Guide patterns;
 * the client clears the practice textarea after success so React state does not retain it.
 */
export const courtPrepCoachFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        module_id: z.enum(moduleIds as [string, ...string[]]),
        practice_text: z.string().trim().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) {
      return {
        reply:
          "The practice coach is not available right now. You can still use the printable study guide. Practice text was not saved.",
        persisted: false as const,
      };
    }

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
      return {
        reply: "Lots of practice activity right now. Try again in a moment. Nothing was saved.",
        persisted: false as const,
      };
    }

    if (ipHash) {
      const ipSince = new Date(Date.now() - IP_WINDOW_MS).toISOString();
      const { count: ipCount } = await db
        .from("ai_chat_requests")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", ipSince);
      if ((ipCount ?? 0) >= IP_MAX_PER_WINDOW) {
        return {
          reply: "Lots of practice activity right now. Try again in a moment. Nothing was saved.",
          persisted: false as const,
        };
      }
    }

    // Counter only — never store practice_text.
    const { error: counterError } = await db.from("ai_chat_requests").insert({
      user_id: context.userId,
      ip_hash: ipHash,
    });
    if (counterError) {
      return {
        reply: "Lots of practice activity right now. Try again in a moment. Nothing was saved.",
        persisted: false as const,
      };
    }

    const mod = STUDY_MODULES.find((m) => m.id === data.module_id);
    const userContent = `Module: ${mod?.title ?? data.module_id}\nPractice prompt: ${mod?.practicePrompt ?? ""}\n\nSurvivor practice (ephemeral, do not ask to save):\n${data.practice_text}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 700,
      }),
    });

    // Drop practice_text from scope after the request body is built (soft hygiene).
    (data as { practice_text?: string }).practice_text = undefined;

    if (res.status === 429) {
      return {
        reply: "Lots of practice activity right now. Try again in a moment. Nothing was saved.",
        persisted: false as const,
      };
    }
    if (res.status === 402) {
      return {
        reply: "The practice coach is out of credits right now. Your practice text was not saved.",
        persisted: false as const,
      };
    }
    if (!res.ok) {
      return {
        reply: "I could not respond just now. Your practice text was not saved.",
        persisted: false as const,
      };
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw =
      json.choices?.[0]?.message?.content?.trim() ||
      "Thank you for practicing. Remember this is educational only; counsel should review anything for court.";

    return {
      reply: raw.replace(/\*\*/g, "").replace(/\*/g, ""),
      persisted: false as const,
    };
  });

/** Exported for tests: prompt must block UPL. */
export const COURT_PREP_COACH_SYSTEM_PROMPT = SYSTEM_PROMPT;
