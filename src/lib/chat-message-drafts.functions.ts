import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CALL_RECORD_SENDER } from "@/lib/chat-export/parse";
import {
  planChatMessageDrafts,
  type MessageDraftable,
} from "@/lib/chat-export/message-drafts";

/**
 * One soft draft per message from an imported chat file.
 *
 * Same tray as day drafts and upload drafts (`proposed_incidents` → /drafts).
 * Text is quoted from what she already saved — never model-written, never
 * characterised. Nothing reaches her timeline until she approves; approved
 * entries stay private until she shares. Soft claims only.
 */

const PAGE = 1000;
/** Hard cap per request so a huge thread is drafted in client-side chunks. */
const MAX_PER_CALL = 100;

/** Same (thread, message position) → same id; picking twice never doubles. */
function batchIdFor(threadId: string, position: number): string {
  const h = createHash("sha256")
    .update(`chat-msg:${threadId}:${position}`)
    .digest("hex");
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const createDraftsFromChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        threadId: z.string().uuid(),
        /** Calendar days to draft; every dated message on those days becomes a draft. */
        days: z
          .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
          .min(1)
          .max(100),
        /** Optional offset for chunked drafting of long days. */
        offset: z.number().int().min(0).max(100_000).optional().default(0),
        limit: z.number().int().min(1).max(MAX_PER_CALL).optional().default(MAX_PER_CALL),
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

    const rows: Array<{
      id: string;
      position: number;
      sender: string | null;
      sender_side: string;
      sent_on: string | null;
      sent_at_time: string | null;
      body: string | null;
      has_attachment_marker: boolean;
      attachment_marker_text: string | null;
    }> = [];
    for (let from = 0; ; from += PAGE) {
      const { data: page, error } = await supabase
        .from("thread_messages")
        .select(
          "id,position,sender,sender_side,sent_on,sent_at_time,body,has_attachment_marker,attachment_marker_text",
        )
        .eq("thread_id", data.threadId)
        .eq("user_id", userId)
        .in("sent_on", data.days)
        .order("position", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error("We couldn't read that conversation. Try again in a moment.");
      rows.push(...(page ?? []));
      if (!page || page.length < PAGE) break;
    }

    const mine = new Map<string, number>();
    for (const r of rows) {
      if (r.sender_side === "outgoing" && r.sender) {
        mine.set(r.sender, (mine.get(r.sender) ?? 0) + 1);
      }
    }
    const meName = [...mine.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Apply offset for chunked calls across a long selection.
    const sliced = rows.slice(data.offset, data.offset + data.limit + 1);
    const window = sliced.slice(0, data.limit);
    const hasMore = sliced.length > data.limit;

    const messages: MessageDraftable[] = window.map((r) => ({
      sender: r.sender ?? "Unknown",
      kind: r.sender === CALL_RECORD_SENDER ? "call_record" : "text",
      sent_on: r.sent_on,
      sent_at_time: r.sent_at_time,
      body: r.body ?? "",
      has_attachment_marker: !!r.has_attachment_marker,
      attachment_marker_text: r.attachment_marker_text,
      position: r.position,
      id: r.id,
    }));

    const ids = new Map(
      window.map((r) => [String(r.position), batchIdFor(data.threadId, r.position)]),
    );
    const { data: existing } = await supabase
      .from("proposed_incidents")
      .select("batch_id")
      .eq("user_id", userId)
      .in("batch_id", [...ids.values()]);
    const alreadyDrafted = new Set((existing ?? []).map((e) => e.batch_id as string));

    const plan = planChatMessageDrafts({
      messages,
      meName,
      participant: thread.conversation_participant,
      batchIdFor: (key) => {
        // Keys from buildMessageDraft prefer id; fall back to pos:N.
        const byId = window.find((r) => r.id === key);
        if (byId) return batchIdFor(data.threadId, byId.position);
        const pos = key.startsWith("pos:") ? Number(key.slice(4)) : NaN;
        if (Number.isFinite(pos)) return batchIdFor(data.threadId, pos);
        return batchIdFor(data.threadId, 0);
      },
      alreadyDrafted,
      limit: data.limit,
    });

    if (plan.rows.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("proposed_incidents")
        .insert(plan.rows.map((r) => ({ ...r, user_id: userId })));
      if (error) throw new Error("We couldn't create those drafts. Try again in a moment.");
      try {
        await supabase.from("audit_log").insert({
          user_id: userId,
          action_type: "chat_message_drafts_created",
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
      skippedUndated: plan.skippedUndated,
      skippedEmpty: plan.skippedEmpty,
      nextOffset: data.offset + window.length,
      hasMore,
    };
  });
