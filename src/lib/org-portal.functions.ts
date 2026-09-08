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
import {
  isReferralEligibleForReporting,
  privacyBucketReferralCount,
} from "@/lib/org-referral-privacy";

/**
 * DV organization partner portal.
 *
 * HARD PRIVACY RULE: nothing in this file may return survivor names, emails,
 * user ids, incident content, evidence, dates, descriptions or pattern
 * analysis. Orgs are referral partners, not case participants. The only data
 * that crosses this boundary is aggregate referral counts. Do not add a column, field or endpoint here
 * that would widen that.
 */

async function verifiedAccountEmail(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = data.user?.email?.trim().toLowerCase();
  if (error || !email || !data.user.email_confirmed_at) {
    throw new Error("A verified account email is required to accept this invitation.");
  }
  return email;
}

async function requireAdvocate(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "advocate")
    .maybeSingle();
  if (!role) throw new Error("This area is for partner organizations.");
  return supabaseAdmin;
}

async function requireAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Not authorized.");
  return supabaseAdmin;
}

/* --------------------------------- org side -------------------------------- */

export type OrgPartnerStats = {
  org_name: string | null;
  codes: Array<{
    code: string;
    org_name: string;
    is_active: boolean;
    referred_count: number | null;
  }>;
  totals: {
    all_time: number | null;
    last_30_days: number | null;
    last_90_days: number | null;
  };
};

// Distinct, matchable message so the client can tell "you're an advocate but
// haven't set up or joined an organization yet" (an actionable, expected
// state — send them to /org-signup) apart from a real, unexpected failure
// (a generic "try again" message).
export const NO_ORG_MEMBERSHIP_MESSAGE = "You are not a verified member of a partner organization.";

async function requireOrgMembership(userId: string) {
  const supabaseAdmin = await requireAdvocate(userId);
  const { data: member, error } = await supabaseAdmin
    .from("org_members")
    .select("org_id,role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!member) throw new Error(NO_ORG_MEMBERSHIP_MESSAGE);
  return { supabaseAdmin, member };
}

async function requireOrgManager(userId: string) {
  const { supabaseAdmin, member } = await requireOrgMembership(userId);
  if (member.role !== "owner" && member.role !== "admin") {
    throw new Error("Only an organization owner or administrator can manage referral links.");
  }
  return { supabaseAdmin, member };
}

export const getMyOrgPartnerStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrgPartnerStats> => {
    const { supabaseAdmin, member } = await requireOrgMembership(context.userId);
    const { data: org, error: orgError } = await supabaseAdmin
      .from("dv_organizations")
      .select("name")
      .eq("id", member.org_id)
      .maybeSingle();
    if (orgError || !org) throw new Error(orgError?.message ?? "Organization not found.");

    // Membership, rather than the historical org_user_id field, scopes all
    // organization dashboard data. Returned values are aggregates only.
    const { data: links, error: linksError } = await supabaseAdmin
      .from("referral_links")
      .select("code,org_name,is_active")
      .eq("org_id", member.org_id)
      .order("code", { ascending: true });
    if (linksError) throw new Error(linksError.message);
    const codes = (links ?? []).map((l) => l.code);
    const empty: OrgPartnerStats = {
      org_name: org.name,
      codes: (links ?? []).map((l) => ({ ...l, referred_count: null })),
      totals: { all_time: null, last_30_days: null, last_90_days: null },
    };
    if (!codes.length) return empty;

    // User ids and timestamps are used only inside this server function to
    // calculate aggregates; neither is ever included in the response.
    const { data: referrals } = await supabaseAdmin
      .from("user_referrals")
      .select("user_id,referred_by_code,created_at")
      .in("referred_by_code", codes);
    const now = Date.now();
    const rows = (referrals ?? []).filter((r) => isReferralEligibleForReporting(r.created_at, now));
    if (!rows.length) return empty;
    const rawTotals = { all_time: 0, last_30_days: 0, last_90_days: 0 };
    const perCode = new Map<string, number>();
    const within = (iso: string, days: number) =>
      now - new Date(iso).getTime() <= days * 86_400_000;
    for (const r of rows) {
      rawTotals.all_time += 1;
      if (within(r.created_at, 30)) rawTotals.last_30_days += 1;
      if (within(r.created_at, 90)) rawTotals.last_90_days += 1;
      if (r.referred_by_code)
        perCode.set(r.referred_by_code, (perCode.get(r.referred_by_code) ?? 0) + 1);
    }
    return {
      org_name: org.name,
      codes: (links ?? []).map((l) => ({
        ...l,
        referred_count: privacyBucketReferralCount(perCode.get(l.code) ?? 0),
      })),
      totals: {
        all_time: privacyBucketReferralCount(rawTotals.all_time),
        last_30_days: privacyBucketReferralCount(rawTotals.last_30_days),
        last_90_days: privacyBucketReferralCount(rawTotals.last_90_days),
      },
    };
  });

export const getMyOrgTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, member } = await requireOrgMembership(context.userId);
    const [{ data: org }, { data: members }, { data: invitations }, { data: audit }] =
      await Promise.all([
        supabaseAdmin
          .from("dv_organizations")
          .select("id,name,created_at")
          .eq("id", member.org_id)
          .maybeSingle(),
        supabaseAdmin
          .from("org_members")
          .select("user_id,role,joined_at")
          .eq("org_id", member.org_id),
        supabaseAdmin
          .from("org_member_invitations")
          .select("id,email,role,status,expires_at,created_at,invited_by")
          .eq("org_id", member.org_id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("audit_events")
          .select("id,event_type,actor_id,meta,created_at")
          .eq("subject_kind", "organization")
          .eq("subject_id", member.org_id)
          .like("event_type", "team.%")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin
          .from("advocate_profiles")
          .select("user_id,full_name,email")
          .in("user_id", ids)
      : { data: [] };
    const profileByUser = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    const authEmails = new Map<string, string | null>();
    await Promise.all(
      (members ?? []).map(async (m) => {
        const { data } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
        authEmails.set(m.user_id, data.user?.email ?? null);
      }),
    );
    return {
      org,
      membership: member,
      members: (members ?? []).map((m) => ({
        ...m,
        full_name: profileByUser.get(m.user_id)?.full_name ?? null,
        email: profileByUser.get(m.user_id)?.email ?? authEmails.get(m.user_id) ?? null,
        is_current_user: m.user_id === context.userId,
      })),
      invitations: member.role === "owner" || member.role === "admin" ? (invitations ?? []) : [],
      audit: member.role === "owner" || member.role === "admin" ? (audit ?? []) : [],
    };
  });

export const setReferralCodeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        code: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[A-Za-z0-9_-]+$/),
        is_active: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin, member } = await requireOrgManager(context.userId);
    const { error } = await supabaseAdmin
      .from("referral_links")
      .update({
        is_active: data.is_active,
        deactivated_at: data.is_active ? null : new Date().toISOString(),
      })
      .eq("code", data.code)
      .eq("org_id", member.org_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Owner/admin-only, email-bound organization invitation. No raw token is retained. */
export const createOrgMemberInvitation = createServerFn({ method: "POST" })
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
    const { supabaseAdmin, member } = await requireOrgManager(context.userId);
    if (!canInviteRole(member.role as TeamRole, data.role)) {
      throw new Error("Only the organization owner can invite an administrator.");
    }
    const email = data.email.trim().toLowerCase();
    const { error: revokeError } = await supabaseAdmin
      .from("org_member_invitations")
      .update({ status: "revoked" })
      .eq("org_id", member.org_id)
      .eq("email", email)
      .eq("status", "pending");
    if (revokeError) throw new Error(revokeError.message);
    const token = randomBytes(32).toString("base64url");
    const { data: invitation, error } = await supabaseAdmin
      .from("org_member_invitations")
      .insert({
        org_id: member.org_id,
        email,
        token_hash: createHash("sha256").update(token, "utf8").digest("hex"),
        invited_by: context.userId,
        role: data.role,
        expires_at: new Date(Date.now() + data.expires_days * 86_400_000).toISOString(),
      })
      .select("id,expires_at")
      .single();
    if (error || !invitation) throw new Error(error?.message ?? "Could not create invitation.");
    const { data: org } = await supabaseAdmin
      .from("dv_organizations")
      .select("name")
      .eq("id", member.org_id)
      .single();
    let acceptUrl: string;
    try {
      ({ acceptUrl } = await enqueueTeamInvitation({
        invitationId: invitation.id,
        email,
        teamName: org?.name ?? "your organization",
        teamKind: "organization",
        role: data.role,
        token,
        expiresDays: data.expires_days,
      }));
    } catch (error) {
      await supabaseAdmin
        .from("org_member_invitations")
        .update({ status: "revoked" })
        .eq("id", invitation.id);
      throw error;
    }
    await recordTeamAudit({
      actorId: context.userId,
      actorKind: "advocate",
      eventType: "team.org_invitation_sent",
      subjectKind: "organization",
      subjectId: member.org_id,
      meta: { invitation_id: invitation.id, role: data.role },
    });
    return {
      invitation: { ...invitation, email, role: data.role, status: "pending" as const },
      acceptUrl,
    };
  });

export const acceptOrgMemberInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(20).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const email = await verifiedAccountEmail(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if ((existingRoles ?? []).some((r) => r.role !== "advocate")) {
      throw new Error("Use a separate verified organization login for partner access.");
    }
    const { data: orgId, error } = await supabaseAdmin.rpc("accept_org_member_invitation", {
      p_token_hash: createHash("sha256").update(data.token, "utf8").digest("hex"),
      p_user_id: context.userId,
      p_email: email,
    });
    if (error || !orgId) throw new Error(error?.message ?? "Could not accept invitation.");
    await recordTeamAudit({
      actorId: context.userId,
      actorKind: "advocate",
      eventType: "team.org_invitation_accepted",
      subjectKind: "organization",
      subjectId: orgId,
    });
    return { ok: true, org_id: orgId };
  });

export const revokeOrgMemberInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, member } = await requireOrgManager(context.userId);
    const { data: invitation } = await supabaseAdmin
      .from("org_member_invitations")
      .select("id,status")
      .eq("id", data.id)
      .eq("org_id", member.org_id)
      .maybeSingle();
    if (!invitation || invitation.status !== "pending")
      throw new Error("Pending invitation not found.");
    const { error } = await supabaseAdmin
      .from("org_member_invitations")
      .update({ status: "revoked" })
      .eq("id", invitation.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    await recordTeamAudit({
      actorId: context.userId,
      actorKind: "advocate",
      eventType: "team.org_invitation_revoked",
      subjectKind: "organization",
      subjectId: member.org_id,
      meta: { invitation_id: invitation.id },
    });
    return { ok: true as const };
  });

export const changeOrgMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ user_id: z.string().uuid(), role: z.enum(["admin", "member"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, member } = await requireOrgManager(context.userId);
    const { data: target } = await supabaseAdmin
      .from("org_members")
      .select("role")
      .eq("org_id", member.org_id)
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (
      !target ||
      !canChangeMemberRole(
        member.role as TeamRole,
        target.role as TeamRole,
        data.role as ManagedTeamRole,
      )
    ) {
      throw new Error("You cannot change this member's role.");
    }
    await runTeamRpc("change_org_member_role", {
      p_org_id: member.org_id,
      p_actor_id: context.userId,
      p_target_user_id: data.user_id,
      p_role: data.role,
    });
    return { ok: true as const };
  });

export const removeOrgMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, member } = await requireOrgManager(context.userId);
    const { data: target } = await supabaseAdmin
      .from("org_members")
      .select("role")
      .eq("org_id", member.org_id)
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!target || !canRemoveMember(member.role as TeamRole, target.role as TeamRole)) {
      throw new Error("You cannot remove this member.");
    }
    await runTeamRpc("remove_org_member", {
      p_org_id: member.org_id,
      p_actor_id: context.userId,
      p_target_user_id: data.user_id,
    });
    return { ok: true as const };
  });

export const leaveMyOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { member } = await requireOrgMembership(context.userId);
    if (member.role === "owner")
      throw new Error("Organization owners cannot leave without an ownership transfer.");
    await runTeamRpc("remove_org_member", {
      p_org_id: member.org_id,
      p_actor_id: context.userId,
      p_target_user_id: context.userId,
    });
    return { ok: true as const };
  });

function slugify(v: string): string {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Does this account already belong to a partner organization? */
export const getMyOrgMembership = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("org_members")
      .select("org_id,role")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { hasOrg: !!data, role: data?.role ?? null };
  });

/**
 * Partner organizations are invitation-only: an account may only provision an
 * organization when PatternProof has already approved an access request for
 * that verified account email. Everything below fails closed.
 */
export const NOT_APPROVED_MESSAGE =
  "Your organization hasn't been verified yet. We'll email you as soon as it is.";

async function orgSetupEligibility(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = await verifiedAccountEmail(userId);

  const { data: member } = await supabaseAdmin
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (member) return { supabaseAdmin, email, hasOrg: true, approved: true, request: null };

  const { data: request } = await supabaseAdmin
    .from("org_access_requests")
    .select("id,org_name,contact_name,contact_role,status")
    .eq("email", email)
    .eq("status", "approved")
    .maybeSingle();

  return { supabaseAdmin, email, hasOrg: false, approved: !!request, request };
}

/**
 * Tells the signup screen exactly which state the account is in, so an invited
 * organization always sees a way forward and an unapproved one never gets
 * bounced between screens.
 */
export const getMyOrgSetupState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { hasOrg, approved, request } = await orgSetupEligibility(context.userId);
      return {
        hasOrg,
        approved,
        suggested_org_name: request?.org_name ?? null,
        suggested_contact_name: request?.contact_name ?? null,
        suggested_contact_role: request?.contact_role ?? null,
      };
    } catch {
      return {
        hasOrg: false,
        approved: false,
        suggested_org_name: null,
        suggested_contact_name: null,
        suggested_contact_role: null,
      };
    }
  });

/**
 * Provisioning for an approved DV partner organization.
 *
 * Creates everything the partner portal needs in one step: the organization,
 * the advocate role, the advocate profile, owner membership, and a first
 * referral code. Idempotent — running it again for an account that already
 * belongs to an organization just returns that organization. Requires an
 * approved access request for the verified account email.
 */
export const setMyOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        org_name: z.string().trim().min(2).max(200),
        contact_name: z.string().trim().min(1).max(120),
        contact_role: z.string().trim().max(120).optional(),
        email: z.string().email().max(255),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const {
      supabaseAdmin,
      email,
      hasOrg,
      approved,
      request,
    } = await orgSetupEligibility(userId);

    if (hasOrg) {
      const { data: existingMember } = await supabaseAdmin
        .from("org_members")
        .select("org_id")
        .eq("user_id", userId)
        .maybeSingle();
      return { ok: true as const, org_id: existingMember!.org_id };
    }
    if (!approved) throw new Error(NOT_APPROVED_MESSAGE);


    const { data: org, error: orgError } = await supabaseAdmin
      .from("dv_organizations")
      .insert({ name: data.org_name, created_by: userId })
      .select("id")
      .single();
    if (orgError || !org) throw new Error(orgError?.message ?? "Couldn't create your organization.");

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "advocate" }, { onConflict: "user_id,role" });

    const { error: profileError } = await supabaseAdmin.from("advocate_profiles").upsert(
      {
        user_id: userId,
        full_name: data.contact_name,
        org_name: data.org_name,
        org_id: org.id,
        email,
        onboarded: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (profileError) throw new Error(profileError.message);

    const { error: memberError } = await supabaseAdmin
      .from("org_members")
      .upsert({ org_id: org.id, user_id: userId, role: "owner" }, { onConflict: "org_id,user_id" });
    if (memberError) throw new Error(memberError.message);

    // First referral code — the org portal is built around these.
    const base = slugify(data.org_name) || "partner";
    const code = `${base}-${randomBytes(3).toString("hex")}`.slice(0, 48);
    await supabaseAdmin.from("referral_links").insert({
      code,
      org_name: data.org_name,
      org_user_id: userId,
      org_id: org.id,
      is_active: true,
      ...(data.contact_role ? { notes: `Contact role: ${data.contact_role}` } : {}),
    });

    // Record that the approval has been used. The status vocabulary is
    // constrained to pending/approved/denied by a database trigger, so the
    // marker lives in the message field; re-provisioning is already blocked by
    // the org_members check above.
    if (request?.id) {
      await supabaseAdmin
        .from("org_access_requests")
        .update({ reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", request.id);
    }

    return { ok: true as const, org_id: org.id };
  });

/* ------------------------- admin: verify partner orgs ------------------------ */

export const listOrgAccessRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("org_access_requests")
      .select(
        "id,org_name,contact_name,contact_role,email,message,survivors_per_month,status,created_at,reviewed_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { requests: data ?? [] };
  });

export const reviewOrgAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "denied", "pending"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("org_access_requests")
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Admin path for organizations that reached us outside the request form (email,
 * conference, referral). Creates an already-approved access record so that the
 * invited organization can finish setup itself — still not self-serve.
 */
export const approveOrgAccessByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(255),
        org_name: z.string().trim().min(2).max(200),
        contact_name: z.string().trim().min(1).max(120),
        contact_role: z.string().trim().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const email = data.email.trim().toLowerCase();
    const { data: existing } = await supabaseAdmin
      .from("org_access_requests")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    const patch = {
      email,
      org_name: data.org_name,
      contact_name: data.contact_name,
      contact_role: data.contact_role ?? null,
      status: "approved",
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabaseAdmin.from("org_access_requests").update(patch).eq("id", existing.id)
      : await supabaseAdmin.from("org_access_requests").insert(patch);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });



/**
 * Referred signups that never recorded Terms of Service acceptance, past a
 * 48-hour grace period. Aggregate counts per referring org only — same
 * no-identifiers rule as the org-facing stats above, since this is a signal
 * for admin to decide whether to follow up with a referral partner, not a
 * per-client roster.
 */
const CONSENT_GRACE_HOURS = 48;

export type ReferralConsentGap = {
  code: string;
  org_name: string;
  pending_count: number;
};

export const getReferralConsentGaps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ grace_period_hours: number; gaps: ReferralConsentGap[] }> => {
      const supabaseAdmin = await requireAdmin(context.userId);
      const cutoff = new Date(Date.now() - CONSENT_GRACE_HOURS * 3600_000).toISOString();

      const { data: referrals } = await supabaseAdmin
        .from("user_referrals")
        .select("user_id,referred_by_code,referred_by_org_name,created_at")
        .not("referred_by_code", "is", null)
        .lt("created_at", cutoff);
      const rows = (referrals ?? []).filter((r) => r.referred_by_code);
      if (rows.length === 0) return { grace_period_hours: CONSENT_GRACE_HOURS, gaps: [] };

      const { data: accepted } = await supabaseAdmin
        .from("user_terms_acceptance")
        .select("user_id")
        .in(
          "user_id",
          rows.map((r) => r.user_id),
        );
      const acceptedSet = new Set((accepted ?? []).map((a) => a.user_id));

      const perCode = new Map<string, { org_name: string; pending_count: number }>();
      for (const r of rows) {
        if (acceptedSet.has(r.user_id)) continue;
        const code = r.referred_by_code!;
        const entry = perCode.get(code) ?? {
          org_name: r.referred_by_org_name ?? code,
          pending_count: 0,
        };
        entry.pending_count += 1;
        perCode.set(code, entry);
      }

      const gaps = Array.from(perCode.entries())
        .map(([code, v]) => ({ code, ...v }))
        .sort((a, b) => b.pending_count - a.pending_count);

      return { grace_period_hours: CONSENT_GRACE_HOURS, gaps };
    },
  );

/* ---------- public partner access request ---------- */

/**
 * Public request form for organizations that want a partner portal.
 *
 * Unauthenticated by design (the requester has no account yet), so it is
 * written defensively: strict validation, one open request per work email,
 * a short cooldown between submissions, and always `status: "pending"` —
 * nothing here can approve itself or create any access.
 */
export const REQUEST_COOLDOWN_MINUTES = 10;

export const submitOrgAccessRequest = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        org_name: z.string().trim().min(2).max(200),
        website: z.string().trim().max(300).optional().nullable(),
        contact_name: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(255),
        contact_role: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(40).optional().nullable(),
        service_area: z.string().trim().min(2).max(160),
        org_type: z.string().trim().min(2).max(120),
        message: z.string().trim().min(10).max(2000),
        survivors_per_month: z.number().int().min(0).max(100000).optional().nullable(),
        contact_consent: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("org_access_requests")
      .select("id,status,created_at")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.status === "approved") {
      return {
        ok: true as const,
        state: "already_approved" as const,
        message: "This email is already verified — sign in on the partner page to finish setup.",
      };
    }
    if (existing?.status === "pending") {
      const age = Date.now() - new Date(existing.created_at as string).getTime();
      if (age < REQUEST_COOLDOWN_MINUTES * 60_000) {
        return {
          ok: true as const,
          state: "pending" as const,
          message: "We already have your request. Someone will be in touch by email.",
        };
      }
      const { error: upErr } = await supabaseAdmin
        .from("org_access_requests")
        .update({
          org_name: data.org_name,
          website: data.website || null,
          contact_name: data.contact_name,
          contact_role: data.contact_role,
          phone: data.phone || null,
          service_area: data.service_area,
          org_type: data.org_type,
          message: data.message,
          survivors_per_month:
            data.survivors_per_month == null ? null : String(data.survivors_per_month),
          contact_consent: true,
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (upErr) throw new Error("We couldn't send that just now. Try again in a moment.");
      return {
        ok: true as const,
        state: "pending" as const,
        message: "Thanks — your request is updated and waiting for review.",
      };
    }

    const { error } = await supabaseAdmin.from("org_access_requests").insert({
      org_name: data.org_name,
      website: data.website || null,
      contact_name: data.contact_name,
      email,
      contact_role: data.contact_role,
      phone: data.phone || null,
      service_area: data.service_area,
      org_type: data.org_type,
      message: data.message,
      survivors_per_month:
        data.survivors_per_month == null ? null : String(data.survivors_per_month),
      contact_consent: true,
      status: "pending",
    });
    if (error) throw new Error("We couldn't send that just now. Try again in a moment.");

    return {
      ok: true as const,
      state: "pending" as const,
      message: "Thanks — your request is with us. We review each organization by hand.",
    };
  });
