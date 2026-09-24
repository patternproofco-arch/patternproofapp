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

// Soft claim: public support stays reachable (login/billing help without a
// session), with IP + email throttles mirroring marketing_leads. Does not
// claim absolute security. Optional session auth still attaches user_id when
// present. Message body is stored only in support_requests (existing design)
// — not logged to console.
const EMAIL_COOLDOWN_MS = 60 * 60 * 1000; // one ticket per email per hour
const IP_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX_PER_WINDOW = 8;

const hash = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

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
    const db = supabaseAdmin as any;

    const userId = await resolveCallerUserId();
    const replyEmail = data.replyEmail.toLowerCase();

    const request = getRequest();
    const forwardedIp =
      request?.headers.get("cf-connecting-ip") ||
      request?.headers.get("x-forwarded-for") ||
      request?.headers.get("x-real-ip");
    const ip = forwardedIp?.split(",")[0]?.trim() || null;
    const ipHash = ip ? await hash(ip) : null;

    if (ipHash) {
      const since = new Date(Date.now() - IP_WINDOW_MS).toISOString();
      const { count } = await db
        .from("support_requests")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", since);
      if ((count ?? 0) >= IP_MAX_PER_WINDOW) {
        return { ok: false as const, emailed: false as const };
      }
    }

    const emailSince = new Date(Date.now() - EMAIL_COOLDOWN_MS).toISOString();
    const { count: recentForEmail } = await db
      .from("support_requests")
      .select("id", { count: "exact", head: true })
      .eq("reply_email", replyEmail)
      .gte("created_at", emailSince);
    if ((recentForEmail ?? 0) > 0) {
      // Soft success without enqueue — avoids inbox flood / probing.
      return { ok: true as const, emailed: false as const };
    }

    const { data: row, error } = await db
      .from("support_requests")
      .insert({
        user_id: userId,
        name: data.name || null,
        reply_email: replyEmail,
        category: data.category,
        message: data.message,
        ip_hash: ipHash,
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
