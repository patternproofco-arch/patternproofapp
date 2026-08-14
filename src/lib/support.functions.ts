import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
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
});

/** Derive the caller's user id from their own verified session, never from input. */
async function resolveCallerUserId(): Promise<string | null> {
  try {
    const authHeader = getRequest()?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) return null;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;

    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error) return null;
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export const submitSupportRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const userId = await resolveCallerUserId();

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
