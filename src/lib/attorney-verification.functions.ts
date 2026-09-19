import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Attorney bar verification: the reviewer decision log, the 90-day
 * decline-reapply wait, and the survivor-facing side of the 180-day
 * access-cutoff cycle (the attorney side — reminders and the sweep that
 * actually flips status — lives in attorney-access-cutoff.server.ts).
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireAdmin(userId: string) {
  const supabaseAdmin = await admin();
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Not authorized.");
  return supabaseAdmin;
}

/* ------------------------- admin: review queue ------------------------- */

export const listPendingAttorneys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("attorney_profiles")
      .select("user_id,full_name,email,firm_name,bar_number,jurisdiction,verification_status,created_at")
      .eq("verification_status", "pending")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return { attorneys: data ?? [] };
  });

export const listAttorneyVerificationDecisions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ attorney_user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data: decisions, error } = await supabaseAdmin
      .from("attorney_verification_decisions")
      .select("id,reviewer_user_id,decision,evidence,reason,created_at")
      .eq("attorney_user_id", data.attorney_user_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { decisions: decisions ?? [] };
  });

async function emailAttorneyVerificationDecision(input: {
  email: string;
  fullName?: string | null;
  decision: "verified" | "declined" | "suspended" | "reinstated";
}) {
  try {
    const { deliverTransactionalEmail } = await import("@/lib/email/deliver-transactional.server");
    const result = await deliverTransactionalEmail({
      templateName: "attorney-verification-decision",
      recipientEmail: input.email,
      templateData: { fullName: input.fullName ?? undefined, decision: input.decision },
      idempotencyKey: `attorney-verification-${input.decision}-${input.email}-${Date.now()}`,
    });
    if (!result.sent) console.error("[email] attorney verification decision not sent:", result.error);
    return result;
  } catch (error) {
    console.error("[email] attorney verification decision failed", error);
    return { sent: false, error: error instanceof Error ? error.message : "Send failed." };
  }
}

/**
 * The one place an attorney's verification_status changes. Every call is a
 * row in attorney_verification_decisions: who reviewed, when, what evidence
 * they checked, and why — nothing here overwrites a prior decision, it only
 * adds to the log.
 */
export const reviewAttorney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        attorney_user_id: z.string().uuid(),
        decision: z.enum(["verified", "declined", "suspended", "reinstated"]),
        evidence: z.string().trim().min(1).max(2000),
        reason: z.string().trim().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("attorney_profiles")
      .select("user_id,full_name,email,verification_status,declined_at")
      .eq("user_id", data.attorney_user_id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("Attorney profile not found.");

    const now = new Date().toISOString();
    const statusPatch: Record<string, unknown> = { updated_at: now };
    if (data.decision === "verified" || data.decision === "reinstated") {
      statusPatch.verification_status = "verified";
      statusPatch.verified_at = now;
    } else if (data.decision === "declined") {
      statusPatch.verification_status = "declined";
      statusPatch.declined_at = now;
    } else {
      statusPatch.verification_status = "suspended";
      statusPatch.suspended_at = now;
    }

    const { error: updateError } = await supabaseAdmin
      .from("attorney_profiles")
      .update(statusPatch)
      .eq("user_id", data.attorney_user_id);
    if (updateError) throw new Error(updateError.message);

    const { error: logError } = await supabaseAdmin.from("attorney_verification_decisions").insert({
      attorney_user_id: data.attorney_user_id,
      reviewer_user_id: context.userId,
      decision: data.decision,
      evidence: data.evidence,
      reason: data.reason ?? null,
    });
    if (logError) throw new Error(logError.message);

    // Verifying/reinstating an attorney activates any share that was
    // waiting on review — a survivor's invite is not lost while the
    // reviewer works through the queue.
    if (data.decision === "verified" || data.decision === "reinstated") {
      await supabaseAdmin
        .from("attorney_client_links")
        .update({ status: "active", last_confirmed_at: now })
        .eq("attorney_user_id", data.attorney_user_id)
        .eq("status", "pending_verification");
    }

    const emailed = profile.email
      ? await emailAttorneyVerificationDecision({
          email: profile.email,
          fullName: profile.full_name,
          decision: data.decision,
        })
      : { sent: false, error: "No email on file." };

    return { ok: true as const, emailed };
  });

/* ------------------------- attorney: confirm still on case ------------------------- */

export const confirmStillOnCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ link_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await admin();
    const { data: link, error } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id,attorney_user_id,status")
      .eq("id", data.link_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!link || link.attorney_user_id !== context.userId || link.status !== "active") {
      throw new Error("No active case to confirm.");
    }
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("attorney_client_links")
      .update({
        last_confirmed_at: now,
        reminder_150_sent_at: null,
        reminder_165_sent_at: null,
        reminder_175_sent_at: null,
        survivor_notice_sent_at: null,
      })
      .eq("id", data.link_id);
    await supabaseAdmin.from("attorney_access_confirmations").insert({
      link_id: data.link_id,
      confirmed_by: context.userId,
      confirmed_role: "attorney",
    });
    return { ok: true as const };
  });

/* ------------------------- survivor: cutoff-warning notices ------------------------- */

export const listMyAccessNotices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await admin();
    const { data: notices, error } = await supabaseAdmin
      .from("attorney_access_notices")
      .select("id,link_id,notice_type,created_at,read_at,action,action_at")
      .eq("client_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    const rows = notices ?? [];
    const linkIds = Array.from(new Set(rows.map((n) => n.link_id)));
    const { data: links } = linkIds.length
      ? await supabaseAdmin
          .from("attorney_client_links")
          .select("id,attorney_user_id,status")
          .in("id", linkIds)
      : { data: [] as Array<{ id: string; attorney_user_id: string; status: string }> };
    const attorneyIds = Array.from(new Set((links ?? []).map((l) => l.attorney_user_id)));
    const { data: profiles } = attorneyIds.length
      ? await supabaseAdmin.from("attorney_profiles").select("user_id,full_name").in("user_id", attorneyIds)
      : { data: [] as Array<{ user_id: string; full_name: string | null }> };
    const linkById = new Map((links ?? []).map((l) => [l.id, l]));
    const nameByAttorney = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));
    return {
      notices: rows.map((n) => {
        const link = linkById.get(n.link_id);
        return {
          ...n,
          attorney_name: link ? (nameByAttorney.get(link.attorney_user_id) ?? "Your attorney") : "Your attorney",
          link_still_active: link?.status === "active",
        };
      }),
    };
  });

export const markAccessNoticeRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await admin();
    await supabaseAdmin
      .from("attorney_access_notices")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("client_user_id", context.userId);
    return { ok: true as const };
  });

/**
 * The survivor's one-tap "keep access going." In-app only — never emailed
 * or texted to anyone. Only works before the cutoff actually lands: once
 * status has flipped to 'cutoff' this cannot silently revive it, since that
 * would defeat the whole point of the reconfirmation cycle.
 */
export const keepAttorneyAccessGoing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ notice_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await admin();
    const { data: notice, error } = await supabaseAdmin
      .from("attorney_access_notices")
      .select("id,link_id,client_user_id,action_at")
      .eq("id", data.notice_id)
      .eq("client_user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!notice || notice.action_at) throw new Error("This notice is no longer actionable.");

    const { data: link } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id,status,client_user_id")
      .eq("id", notice.link_id)
      .maybeSingle();
    if (!link || link.client_user_id !== context.userId || link.status !== "active") {
      throw new Error("This access has already ended.");
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("attorney_client_links")
      .update({
        last_confirmed_at: now,
        reminder_150_sent_at: null,
        reminder_165_sent_at: null,
        reminder_175_sent_at: null,
        survivor_notice_sent_at: null,
      })
      .eq("id", notice.link_id);
    await supabaseAdmin.from("attorney_access_confirmations").insert({
      link_id: notice.link_id,
      confirmed_by: context.userId,
      confirmed_role: "survivor",
    });
    await supabaseAdmin
      .from("attorney_access_notices")
      .update({ action: "kept_access", action_at: now, read_at: now })
      .eq("id", data.notice_id);
    return { ok: true as const };
  });
