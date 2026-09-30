import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Rolling-window send caps for in-app invitation emails. */
const USER_LIMIT_PER_HOUR = 20;
const IP_LIMIT_PER_HOUR = 40;
const WINDOW_MS = 60 * 60 * 1000;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function daysLeft(expiresAt: string | null): string {
  return expiresAt
    ? `${Math.max(1, Math.round((new Date(expiresAt).getTime() - Date.now()) / 86400000))} days`
    : "30 days";
}

/**
 * Sends an invitation email the signed-in user is allowed to send. The
 * recipient must match a pending invitation the caller created, and the
 * content is rebuilt from that record so no caller text is injected.
 */
export const sendInvitationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        templateName: z.enum([
          "advocate-survivor-invitation",
          "attorney-invitation",
          "attorney-survivor-invitation",
        ]),
        discreet: z.boolean().optional(),
        recipientEmail: z.string().trim().min(3).max(320),
        idempotencyKey: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ success: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const request = getRequest();
    const h = request.headers;
    const ip = (h.get("cf-connecting-ip") || h.get("x-forwarded-for") || h.get("x-real-ip") || "")
      .split(",")[0]
      ?.trim();
    const ipHash = ip ? await sha256(ip) : null;
    const since = new Date(Date.now() - WINDOW_MS).toISOString();

    const logAttempt = async (outcome: string) => {
      const { error } = await supabaseAdmin.from("email_relay_attempts").insert({
        user_id: userId,
        ip_hash: ipHash,
        template_name: data.templateName,
        outcome,
      });
      if (error) console.error("[email] relay attempt log failed", { code: error.code });
    };

    const [userAttempts, ipAttempts] = await Promise.all([
      supabaseAdmin
        .from("email_relay_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", since),
      ipHash
        ? supabaseAdmin
            .from("email_relay_attempts")
            .select("id", { count: "exact", head: true })
            .eq("ip_hash", ipHash)
            .gte("created_at", since)
        : Promise.resolve({ count: 0 }),
    ]);
    if (
      (userAttempts.count ?? 0) >= USER_LIMIT_PER_HOUR ||
      (ipAttempts.count ?? 0) >= IP_LIMIT_PER_HOUR
    ) {
      await logAttempt("rate_limited");
      return { success: false };
    }

    const recipient = data.recipientEmail.toLowerCase();
    const origin = new URL(request.url).origin;
    let templateData: Record<string, unknown>;

    if (data.templateName === "advocate-survivor-invitation") {
      const { data: inv } = await supabaseAdmin
        .from("advocate_survivor_invites")
        .select("survivor_name, personal_note, invite_token, expires_at")
        .eq("advocate_user_id", userId)
        .eq("survivor_email", recipient)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!inv) {
        await logAttempt("recipient_not_authorized");
        return { success: false };
      }
      const { data: prof } = await supabaseAdmin
        .from("advocate_profiles")
        .select("full_name,org_name")
        .eq("user_id", userId)
        .maybeSingle();
      templateData = {
        advocateName: prof?.full_name ?? undefined,
        orgName: prof?.org_name ?? undefined,
        survivorName: inv.survivor_name ?? undefined,
        personalNote: inv.personal_note ?? undefined,
        acceptUrl: `${origin}/advocate-survivor-invite/${inv.invite_token}`,
        expiresLabel: daysLeft(inv.expires_at),
      };
    } else if (data.templateName === "attorney-survivor-invitation") {
      const { data: inv } = await supabaseAdmin
        .from("attorney_survivor_invites")
        .select("survivor_name, personal_note, invite_token, expires_at")
        .eq("attorney_user_id", userId)
        .eq("survivor_email", recipient)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!inv) {
        await logAttempt("recipient_not_authorized");
        return { success: false };
      }
      const discreet = data.discreet !== false;
      const { data: prof } = await supabaseAdmin
        .from("attorney_profiles")
        .select("full_name,firm_name")
        .eq("user_id", userId)
        .maybeSingle();
      templateData = {
        discreet,
        attorneyName: discreet ? undefined : (prof?.full_name ?? undefined),
        firmName: discreet ? undefined : (prof?.firm_name ?? undefined),
        survivorName: discreet ? undefined : (inv.survivor_name ?? undefined),
        personalNote: discreet ? undefined : (inv.personal_note ?? undefined),
        acceptUrl: `${origin}/survivor-invite/${inv.invite_token}`,
        expiresLabel: daysLeft(inv.expires_at),
      };
    } else {
      const { data: inv } = await supabaseAdmin
        .from("attorney_invitations")
        .select("attorney_name, personal_note, invite_token, expires_at")
        .eq("client_user_id", userId)
        .eq("attorney_email", recipient)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!inv) {
        await logAttempt("recipient_not_authorized");
        return { success: false };
      }
      templateData = {
        attorneyName: inv.attorney_name ?? undefined,
        clientLabel: "Your client",
        personalNote: inv.personal_note ?? undefined,
        acceptUrl: `${origin}/accept-invite/${inv.invite_token}`,
        expiresLabel: daysLeft(inv.expires_at),
      };
    }

    await logAttempt("accepted");
    const { deliverTransactionalEmail } = await import("@/lib/email/deliver-transactional.server");
    const result = await deliverTransactionalEmail({
      templateName: data.templateName,
      recipientEmail: recipient,
      templateData,
      idempotencyKey: data.idempotencyKey || crypto.randomUUID(),
    });
    return { success: result.sent };
  });
