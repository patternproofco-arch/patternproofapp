import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const peekSurvivorInvite = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("attorney_survivor_invites")
      .select("id,survivor_email,survivor_name,personal_note,attorney_user_id,status,expires_at")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) return { status: "not-found" as const };
    if (inv.status !== "pending") return { status: inv.status as "accepted" | "revoked" };
    if (inv.expires_at && new Date(inv.expires_at) < new Date())
      return { status: "expired" as const };
    const { data: prof } = await supabaseAdmin
      .from("attorney_profiles")
      .select("full_name,firm_name")
      .eq("user_id", inv.attorney_user_id)
      .maybeSingle();
    return {
      status: "ok" as const,
      invite: {
        id: inv.id,
        survivor_email: inv.survivor_email,
        survivor_name: inv.survivor_name,
        personal_note: inv.personal_note,
        attorney_name: prof?.full_name ?? null,
        firm_name: prof?.firm_name ?? null,
      },
    };
  });

export const acceptSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        token: z.string().min(8).max(128),
        is_my_attorney: z.literal(true),
        scope: z.object({
          include_all_incidents: z.boolean().default(false),
          include_all_evidence: z.boolean().default(false),
          include_patterns: z.boolean().default(false),
          scope_incidents: z.array(z.string().uuid()).max(2000).optional().default([]),
          scope_evidence: z.array(z.string().uuid()).max(2000).optional().default([]),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("attorney_survivor_invites")
      .select("*")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Invite not found");
    if (inv.status !== "pending") throw new Error("Invite no longer valid");
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) throw new Error("Invite expired");
    const jwtEmail = (context.claims as { email?: string } | undefined)?.email?.toLowerCase();
    if (!jwtEmail || jwtEmail !== String(inv.survivor_email).toLowerCase()) {
      throw new Error("This invite was sent to a different email address.");
    }
    const { assertAttorneyVerified, assertNotLegalAidOrgWidePull } =
      await import("@/lib/professional-verification.server");
    await assertAttorneyVerified(supabaseAdmin, inv.attorney_user_id);
    await assertNotLegalAidOrgWidePull(supabaseAdmin, inv.attorney_user_id);
    const scope = data.scope;
    const empty = !(
      scope.include_all_incidents ||
      scope.include_all_evidence ||
      scope.include_patterns ||
      (scope.scope_incidents ?? []).length ||
      (scope.scope_evidence ?? []).length
    );
    if (empty) throw new Error("Choose at least one thing to share before accepting.");
    // Normalize both directions onto a survivor-confirmed invitation record.
    const { data: account, error: accountError } = await supabaseAdmin.auth.admin.getUserById(
      inv.attorney_user_id,
    );
    if (accountError || !account.user?.email || !account.user.email_confirmed_at)
      throw new Error("Attorney email is not verified.");
    const { data: confirmation, error: confirmationError } = await supabaseAdmin
      .from("attorney_invitations")
      .insert({
        client_user_id: context.userId,
        attorney_email: account.user.email.toLowerCase(),
        survivor_confirmed_attorney_at: new Date().toISOString(),
        survivor_confirmed_attorney_by: context.userId,
        include_all_incidents: scope.include_all_incidents,
        include_all_evidence: scope.include_all_evidence,
        include_patterns: scope.include_patterns,
        scope_incidents: scope.scope_incidents,
        scope_evidence: scope.scope_evidence,
        expires_at: inv.expires_at,
      })
      .select("id")
      .single();
    if (confirmationError) throw new Error(confirmationError.message);
    const linkPayload = {
      invitation_id: confirmation.id,
      expires_at: inv.expires_at,
      case_engagement_confirmed_at: new Date().toISOString(),
      case_engagement_confirmed_by: inv.attorney_user_id,
      attorney_user_id: inv.attorney_user_id,
      client_user_id: context.userId,
      include_all_incidents: scope.include_all_incidents,
      include_all_evidence: scope.include_all_evidence,
      include_patterns: scope.include_patterns,
      scope_incidents: scope.include_all_incidents ? [] : (scope.scope_incidents ?? []),
      scope_evidence: scope.include_all_evidence ? [] : (scope.scope_evidence ?? []),
      status: "active",
    };
    const { error: linkErr } = await supabaseAdmin
      .from("attorney_client_links")
      .insert(linkPayload);
    if (linkErr && !String(linkErr.message).toLowerCase().includes("duplicate"))
      throw new Error(linkErr.message);
    if (linkErr) {
      const { error: updateErr } = await supabaseAdmin
        .from("attorney_client_links")
        .update({
          invitation_id: confirmation.id,
          expires_at: inv.expires_at,
          case_engagement_confirmed_at: linkPayload.case_engagement_confirmed_at,
          case_engagement_confirmed_by: inv.attorney_user_id,
          include_all_incidents: linkPayload.include_all_incidents,
          include_all_evidence: linkPayload.include_all_evidence,
          include_patterns: linkPayload.include_patterns,
          scope_incidents: linkPayload.scope_incidents,
          scope_evidence: linkPayload.scope_evidence,
          status: "active",
        })
        .eq("attorney_user_id", inv.attorney_user_id)
        .eq("client_user_id", context.userId);
      if (updateErr) throw new Error(updateErr.message);
    }
    await supabaseAdmin
      .from("attorney_survivor_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: context.userId,
      })
      .eq("id", inv.id);
    return { ok: true };
  });
