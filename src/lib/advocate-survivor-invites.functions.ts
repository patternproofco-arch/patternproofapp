import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
  return (user.user_metadata as { onboarding_complete?: boolean } | null | undefined)
    ?.onboarding_complete === true;
}

/* ---------- advocate → survivor invites ---------- */

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
    return { invite: row };
  });

export const listAdvocateSurvivorInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await requireAdvocate(context.userId);
    const { data, error } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .select(
        "id,survivor_email,survivor_name,personal_note,invite_token,status,expires_at,accepted_at,declined_at,created_at",
      )
      .eq("advocate_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const now = Date.now();
    const invites = (data ?? []).map((i) => ({
      ...i,
      effective_status:
        i.status === "pending" && i.expires_at && new Date(i.expires_at).getTime() < now
          ? ("expired" as const)
          : (i.status as "pending" | "accepted" | "revoked" | "declined" | "expired"),
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

    // If already accepted, also revoke the active grant so revoke is fail-closed.
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
      .select("id,invite_token,expires_at,survivor_email,status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Invite not found or already accepted.");
    return { invite: row };
  });

/* ---------- survivor side: peek + accept + decline ---------- */

export const peekAdvocateSurvivorInvite = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .select(
        "id,survivor_email,survivor_name,personal_note,advocate_user_id,status,expires_at",
      )
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
    const { data: inv } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .select("id,survivor_email,status,expires_at")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Invite not found");
    if (inv.status !== "pending") throw new Error("Invite no longer valid");
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) throw new Error("Invite expired");
    if (email !== String(inv.survivor_email).toLowerCase()) {
      throw new Error("This invite was sent to a different email address.");
    }

    const { error } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .update({ status: "declined", declined_at: new Date().toISOString() })
      .eq("id", inv.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acceptAdvocateSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        token: z.string().min(8).max(128),
        acknowledgements: z.object({
          who: z.literal(true),
          scope: z.literal(true),
          revoke: z.literal(true),
        }),
        scope: z
          .object({
            include_all_incidents: z.boolean(),
            include_all_evidence: z.boolean(),
            include_patterns: z.boolean(),
            scope_incidents: z.array(z.string().uuid()).max(2000).optional().default([]),
            scope_evidence: z.array(z.string().uuid()).max(2000).optional().default([]),
          })
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { email, user } = await verifiedAccountEmail(context.userId);
    // Fail closed: vault access unlocks only after onboarding is complete.
    if (!onboardingComplete(user)) {
      throw new Error(
        "Finish PatternProof onboarding before sharing vault access with an advocate.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("advocate_survivor_invites")
      .select("*")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Invite not found");
    if (inv.status !== "pending") throw new Error("Invite no longer valid");
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) throw new Error("Invite expired");
    if (email !== String(inv.survivor_email).toLowerCase()) {
      throw new Error("This invite was sent to a different email address.");
    }

    const scope = data.scope ?? {
      include_all_incidents: true,
      include_all_evidence: true,
      include_patterns: true,
      scope_incidents: [] as string[],
      scope_evidence: [] as string[],
    };
    if (!scope.include_all_incidents && (scope.scope_incidents ?? []).length) {
      const { data: ownedIncidents } = await supabaseAdmin
        .from("incidents")
        .select("id")
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .in("id", scope.scope_incidents ?? []);
      if ((ownedIncidents ?? []).length !== (scope.scope_incidents ?? []).length) {
        throw new Error("One or more selected incidents couldn't be shared.");
      }
    }
    if (!scope.include_all_evidence && (scope.scope_evidence ?? []).length) {
      const { data: ownedEvidence } = await supabaseAdmin
        .from("evidence")
        .select("id")
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .in("id", scope.scope_evidence ?? []);
      if ((ownedEvidence ?? []).length !== (scope.scope_evidence ?? []).length) {
        throw new Error("One or more selected evidence files couldn't be shared.");
      }
    }

    const linkPayload = {
      advocate_user_id: inv.advocate_user_id as string,
      client_user_id: context.userId,
      survivor_invite_id: inv.id as string,
      include_all_incidents: scope.include_all_incidents,
      include_all_evidence: scope.include_all_evidence,
      include_patterns: scope.include_patterns,
      scope_incidents: scope.include_all_incidents ? [] : (scope.scope_incidents ?? []),
      scope_evidence: scope.include_all_evidence ? [] : (scope.scope_evidence ?? []),
      expires_at: inv.expires_at ?? null,
      status: "active",
      revoked_at: null as string | null,
    };

    const { data: existing } = await supabaseAdmin
      .from("advocate_client_links")
      .select("id")
      .eq("advocate_user_id", inv.advocate_user_id)
      .eq("client_user_id", context.userId)
      .maybeSingle();

    let linkId = existing?.id ?? null;
    if (linkId) {
      const { error: updateErr } = await supabaseAdmin
        .from("advocate_client_links")
        .update(linkPayload)
        .eq("id", linkId);
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

    return { ok: true };
  });
