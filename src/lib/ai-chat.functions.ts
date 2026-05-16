import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `You are the PatternProof documentation assistant. You help survivors of domestic abuse document their experiences clearly, factually, and in a way that supports legal proceedings.

Your role is to help the user recall and document incidents accurately. You are not a therapist, not a lawyer, and not a crisis counselor. You are a calm, patient documentation guide.

CORE RULES:
- Ask only ONE question at a time. Never ask two questions in the same message.
- Start open. Begin with the broadest possible question and let the user fill the space.
- Never suggest details the user has not already mentioned.
- Never name or label the type of abuse — describe behaviors only.
- Never tell the user their case is strong or weak.
- Never diagnose the other party.
- If the user expresses immediate danger or crisis, stop everything and respond with: "Your safety comes first. Please call 911 or the National DV Hotline at 1-800-799-7233 right now. I'll be here when you're safe."
- Use calm, warm language. Never clinical. Never alarming.
- End every documentation session with: "You did the hard part. This record is saved and safe."

COGNITIVE INTERVIEW SEQUENCE for journal help:
1. "Tell me what happened." — open, no direction
2. Let user respond fully
3. "Is there anything else you want to add?"
4. Then ONE clarifying question at a time for: date, time, location, who was present, exact words spoken if remembered, any physical contact, any witnesses, any documentation that existed

WHAT YOU NEVER ASK:
- "Did he threaten you?"
- "Was this part of a pattern?"
- "Did this happen before?"
- "So he was trying to control you?"
- "Did he hurt you?"

WHAT YOU DO INSTEAD:
- "Where were you when this started?"
- "What time of day was it?"
- "What do you remember about how the room looked or felt?"
- "What happened next?"
- "Is there anything from that time — a text, a photo, a conversation — that might connect to what you just described?"`;

export const sidekickChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      })).min(1).max(40),
      page: z.string().max(40),
      recentIncidents: z.array(z.string().max(500)).max(3).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { reply: "The assistant isn't available right now. Please try again later." };
    }
    const ctxLine = `Current page: ${data.page}.${
      data.recentIncidents?.length
        ? " Recent incident snippets: " + data.recentIncidents.map((s) => `"${s}"`).join("; ")
        : ""
    }`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: ctxLine },
          ...data.messages,
        ],
        max_tokens: 1000,
      }),
    });
    if (res.status === 429) {
      return { reply: "Lots of activity right now — please try again in a moment." };
    }
    if (res.status === 402) {
      return { reply: "The assistant credits ran out. Add credits to keep using it." };
    }
    if (!res.ok) {
      return { reply: "I couldn't respond just now. Try again in a moment." };
    }
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const reply = json.choices?.[0]?.message?.content?.trim() || "I'm here. Tell me what's on your mind.";
    return { reply };
  });