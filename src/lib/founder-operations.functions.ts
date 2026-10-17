import { createServerFn } from "@tanstack/react-start";
import { requireAccountAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { declineAttorneyApplication, type DeclineDb } from "@/lib/decline-attorney";

export type AttorneyApplication = {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  firm_name: string | null;
  bar_number: string;
  jurisdiction: string;
  status: "pending_review" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  decline_reason?: string | null;
  decline_reason_emailed_at?: string | null;
};

async function founder(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Not authorized.");
  return supabaseAdmin;
}

async function alert(subject: string, text: string, key: string, to = "patternproofco@gmail.com") {
  const { sendRenderedEmail } = await import("@/lib/email/managed-send.server");
  const html = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return sendRenderedEmail({
    to,
    from: "PatternProof <noreply@pattern-proof.tech>",
    subject,
    html: `<p style="white-space:pre-wrap">${html}</p>`,
    text,
    label: "attorney-operations",
    idempotencyKey: key,
  });
}

export const getMyAttorneyApplication = createServerFn({ method: "GET" })
  .middleware([requireAccountAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("attorney_access_applications")
      .select("id,status,full_name,firm_name,bar_number,jurisdiction,created_at,reviewed_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Could not load your application.");
    return { application: data as AttorneyApplication | null };
  });

export const applyAsAttorney = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((input) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(120),
        firm_name: z.string().trim().max(200),
        bar_number: z.string().trim().min(1).max(60),
        jurisdiction: z.string().trim().min(2).max(120),
        invite_token: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: auth, error: authError } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    const email = auth.user?.email?.trim().toLowerCase();
    if (authError || !email || !auth.user?.email_confirmed_at)
      throw new Error("Confirm your account email before applying.");
    const db = supabaseAdmin as any;
    const { invite_token, ...fields } = data;
    // An immutable owner-unique request cannot overwrite its review or flood the inbox.
    const { data: inserted, error } = await db
      .from("attorney_access_applications")
      .insert({ ...fields, user_id: context.userId, email })
      .select("id")
      .single();
    let id: string;
    if (error?.code === "23505") {
      const { data: existing, error: lookupError } = await db
        .from("attorney_access_applications")
        .select("id")
        .eq("user_id", context.userId)
        .single();
      if (lookupError || !existing) throw new Error("Could not find your existing application.");
      id = existing.id;
    } else {
      if (error || !inserted) throw new Error("Could not save your application.");
      id = inserted.id;
    }
    if (invite_token) {
      const { hashToken } = await import("@/lib/invite-token.server");
      const { error: claimError } = await db.rpc("claim_founder_attorney_invite", {
        _application: id,
        _hash: await hashToken(invite_token),
      });
      if (claimError)
        throw new Error(
          "That invitation is invalid, used, expired, or belongs to another email. Your application remains available for review.",
        );
    }
    if (inserted)
      await alert(
        "Attorney application received",
        `${fields.full_name} (${email}) applied. Review their bar number and jurisdiction in /admin/operations.`,
        `attorney-application-${id}`,
      );
    return { ok: true as const };
  });

export const getFounderOperations = createServerFn({ method: "GET" })
  .middleware([requireAccountAuth])
  .handler(async ({ context }) => {
    const db = await founder(context.userId);
    const [apps, tickets, roles, sends, alerts] = await Promise.all([
      (db as any)
        .from("attorney_access_applications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("support_requests")
        .select("id,name,reply_email,category,message,created_at,status")
        .order("created_at", { ascending: false })
        .limit(50),
      (db as any).rpc("founder_recent_signups"),
      db
        .from("email_send_log")
        .select("id,template_name,status,error_message,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      (db as any)
        .from("signup_alert_outbox")
        .select("user_id,role,created_at,attempts,next_attempt_at")
        .is("completed_at", null)
        .order("created_at", { ascending: true })
        .limit(50),
    ]);
    if ([apps, tickets, roles, sends, alerts].some((r) => r.error))
      throw new Error("Could not load operations.");
    return {
      applications: apps.data as AttorneyApplication[],
      tickets: tickets.data ?? [],
      signups: (roles.data ?? []) as Array<{
        user_id: string;
        email: string | null;
        created_at: string;
        roles: string[];
      }>,
      emailActivity: sends.data ?? [],
      pendingAlerts: (alerts.data ?? []) as Array<{
        user_id: string;
        role: string;
        created_at: string;
        attempts: number;
        next_attempt_at: string;
      }>,
    };
  });

export const retrySignupAlerts = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .handler(async ({ context }) => {
    const db = await founder(context.userId);
    const { data, error } = await (db as any)
      .from("signup_alert_outbox")
      .select("user_id,role")
      .is("completed_at", null)
      .lte("next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(25);
    if (error) throw new Error("Could not load pending signup alerts.");
    const { notifyNewSignup } = await import("@/lib/signup-notify.server");
    let submitted = 0;
    for (const row of data ?? []) {
      if (await notifyNewSignup({ userId: row.user_id, role: row.role, retryOnly: true }))
        submitted++;
    }
    return { attempted: data?.length ?? 0, submitted };
  });

export const reviewAttorney = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), status: z.enum(["approved", "rejected"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await founder(context.userId);
    const { error } = await (db as any).rpc("review_attorney_application", {
      _id: data.id,
      _reviewer: context.userId,
      _status: data.status,
    });
    if (error) throw new Error("Could not save the review.");
    return { ok: true as const };
  });

export const inviteVettedAttorney = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((input) =>
    z.object({ email: z.string().trim().email().max(255), vetted: z.literal(true) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await founder(context.userId);
    const { randomToken, hashToken } = await import("@/lib/invite-token.server");
    const { getEmailSiteOrigin } = await import("@/lib/email/site-origin.server");
    const token = randomToken();
    const { data: invitation, error } = await (db as any)
      .from("founder_attorney_invites")
      .insert({
        email: data.email.toLowerCase(),
        token_hash: await hashToken(token),
        invited_by: context.userId,
      })
      .select("id,expires_at")
      .single();
    if (error || !invitation) throw new Error("Could not create the invitation.");
    const url = `${getEmailSiteOrigin()}/attorney-apply?invite=${token}`;
    const result = await alert(
      "Your PatternProof attorney invitation",
      `You have been invited to PatternProof. Register or sign in with ${data.email}, confirm your email, then submit your attorney details using this one-use link. It expires in seven days. Client records still require the client’s separate consent.\n\n${url}`,
      `founder-invite-${invitation.id}`,
      data.email,
    );
    await alert(
      "Vetted attorney invitation created",
      `An invitation was created for ${data.email}. Email status: ${result.sent ? "accepted by provider" : "failed"}.`,
      `founder-invite-alert-${invitation.id}`,
    );
    return { url, expires_at: invitation.expires_at as string, emailed: result.sent };
  });

/**
 * Decline an attorney application, optionally with a reason.
 * - The decision itself goes through the same audited RPC as reviewAttorney
 *   (declining also withdraws any client shares).
 * - The reason is saved on the application so the founder can see why later.
 * - The reason is only emailed to the attorney if the founder ticks the box.
 */
export const declineAttorney = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        reason: z.string().trim().max(1000).optional(),
        sendEmail: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await founder(context.userId);
    return declineAttorneyApplication({
      // The held decline RPC is not in generated database types yet. Keep the
      // compatibility assertion at this server-only boundary; missing RPCs fail closed.
      db: db as unknown as DeclineDb,
      id: data.id,
      reviewer: context.userId,
      reason: data.reason,
      sendEmail: data.sendEmail,
      sendEmailFn: alert,
    });
  });
