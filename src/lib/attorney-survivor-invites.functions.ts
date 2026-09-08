import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireAttorney(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "attorney")
    .maybeSingle();
  if (!data) throw new Error("This area is for attorneys.");
  return supabaseAdmin;
}

function scopeIsEmpty(scope: {
  include_all_incidents: boolean;
  include_all_evidence: boolean;
  include_patterns: boolean;
  scope_incidents?: string[];
  scope_evidence?: string[];
}) {
  return !(
    scope.include_all_incidents ||
    scope.include_all_evidence ||
    scope.include_patterns ||
    (scope.scope_incidents ?? []).length > 0 ||
    (scope.scope_evidence ?? []).length > 0
  );
}

async function sendAttorneySurvivorInviteEmail(input: {
  attorneyUserId: string;
  survivorEmail: string;
  survivorName?: string | null;
  personalNote?: string | null;
  token: string;
  inviteId: string;
  expiresDays: number;
  resend?: boolean;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const origin =
    process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.SITE_URL?.replace(/\/$/, "") ||
    "https://pattern-proof.tech";
  const { data: prof } = await supabaseAdmin
    .from("attorney_profiles")
    .select("full_name,firm_name")
    .eq("user_id", input.attorneyUserId)
    .maybeSingle();
  const { deliverTransactionalEmail } = await import("@/lib/email/deliver-transactional.server");
  return deliverTransactionalEmail({
    templateName: "attorney-survivor-invitation",
    recipientEmail: input.survivorEmail,
    idempotencyKey: input.resend
      ? `attorney-survivor-invitation-resend-${input.inviteId}-${Date.now()}`
      : `attorney-survivor-invitation-${input.inviteId}`,
    templateData: {
      attorneyName: prof?.full_name ?? undefined,
      firmName: prof?.firm_name ?? undefined,
      survivorName: input.survivorName ?? undefined,
      personalNote: input.personalNote ?? undefined,
      acceptUrl: `${origin}/survivor-invite/${input.token}`,
      expiresLabel: `${input.expiresDays} days`,
    },
  });
}

/* ---------- attorney → survivor invites ---------- */

export const createSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        survivor_email: z.string().email().max(255),
        survivor_name: z.string().trim().max(120).optional().nullable(),
        personal_note: z.string().trim().max(2000).optional().nullable(),
        expires_days: z.number().int().min(1).max(365).default(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAttorney(context.userId);
    const expires = new Date(Date.now() + data.expires_days * 86400000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("attorney_survivor_invites")
      .insert({
        attorney_user_id: context.userId,
        survivor_email: data.survivor_email.toLowerCase(),
        survivor_name: data.survivor_name ?? null,
        personal_note: data.personal_note ?? null,
        expires_at: expires,
      })
      .select("id,invite_token,expires_at,survivor_email,status,created_at")
      .single();
    if (error) throw new Error(error.message);
    const delivery = await sendAttorneySurvivorInviteEmail({
      attorneyUserId: context.userId,
      survivorEmail: row.survivor_email,
      survivorName: data.survivor_name,
      personalNote: data.personal_note,
      token: row.invite_token,
      inviteId: row.id,
      expiresDays: data.expires_days,
    });
    return {
      invite: row,
      email_sent: delivery.sent,
      email_error: delivery.error ?? null,
    };
  });
