import { isLiveAdvocateShare } from "@/lib/advocate-access.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  acceptInviteSchema,
  acceptScopeSchema,
  assertInviteUsable,
  assertScopeChosen,
  buildGrantPayload,
  resolveInviteEffectiveStatus,
  type InviteRow,
} from "@/lib/advocate-survivor-invites.server";

async function requireAdvocate(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "advocate")
    .maybeSingle();
  if (!role) throw new Error("This area is for advocates.");
  return supabaseAdmin;
}

async function verifiedAccountEmail(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = data.user?.email?.trim().toLowerCase();
  if (error || !email || !data.user.email_confirmed_at) {
    throw new Error("A verified account email is required to accept this invitation.");
  }
  return { email, user: data.user };
}

function onboardingComplete(user: { user_metadata?: Record<string, unknown> | null }) {
  return (
    (user.user_metadata as { onboarding_complete?: boolean } | null | undefined)
      ?.onboarding_complete === true
  );
}

async function sendAdvocateSurvivorInviteEmail(input: {
  advocateUserId: string;
  survivorEmail: string;
  survivorName?: string | null;
  personalNote?: string | null;
  token: string;
  inviteId: string;
  expiresDays: number;
  resend?: boolean;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getEmailSiteOrigin } = await import("@/lib/email/site-origin.server");
  const origin = getEmailSiteOrigin();
  const { data: prof } = await supabaseAdmin
    .from("advocate_profiles")
    .select("full_name,org_name")
    .eq("user_id", input.advocateUserId)
    .maybeSingle();
  const { deliverTransactionalEmail } = await import("@/lib/email/deliver-transactional.server");
  const delivery = await deliverTransactionalEmail({
    templateName: "advocate-survivor-invitation",
    recipientEmail: input.survivorEmail,
    idempotencyKey: input.resend
      ? `advocate-survivor-invitation-resend-${input.inviteId}-${Date.now()}`
      : `advocate-survivor-invitation-${input.inviteId}`,
    templateData: {
      advocateName: prof?.full_name ?? undefined,
      orgName: prof?.org_name ?? undefined,
      survivorName: input.survivorName ?? undefined,
      personalNote: input.personalNote ?? undefined,
      acceptUrl: `${origin}/advocate-survivor-invite/${input.token}`,
      expiresLabel: `${input.expiresDays} days`,
    },
  });
  await supabaseAdmin
    .from("advocate_survivor_invites")
    .update({
      email_status: delivery.sent ? "sent" : "failed",
      email_last_attempt_at: new Date().toISOString(),
      email_last_error: delivery.sent
        ? null
        : (delivery.error ?? "Delivery could not be confirmed."),
    })
    .eq("id", input.inviteId);
  return delivery;
}

export const createAdvocateSurvivorInvite = createServerFn({ method: "POST" })
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
    const supabaseAdmin = await requireAdvocate(context.userId);
    const expires = new Date(Date.now() + data.expires_days * 86400000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .insert({
        advocate_user_id: context.userId,
        survivor_email: data.survivor_email.toLowerCase(),
        survivor_name: data.survivor_name ?? null,
        personal_note: data.personal_note ?? null,
        expires_at: expires,
      })
      .select("id,invite_token,expires_at,survivor_email,status,created_at")
      .single();
    if (error) throw new Error(error.message);
    const delivery = await sendAdvocateSurvivorInviteEmail({
      advocateUserId: context.userId,
      survivorEmail: row.survivor_email,
      survivorName: data.survivor_name,
      personalNote: data.personal_note,
      token: row.invite_token,
      inviteId: row.id,
      expiresDays: data.expires_days,
    });
    return { invite: row, email_sent: delivery.sent, email_error: delivery.error ?? null };
  });

export const listAdvocateSurvivorInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await requireAdvocate(context.userId);
    const { data, error } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .select(
        "id,survivor_email,survivor_name,personal_note,invite_token,status,expires_at,accepted_at,declined_at,created_at,email_status,email_last_attempt_at,email_last_error",
      )
      .eq("advocate_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const inviteIds = rows.map((i) => i.id);
    const now = Date.now();
    const grantByInvite = new Map<
      string,
      { status: string; expires_at: string | null; revoked_at: string | null }
    >();
    if (inviteIds.length) {
      const { data: links, error: linkErr } = await supabaseAdmin
        .from("advocate_client_links")
        .select("survivor_invite_id,status,expires_at,revoked_at")
        .eq("advocate_user_id", context.userId)
        .in("survivor_invite_id", inviteIds);
      if (linkErr) throw new Error(linkErr.message);
      for (const link of links ?? []) {
        if (!link.survivor_invite_id) continue;
        // Prefer an active grant if multiple rows exist for the same invite.
        const prev = grantByInvite.get(link.survivor_invite_id);
        if (!prev || (!isLiveAdvocateShare(prev, now) && isLiveAdvocateShare(link, now))) {
          grantByInvite.set(link.survivor_invite_id, {
            status: link.status,
            revoked_at: link.revoked_at,
            expires_at: link.expires_at ?? null,
          });
        }
      }
    }

    const invites = rows.map((i) => ({
      ...i,
      effective_status: resolveInviteEffectiveStatus({
        inviteStatus: i.status,
        expiresAt: i.expires_at,
        grant: grantByInvite.get(i.id) ?? null,
        now,
      }),
    }));
    return { invites };
  });

export const revokeAdvocateSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdvocate(context.userId);
    const { data: inv, error: findErr } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .select("id,status,accepted_by")
      .eq("id", data.id)
      .eq("advocate_user_id", context.userId)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!inv) throw new Error("Invite not found");

    const { error } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("advocate_user_id", context.userId);
    if (error) throw new Error(error.message);

    if (inv.accepted_by) {
      await supabaseAdmin
        .from("advocate_client_links")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("advocate_user_id", context.userId)
        .eq("client_user_id", inv.accepted_by)
        .eq("status", "active");
    } else {
      await supabaseAdmin
        .from("advocate_client_links")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("advocate_user_id", context.userId)
        .eq("survivor_invite_id", inv.id)
        .eq("status", "active");
    }

    return { ok: true };
  });

export const resendAdvocateSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        expires_days: z.number().int().min(1).max(365).default(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdvocate(context.userId);
    const expires = new Date(Date.now() + data.expires_days * 86400000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .update({
        status: "pending",
        expires_at: expires,
        declined_at: null,
        accepted_at: null,
        accepted_by: null,
      })
      .eq("id", data.id)
      .eq("advocate_user_id", context.userId)
      .in("status", ["pending", "revoked", "declined"])
      .select("id,invite_token,expires_at,survivor_email,status,survivor_name,personal_note")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Invite not found or already accepted.");
    const delivery = await sendAdvocateSurvivorInviteEmail({
      advocateUserId: context.userId,
      survivorEmail: row.survivor_email,
      survivorName: row.survivor_name,
      personalNote: row.personal_note,
      token: row.invite_token,
      inviteId: row.id,
      expiresDays: data.expires_days,
      resend: true,
    });
    return { invite: row, email_sent: delivery.sent, email_error: delivery.error ?? null };
  });

export const recordAdvocateInviteEmailResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        sent: z.boolean(),
        error: z.string().trim().max(300).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdvocate(context.userId);
    const { error } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .update({
        email_status: data.sent ? "sent" : "failed",
        email_last_attempt_at: new Date().toISOString(),
        email_last_error: data.sent ? null : (data.error ?? "Delivery could not be confirmed."),
      })
      .eq("id", data.id)
      .eq("advocate_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const, email_status: data.sent ? "sent" : "failed" };
  });

export const peekAdvocateSurvivorInvite = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .select("id,survivor_email,survivor_name,personal_note,advocate_user_id,status,expires_at")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) return { status: "not-found" as const };
    if (inv.status === "declined") return { status: "declined" as const };
    if (inv.status !== "pending") return { status: inv.status as "accepted" | "revoked" };
    if (inv.expires_at && new Date(inv.expires_at) < new Date())
      return { status: "expired" as const };

    const { data: prof } = await supabaseAdmin
      .from("advocate_profiles")
      .select("full_name,org_name")
      .eq("user_id", inv.advocate_user_id)
      .maybeSingle();

    return {
      status: "ok" as const,
      invite: {
        id: inv.id,
        survivor_email: inv.survivor_email,
        survivor_name: inv.survivor_name,
        personal_note: inv.personal_note,
        advocate_name: prof?.full_name ?? null,
        org_name: prof?.org_name ?? null,
      },
    };
  });

export const declineAdvocateSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    const { email } = await verifiedAccountEmail(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: found } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .select("id,survivor_email,status,expires_at")
      .eq("invite_token", data.token)
      .maybeSingle();
    const inv = found as InviteRow | null;
    assertInviteUsable(inv, email);

    const { error } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .update({ status: "declined", declined_at: new Date().toISOString() })
      .eq("id", inv.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ADVOCATE_HINT =
  "To include a private entry, mark it \u201cOK to share later\u201d in your journal first.";

/**
 * What accepting an advocate invite shares. Preview and accept both call this.
 * The advocate screen has no per-item "authorize for this invite" choice (its copy says
 * kept-private entries are not included), so per-item ids never authorize a private
 * item here, and anything pre-filled on the invite row never does either.
 */
async function resolveAdvocateAcceptScope(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  survivorId: string,
  inv: Record<string, unknown>,
  scope: z.infer<typeof acceptScopeSchema>,
) {
  const { resolveInviteAcceptScope, prefillFromInviteRow } = await import(
    "@/lib/sharing/invite-accept-scope.server"
  );
  return resolveInviteAcceptScope(admin, survivorId, {
    survivorChoice: scope,
    invitePrefill: prefillFromInviteRow(inv),
    authorizeSurvivorPicks: false,
  });
}

/** What accepting would share right now. Writes nothing. */
export const previewAdvocateSurvivorInviteScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ token: z.string().min(8).max(128), scope: acceptScopeSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { email } = await verifiedAccountEmail(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: found } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .select("*")
      .eq("invite_token", data.token)
      .maybeSingle();
    const inv = found as (InviteRow & Record<string, unknown>) | null;
    assertInviteUsable(inv, email);
    const r = await resolveAdvocateAcceptScope(supabaseAdmin, context.userId, inv, data.scope);
    return {
      shared: { incidents: r.scope_incidents.length, files: r.scope_evidence.length },
      include_patterns: r.include_patterns,
      excluded: r.excluded,
    };
  });

export const acceptAdvocateSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => acceptInviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { email, user } = await verifiedAccountEmail(context.userId);
    if (!onboardingComplete(user)) {
      throw new Error(
        "Finish PatternProof onboarding before sharing vault access with an advocate.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: found } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .select("*")
      .eq("invite_token", data.token)
      .maybeSingle();
    const inv = found as (InviteRow & Record<string, unknown>) | null;
    assertInviteUsable(inv, email);

    const scope = data.scope;
    assertScopeChosen(scope);
    // Count in batches: one request with hundreds of ids is rejected, which used to
    // surface as a misleading "couldn't be shared" for any large selection.
    const { countInChunks } = await import("@/lib/in-chunks.server");
    const pickedIncidents = Array.from(new Set(scope.scope_incidents ?? []));
    if (!scope.include_all_incidents && pickedIncidents.length) {
      const owned = await countInChunks(
        pickedIncidents,
        (chunk) =>
          supabaseAdmin
            .from("incidents")
            .select("id", { count: "exact", head: true })
            .eq("user_id", context.userId)
            .is("deleted_at", null)
            .in("id", chunk),
        { what: "selected incident" },
      );
      if (owned !== pickedIncidents.length) {
        throw new Error("One or more selected incidents couldn't be shared.");
      }
    }
    const pickedEvidence = Array.from(new Set(scope.scope_evidence ?? []));
    if (!scope.include_all_evidence && pickedEvidence.length) {
      const owned = await countInChunks(
        pickedEvidence,
        (chunk) =>
          supabaseAdmin
            .from("evidence")
            .select("id", { count: "exact", head: true })
            .eq("user_id", context.userId)
            .is("deleted_at", null)
            .in("id", chunk),
        { what: "selected file" },
      );
      if (owned !== pickedEvidence.length) {
        throw new Error("One or more selected evidence files couldn't be shared.");
      }
    }

    // Freeze "all entries" into explicit ids before the grant is written, so
    // nothing the survivor documents later is shared without them choosing it.
    // Same helper as the preview, so what she was shown is what is written.
    const frozenScope = await resolveAdvocateAcceptScope(supabaseAdmin, context.userId, inv, scope);
    // Refuse before writing the link or marking the invite accepted, so she can retry.
    const { assertAcceptWouldShare } = await import("@/lib/sharing/invite-accept-scope.server");
    assertAcceptWouldShare(scope, frozenScope, ADVOCATE_HINT);
    const linkPayload = buildGrantPayload(inv, context.userId, {
      ...scope,
      include_all_incidents: false,
      include_all_evidence: false,
      scope_incidents: frozenScope.scope_incidents,
      scope_evidence: frozenScope.scope_evidence,
    });

    // One row per advocate/survivor pair. A re-accept overwrites that row ENTIRELY with
    // this consent: scope ids and include_* replaced (never merged), expires_at reset to
    // this invite, revoked_at cleared deliberately (she is consenting again now), and
    // nothing inherited from the old relationship (case, invitation, org-admin visibility).
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("advocate_client_links")
      .select("id,status,revoked_at,expires_at,scope_incidents,scope_evidence")
      .eq("advocate_user_id", inv.advocate_user_id)
      .eq("client_user_id", context.userId)
      .maybeSingle();
    if (existingErr) throw new Error("We couldn't check the existing share. Nothing was changed. Try again.");
    // Copy the previous state now, before the row is overwritten.
    const previous = existing
      ? {
          id: existing.id as string,
          status: (existing.status as string | null) ?? null,
          revoked_at: (existing.revoked_at as string | null) ?? null,
          expires_at: (existing.expires_at as string | null) ?? null,
          incidents: ((existing.scope_incidents as string[] | null) ?? []).length,
          files: ((existing.scope_evidence as string[] | null) ?? []).length,
        }
      : null;

    let linkId = previous?.id ?? null;
    if (linkId) {
      const { error: updateErr } = await supabaseAdmin
        .from("advocate_client_links")
        .update({
          ...linkPayload,
          revoked_at: null,
          case_id: null,
          invitation_id: null,
          org_admin_visibility: false,
          org_visibility_updated_at: null,
        })
        .eq("id", linkId)
        .eq("client_user_id", context.userId);
      if (updateErr) throw new Error(updateErr.message);
    } else {
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("advocate_client_links")
        .insert(linkPayload)
        .select("id")
        .single();
      if (linkErr) throw new Error(linkErr.message);
      linkId = link.id;
    }

    const { error: invErr } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: context.userId,
        declined_at: null,
      })
      .eq("id", inv.id)
      .eq("status", "pending");
    if (invErr) throw new Error(invErr.message);

    await supabaseAdmin.rpc("record_audit_event", {
      p_user_id: context.userId,
      p_event_type: "advocate_access_granted",
      p_subject_kind: "advocate_client_link",
      p_subject_id: linkId,
      p_actor_kind: "survivor",
      p_actor_id: context.userId,
      p_meta: {
        via: "advocate_survivor_invite",
        invite_id: inv.id,
        advocate_user_id: inv.advocate_user_id,
      },
    });
    const { recordShareConsent } = await import("@/lib/sharing/consent-receipt.server");
    await recordShareConsent(supabaseAdmin, {
      table: "advocate_client_links",
      linkId: linkId as string,
      survivorUserId: context.userId,
      actorKind: "survivor",
      actorId: context.userId,
      invitationId: inv.id,
      direction: "survivor",
      scope: {
        scope_incidents: frozenScope.scope_incidents,
        scope_evidence: frozenScope.scope_evidence,
        include_patterns: scope.include_patterns === true,
      },
      expiresAt: linkPayload.expires_at,
      replaced: previous,
    });

    return {
      ok: true,
      shared: {
        incidents: (frozenScope.scope_incidents ?? []).length,
        files: (frozenScope.scope_evidence ?? []).length,
      },
      excluded: frozenScope.excluded,
    };
  });
