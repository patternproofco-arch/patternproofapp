import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional(),
  persona: z.enum(["attorney", "org"]),
  sourcePage: z.enum(["/for-attorneys", "/for-organizations"]),
});

// Bounds on the public, unauthenticated readiness-kit form. Without these,
// a script could submit an arbitrary victim's email address repeatedly and
// have PatternProof's own domain flood their inbox, or hammer the endpoint
// fast enough to get pattern-proof.tech's sending reputation flagged.
const EMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000; // one kit per email per day
const IP_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX_PER_WINDOW = 8; // per IP per hour, across all emails

const hash = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const requestProfessionalReadinessKit = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const email = data.email.toLowerCase();
    const request = getRequest();
    const forwardedIp =
      request?.headers.get("cf-connecting-ip") ||
      request?.headers.get("x-forwarded-for") ||
      request?.headers.get("x-real-ip");
    const ip = forwardedIp?.split(",")[0]?.trim() || null;
    const ipHash = ip ? await hash(ip) : null;

    // Per-IP throttle: slows down scripted abuse regardless of which
    // email address it targets.
    if (ipHash) {
      const since = new Date(Date.now() - IP_WINDOW_MS).toISOString();
      const { count } = await db
        .from("marketing_leads")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", since);
      if ((count ?? 0) >= IP_MAX_PER_WINDOW) {
        return { ok: false as const, emailed: false as const };
      }
    }

    // Per-email cooldown: the actual fix for "spam one target's inbox" —
    // report success without sending a second kit within the window, so a
    // repeat submission (accidental or scripted) can't be used to flood
    // someone else's address.
    const emailSince = new Date(Date.now() - EMAIL_COOLDOWN_MS).toISOString();
    const { count: recentForEmail } = await db
      .from("marketing_leads")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .eq("persona", data.persona)
      .gte("created_at", emailSince);
    if ((recentForEmail ?? 0) > 0) {
      return { ok: true as const, emailed: false as const };
    }

    const { data: row, error } = await db
      .from("marketing_leads")
      .insert({
        name: data.name,
        email,
        phone: data.phone || null,
        persona: data.persona,
        source_page: data.sourcePage,
        ip_hash: ipHash,
      })
      .select("id")
      .single();

    if (error || !row?.id) {
      return { ok: false as const, emailed: false as const };
    }

    const { enqueueProfessionalReadinessKit } = await import("@/lib/marketing-leads.server");
    const emailed = await enqueueProfessionalReadinessKit({
      id: row.id,
      name: data.name,
      email,
      persona: data.persona,
    });

    return { ok: true as const, emailed };
  });
