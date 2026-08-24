import { createHash, randomBytes } from "crypto";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  canChangeMemberRole,
  canInviteRole,
  canRemoveMember,
  type ManagedTeamRole,
  type TeamRole,
} from "@/lib/team-permissions";
import { enqueueTeamInvitation, recordTeamAudit, runTeamRpc } from "@/lib/team-invitations.server";
import { firmSeatsForSubscription } from "@/lib/firm-seats";

function newInvitationToken() {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function verifiedAccountEmail(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = data.user?.email?.trim().toLowerCase();
  if (error || !email || !data.user.email_confirmed_at) {
    throw new Error("A verified account email is required to accept this invitation.");
  }
  return email;
}

async function currentFirmMembership(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("firm_members")
    .select("firm_id,role,joined_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function assertFirmManager(userId: string) {
  const member = await currentFirmMembership(userId);
  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    throw new Error("Only a firm owner or administrator can manage members.");
  }
  return member;
}

async function currentFirmSeatEntitlement(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subscription, error } = await supabaseAdmin
    .from("subscriptions")
    .select("price_id,status,current_period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return firmSeatsForSubscription({
    priceId: subscription?.price_id,
    status: subscription?.status,
    currentPeriodEnd: subscription?.current_period_end,
  });
}

/* ------------------------ firm membership ------------------------ */

export const getMyFirm = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, membership] = await Promise.all([
      supabaseAdmin
        .from("attorney_profiles")
        .select("user_id,full_name,email,firm_name")
        .eq("user_id", context.userId)
        .maybeSingle(),
      currentFirmMembership(context.userId),
    ]);
    if (!membership)
      return {
        profile: profile ?? null,
        firm: null,
        membership: null,
        colleagues: [],
        members: [],
        invitations: [],
        audit: [],
      };
    const { data: firm, error: firmError } = await supabaseAdmin
      .from("firms")
      .select("id,name,created_at,seats_included,seats_purchased")
      .eq("id", membership.firm_id)
      .maybeSingle();
    if (firmError) throw new Error(firmError.message);
    const { data: members, error: membersError } = await supabaseAdmin
      .from("firm_members")
      .select("user_id,role,joined_at")
      .eq("firm_id", membership.firm_id);
    if (membersError) throw new Error(membersError.message);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles, error: profilesError } = ids.length
      ? await supabaseAdmin
          .from("attorney_profiles")
          .select("user_id,full_name,email,role")
          .in("user_id", ids)
      : { data: [], error: null };
    if (profilesError) throw new Error(profilesError.message);
    const roleByUser = new Map((members ?? []).map((m) => [m.user_id, m.role]));
    const profileByUser = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    const authEmails = new Map<string, string | null>();
    await Promise.all(
      (members ?? []).map(async (m) => {
        const { data } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
        authEmails.set(m.user_id, data.user?.email ?? null);
      }),
    );
    const [{ data: invitations }, { data: audit }] = await Promise.all([
      supabaseAdmin
        .from("firm_member_invitations")
        .select("id,email,role,status,expires_at,created_at,invited_by")
        .eq("firm_id", membership.firm_id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("audit_events")
        .select("id,event_type,actor_id,meta,created_at")
        .eq("subject_kind", "firm")
        .eq("subject_id", membership.firm_id)
        .like("event_type", "team.%")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    const teamMembers = (members ?? []).map((m) => ({
      ...m,
      full_name: profileByUser.get(m.user_id)?.full_name ?? null,
      email: profileByUser.get(m.user_id)?.email ?? authEmails.get(m.user_id) ?? null,
      is_current_user: m.user_id === context.userId,
    }));
    return {
      profile: profile ?? null,
      firm: firm ?? null,
      membership,
      colleagues: (profiles ?? [])
        .filter((p) => p.user_id !== context.userId)
        .map((p) => ({ ...p, membership_role: roleByUser.get(p.user_id) ?? "member" })),
      members: teamMembers,
      invitations:
        membership.role === "owner" || membership.role === "admin" ? (invitations ?? []) : [],
      audit: membership.role === "owner" || membership.role === "admin" ? (audit ?? []) : [],
    };
  });

/** Creates a new firm and its initial owner seat. It never joins by firm name. */
export const setMyFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ name: z.string().trim().min(2).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: attorneyRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "attorney")
      .maybeSingle();
    if (!attorneyRole) throw new Error("A verified attorney account is required.");
    if (await currentFirmMembership(context.userId)) {
      throw new Error(
        "You already belong to a firm. Ask an owner to remove you before creating another.",
      );
    }
    const seatsIncluded = await currentFirmSeatEntitlement(context.userId);
    if (!seatsIncluded) {
      throw new Error("An active Firm plan is required to create a firm team.");
    }
    const name = data.name.trim();
    const { data: firm, error: firmError } = await supabaseAdmin
      .from("firms")
      .insert({ name, created_by: context.userId, seats_included: seatsIncluded })
      .select("id")
      .single();
    if (firmError || !firm) throw new Error(firmError?.message ?? "Could not create firm.");
    const { error: memberError } = await supabaseAdmin
      .from("firm_members")
      .insert({ firm_id: firm.id, user_id: context.userId, role: "owner" });
    if (memberError) throw new Error(memberError.message);
    // This is display-only legacy metadata. Authorization never reads it.
    await supabaseAdmin
      .from("attorney_profiles")
      .update({ firm_id: firm.id, firm_name: name, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    await recordTeamAudit({
      actorId: context.userId,
      actorKind: "attorney",
      eventType: "team.firm_created",
      subjectKind: "firm",
      subjectId: firm.id,
    });
    return { ok: true, firm_id: firm.id };
  });

export const leaveMyFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const membership = await currentFirmMembership(context.userId);
    if (!membership) return { ok: true };
    if (membership.role === "owner") {
      throw new Error("Firm owners cannot leave. Transfer ownership or remove the firm first.");
    }
    await runTeamRpc("remove_firm_member", {
      p_firm_id: membership.firm_id,
      p_actor_id: context.userId,
      p_target_user_id: context.userId,
    });
    return { ok: true };
  });

/** Owner/admin-only, email-bound, short-lived, single-use invitation. */
export const createFirmMemberInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(255),
        role: z.enum(["admin", "member"]).default("member"),
        expires_days: z.number().int().min(1).max(30).default(7),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const manager = await assertFirmManager(context.userId);
    if (!canInviteRole(manager.role as TeamRole, data.role)) {
      throw new Error("Only the firm owner can invite an administrator.");
    }
    const email = data.email.trim().toLowerCase();
    const { error: revokeError } = await supabaseAdmin
      .from("firm_member_invitations")
      .update({ status: "revoked" })
      .eq("firm_id", manager.firm_id)
      .eq("email", email)
      .eq("status", "pending");
    if (revokeError) throw new Error(revokeError.message);
    const token = newInvitationToken();
    const { data: invitation, error } = await supabaseAdmin
      .from("firm_member_invitations")
      .insert({
        firm_id: manager.firm_id,
        email,
        token_hash: hashToken(token),
        invited_by: context.userId,
        role: data.role,
        expires_at: new Date(Date.now() + data.expires_days * 86_400_000).toISOString(),
      })
      .select("id,expires_at")
      .single();
    if (error || !invitation) throw new Error(error?.message ?? "Could not create invitation.");
    const { data: firm } = await supabaseAdmin
      .from("firms")
      .select("name")
      .eq("id", manager.firm_id)
      .single();
    let acceptUrl: string;
    try {
      ({ acceptUrl } = await enqueueTeamInvitation({
        invitationId: invitation.id,
        email,
        teamName: firm?.name ?? "your firm",
        teamKind: "firm",
        role: data.role,
        token,
        expiresDays: data.expires_days,
      }));
    } catch (error) {
      await supabaseAdmin
        .from("firm_member_invitations")
        .update({ status: "revoked" })
        .eq("id", invitation.id);
      throw error;
    }
    await recordTeamAudit({
      actorId: context.userId,
      actorKind: "attorney",
      eventType: "team.firm_invitation_sent",
      subjectKind: "firm",
      subjectId: manager.firm_id,
      meta: { invitation_id: invitation.id, role: data.role },
    });
    return {
      invitation: { ...invitation, email, role: data.role, status: "pending" as const },
      acceptUrl,
    };
  });

export const acceptFirmMemberInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(20).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const email = await verifiedAccountEmail(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if ((existingRoles ?? []).some((r) => r.role !== "attorney")) {
      throw new Error("Use a separate verified attorney login for firm access.");
    }
    const { data: firmId, error } = await supabaseAdmin.rpc("accept_firm_member_invitation", {
      p_token_hash: hashToken(data.token),
      p_user_id: context.userId,
      p_email: email,
    });
    if (error || !firmId) throw new Error(error?.message ?? "Could not accept invitation.");
    await recordTeamAudit({
      actorId: context.userId,
      actorKind: "attorney",
      eventType: "team.firm_invitation_accepted",
      subjectKind: "firm",
      subjectId: firmId,
    });
    return { ok: true, firm_id: firmId };
  });

export const revokeFirmMemberInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const manager = await assertFirmManager(context.userId);
    const { data: invitation } = await supabaseAdmin
      .from("firm_member_invitations")
      .select("id,status")
      .eq("id", data.id)
      .eq("firm_id", manager.firm_id)
      .maybeSingle();
    if (!invitation || invitation.status !== "pending")
      throw new Error("Pending invitation not found.");
    const { error } = await supabaseAdmin
      .from("firm_member_invitations")
      .update({ status: "revoked" })
      .eq("id", invitation.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    await recordTeamAudit({
      actorId: context.userId,
      actorKind: "attorney",
      eventType: "team.firm_invitation_revoked",
      subjectKind: "firm",
      subjectId: manager.firm_id,
      meta: { invitation_id: invitation.id },
    });
    return { ok: true as const };
  });

export const changeFirmMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ user_id: z.string().uuid(), role: z.enum(["admin", "member"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const manager = await assertFirmManager(context.userId);
    const { data: target } = await supabaseAdmin
      .from("firm_members")
      .select("role")
      .eq("firm_id", manager.firm_id)
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (
      !target ||
      !canChangeMemberRole(
        manager.role as TeamRole,
        target.role as TeamRole,
        data.role as ManagedTeamRole,
      )
    ) {
      throw new Error("You cannot change this member's role.");
    }
    await runTeamRpc("change_firm_member_role", {
      p_firm_id: manager.firm_id,
      p_actor_id: context.userId,
      p_target_user_id: data.user_id,
      p_role: data.role,
    });
    return { ok: true as const };
  });

export const removeFirmMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const manager = await assertFirmManager(context.userId);
    const { data: target } = await supabaseAdmin
      .from("firm_members")
      .select("role")
      .eq("firm_id", manager.firm_id)
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!target || !canRemoveMember(manager.role as TeamRole, target.role as TeamRole)) {
      throw new Error("You cannot remove this member.");
    }
    await runTeamRpc("remove_firm_member", {
      p_firm_id: manager.firm_id,
      p_actor_id: context.userId,
      p_target_user_id: data.user_id,
    });
    return { ok: true as const };
  });

/* ------------------------ case grants ------------------------ */

async function assertOwnerLink(clientId: string, ownerId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: link } = await supabaseAdmin
    .from("attorney_client_links")
    .select("id,attorney_user_id,client_user_id,status")
    .eq("attorney_user_id", ownerId)
    .eq("client_user_id", clientId)
    .maybeSingle();
  if (!link || link.status !== "active") throw new Error("No active case");
  return link;
}

export const listFirmColleagues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwnerLink(data.clientId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mine = await currentFirmMembership(context.userId);
    if (!mine) return { colleagues: [], firm_id: null };
    const { data: members, error: memberError } = await supabaseAdmin
      .from("firm_members")
      .select("user_id,role")
      .eq("firm_id", mine.firm_id)
      .neq("user_id", context.userId);
    if (memberError) throw new Error(memberError.message);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: colleagues, error: profileError } = ids.length
      ? await supabaseAdmin
          .from("attorney_profiles")
          .select("user_id,full_name,email,role")
          .in("user_id", ids)
      : { data: [], error: null };
    if (profileError) throw new Error(profileError.message);
    const membershipRoles = new Map((members ?? []).map((m) => [m.user_id, m.role]));
    return {
      colleagues: (colleagues ?? []).map((c) => ({
        ...c,
        membership_role: membershipRoles.get(c.user_id),
      })),
      firm_id: mine.firm_id,
    };
  });

export const listCaseGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const link = await assertOwnerLink(data.clientId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: grants, error } = await supabaseAdmin
      .from("case_grants")
      .select("id,attorney_user_id,granted_at,revoked_at")
      .eq("client_link_id", link.id)
      .order("granted_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (grants ?? []).map((g) => g.attorney_user_id);
    const { data: profiles, error: profileError } = ids.length
      ? await supabaseAdmin
          .from("attorney_profiles")
          .select("user_id,full_name,email")
          .in("user_id", ids)
      : { data: [], error: null };
    if (profileError) throw new Error(profileError.message);
    const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    return {
      grants: (grants ?? []).map((g) => ({
        ...g,
        full_name: byId.get(g.attorney_user_id)?.full_name ?? null,
        email: byId.get(g.attorney_user_id)?.email ?? null,
      })),
    };
  });

export const grantCaseAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ clientId: z.string().uuid(), attorney_user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.attorney_user_id === context.userId) throw new Error("You already own this case.");
    const link = await assertOwnerLink(data.clientId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mine = await currentFirmMembership(context.userId);
    const { data: theirs, error: theirError } = await supabaseAdmin
      .from("firm_members")
      .select("firm_id")
      .eq("user_id", data.attorney_user_id)
      .maybeSingle();
    if (theirError) throw new Error(theirError.message);
    if (!mine || !theirs || mine.firm_id !== theirs.firm_id)
      throw new Error("That attorney is not a verified member of your firm.");
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("case_grants")
      .select("id")
      .eq("client_link_id", link.id)
      .eq("attorney_user_id", data.attorney_user_id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      const { error } = await supabaseAdmin
        .from("case_grants")
        .update({
          revoked_at: null,
          granted_at: new Date().toISOString(),
          granted_by: context.userId,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: existing.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("case_grants")
      .insert({
        client_link_id: link.id,
        attorney_user_id: data.attorney_user_id,
        granted_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not grant case access.");
    return { ok: true, id: row.id };
  });

export const revokeCaseGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: grant, error: lookupError } = await supabaseAdmin
      .from("case_grants")
      .select("id,client_link_id")
      .eq("id", data.id)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!grant) throw new Error("Case grant not found.");
    const { data: link } = await supabaseAdmin
      .from("attorney_client_links")
      .select("attorney_user_id,status")
      .eq("id", grant.client_link_id)
      .maybeSingle();
    if (!link || link.attorney_user_id !== context.userId || link.status !== "active")
      throw new Error("Only the case owner can revoke this grant.");
    const { error } = await supabaseAdmin
      .from("case_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Cases explicitly granted to the current verified firm member. */
export const listGrantedToMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: grants, error } = await supabaseAdmin
      .from("case_grants")
      .select("id,client_link_id,granted_by,granted_at")
      .eq("attorney_user_id", context.userId)
      .is("revoked_at", null);
    if (error || !grants?.length) return { items: [] };
    const { data: membership } = await supabaseAdmin
      .from("firm_members")
      .select("firm_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!membership) return { items: [] };
    const linkIds = grants.map((g) => g.client_link_id);
    const { data: links } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id,client_user_id,attorney_user_id,created_at,status")
      .in("id", linkIds)
      .eq("status", "active");
    const ownerIds = Array.from(new Set((links ?? []).map((l) => l.attorney_user_id)));
    const { data: owners } = ownerIds.length
      ? await supabaseAdmin
          .from("firm_members")
          .select("user_id")
          .in("user_id", ownerIds)
          .eq("firm_id", membership.firm_id)
      : { data: [] };
    const currentOwners = new Set((owners ?? []).map((m) => m.user_id));
    const byLink = new Map(
      (links ?? []).filter((l) => currentOwners.has(l.attorney_user_id)).map((l) => [l.id, l]),
    );
    return {
      items: grants
        .map((g) => {
          const link = byLink.get(g.client_link_id);
          return link
            ? {
                grant_id: g.id,
                link_id: link.id,
                client_user_id: link.client_user_id,
                granted_at: g.granted_at,
              }
            : null;
        })
        .filter(Boolean),
    };
  });
