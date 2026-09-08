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
