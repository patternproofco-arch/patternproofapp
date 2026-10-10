import { createServerFn } from "@tanstack/react-start";
import { requireAccountAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SupportInboxRow = {
  id: string;
  name: string | null;
  reply_email: string;
  category: string;
  message: string;
  created_at: string;
  user_id: string | null;
  status: string | null;
  reply_body: string | null;
  replied_at: string | null;
};

/** Admin-only list of support requests, newest first. */
export const listSupportRequests = createServerFn({ method: "GET" })
  .middleware([requireAccountAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Not authorized.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("support_requests")
      .select("id,name,reply_email,category,message,created_at,user_id,status,reply_body,replied_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("We couldn't load support messages.");
    return { requests: (data ?? []) as SupportInboxRow[] };
  });

/** Admin-only: save a reply, mark the request answered, and email the sender. */
export const replySupportRequest = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), reply: z.string().trim().min(1).max(5000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Not authorized.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("support_requests")
      .select("id,name,reply_email,message")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("That message couldn't be found.");
    const repliedAt = new Date().toISOString();
    const { error: upErr } = await supabaseAdmin
      .from("support_requests")
      .update({
        reply_body: data.reply,
        replied_at: repliedAt,
        replied_by: context.userId,
        status: "replied",
        updated_at: repliedAt,
      })
      .eq("id", data.id);
    if (upErr) throw new Error("We couldn't save that reply. Try again in a moment.");
    const { enqueueSupportReplyEmail } = await import("@/lib/support.server");
    const emailed = await enqueueSupportReplyEmail({
      id: row.id,
      name: row.name,
      replyEmail: row.reply_email,
      reply: data.reply,
      originalMessage: row.message,
    });
    return { ok: true as const, emailed, replied_at: repliedAt };
  });
