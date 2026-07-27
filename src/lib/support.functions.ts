import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const SUPPORT_CATEGORIES = [
  "Login/access",
  "Payments & billing",
  "Evidence upload",
  "Court packet export",
  "Other",
] as const;

const schema = z.object({
  name: z.string().trim().max(120).optional(),
  replyEmail: z.string().trim().email().max(255),
  category: z.enum(SUPPORT_CATEGORIES),
  message: z.string().trim().min(10).max(4000),
  userId: z.string().uuid().nullable().optional(),
});

export const submitSupportRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let userId: string | null = null;
    if (data.userId) {
      const { data: found } = await supabaseAdmin.auth.admin.getUserById(data.userId);
      userId = found?.user?.id ?? null;
    }

    const { data: row, error } = await supabaseAdmin
      .from("support_requests")
      .insert({
        user_id: userId,
        name: data.name || null,
        reply_email: data.replyEmail.toLowerCase(),
        category: data.category,
        message: data.message,
      })
      .select("id")
      .single();

    if (error) {
      return { ok: false as const, emailed: false as const };
    }

    const { enqueueSupportEmail } = await import("@/lib/support.server");
    const emailed = await enqueueSupportEmail({
      id: row.id,
      name: data.name || null,
      replyEmail: data.replyEmail,
      category: data.category,
      message: data.message,
      userId,
    });

    return { ok: true as const, emailed };
  });
