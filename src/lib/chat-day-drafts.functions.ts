import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CALL_RECORD_SENDER } from "@/lib/chat-export/parse";
import { planChatDayDrafts, type DraftableMessage } from "@/lib/chat-export/day-drafts";

/**
 * Draft entries from days of an imported chat file.
 *
 * Same tray as every other draft (`proposed_incidents` → /drafts). The text is
 * the survivor's own messages, quoted from what she already saved — never
 * model-written, never characterised. Nothing reaches her timeline until she
 * approves a draft, and an approved entry stays private until she shares it.
 * Only exported chat files qualify: their dates are exact, unlike OCR'd
 * screenshots.
 */

const PAGE = 1000;

/** Same (thread, day) -> same id, so picking a day twice never doubles it. */
function batchIdFor(threadId: string, date: string): string {
  const h = createHash("sha256").update(`chat-day:${threadId}:${date}`).digest("hex");
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const createDraftsFromChatDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        threadId: z.string().uuid(),
        days: z
          .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
          .min(1)
          .max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: thread } = await supabase
      .from("message_threads")
      .select("id,conversation_participant,capture_method")
      .eq("id", data.threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!thread) throw new Error("We couldn't find that import.");
    if (thread.capture_method !== "backup_export") {
      throw new Error("Only conversations added from an exported chat file can be used this way.");
    }

    // Page through: a plain select stops at 1,000 rows and would quietly drop messages.
    const rows: Array<{
      sender: string | null;
      sender_side: string;
      sent_on: string | null;
      sent_at_time: string | null;
      body: string | null;
      has_attachment_marker: boolean;
    }> = [];
    for (let from = 0; ; from += PAGE) {
      const { data: page, error } = await supabase
        .from("thread_messages")
        .select("sender,sender_side,sent_on,sent_at_time,body,has_attachment_marker")
        .eq("thread_id", data.threadId)
        .eq("user_id", userId)
        .in("sent_on", data.days)
        .order("position", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error("We couldn't read that conversation. Try again in a moment.");
      rows.push(...(page ?? []));
      if (!page || page.length < PAGE) break;
    }

    // The survivor's own name in this chat: the sender of her outgoing messages.
    const mine = new Map<string, number>();
    for (const r of rows) {
      if (r.sender_side === "outgoing" && r.sender) {
        mine.set(r.sender, (mine.get(r.sender) ?? 0) + 1);
      }
    }
    const meName = [...mine.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const messages: DraftableMessage[] = rows.map((r) => ({
      sender: r.sender ?? "Unknown",
      kind: r.sender === CALL_RECORD_SENDER ? "call_record" : "text",
      sent_on: r.sent_on,
      sent_at_time: r.sent_at_time,
      body: r.body ?? "",
      has_attachment_marker: r.has_attachment_marker,
    }));

    const ids = new Map(data.days.map((d) => [d, batchIdFor(data.threadId, d)]));
    const { data: existing } = await supabase
      .from("proposed_incidents")
      .select("batch_id")
      .eq("user_id", userId)
      .in("batch_id", [...ids.values()]);
    const alreadyDrafted = new Set((existing ?? []).map((e) => e.batch_id as string));

    const plan = planChatDayDrafts({
      days: data.days,
      messages,
      meName,
      participant: thread.conversation_participant,
      batchIdFor: (d) => ids.get(d) ?? batchIdFor(data.threadId, d),
      alreadyDrafted,
    });

    if (plan.rows.length > 0) {
      // Signed-in users can read and update drafts but not insert them; the
      // ownership of the thread was verified above with the user's own session.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("proposed_incidents")
        .insert(plan.rows.map((r) => ({ ...r, user_id: userId })));
      if (error) throw new Error("We couldn't create those drafts. Try again in a moment.");
      try {
        await supabase.from("audit_log").insert({
          user_id: userId,
          action_type: "chat_day_drafts_created",
          actor: "survivor",
          record_reference: data.threadId,
          timestamp_utc: new Date().toISOString(),
        });
      } catch {
        /* audit must never block the survivor's work */
      }
    }

    return {
      created: plan.rows.length,
      skippedExisting: plan.skippedExisting,
      skippedNoMessages: plan.skippedNoMessages,
    };
  });
