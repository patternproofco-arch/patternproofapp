import { createHash, randomBytes } from "crypto";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * DV organization partner portal.
 *
 * HARD PRIVACY RULE: nothing in this file may return survivor names, emails,
 * user ids, incident content, evidence, dates, descriptions or pattern
 * analysis. Orgs are referral partners, not case participants. The only data
 * that crosses this boundary is aggregate counts and a coarse activity status
 * with no identifier attached. Do not add a column, field or endpoint here
 * that would widen that.
 */

const ACTIVE_WINDOW_DAYS = 30;

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
  codes: Array<{ code: string; org_name: string; is_active: boolean; referred_count: number }>;
  totals: {
    all_time: number;
    last_7_days: number;
    last_30_days: number;
    last_90_days: number;
    actively_documenting: number;
    inactive: number;
    signed_up_only: number;
  };
  active_window_days: number;
};

async function requireOrgMembership(userId: string) {
  const supabaseAdmin = await requireAdvocate(userId);
  const { data: member, error } = await supabaseAdmin
    .from("org_members")
    .select("org_id,role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!member) throw new Error("You are not a verified member of a partner organization.");
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
      .from("dv_organizations").select("name").eq("id", member.org_id).maybeSingle();
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
      codes: (links ?? []).map((l) => ({ ...l, referred_count: 0 })),
      totals: { all_time: 0, last_7_days: 0, last_30_days: 0, last_90_days: 0, actively_documenting: 0, inactive: 0, signed_up_only: 0 },
      active_window_days: ACTIVE_WINDOW_DAYS,
    };
    if (!codes.length) return empty;

    // User ids and timestamps are used only inside this server function to
    // calculate aggregates; neither is ever included in the response.
    const { data: referrals } = await supabaseAdmin
      .from("user_referrals").select("user_id,referred_by_code,created_at").in("referred_by_code", codes);
    const rows = referrals ?? [];
    if (!rows.length) return empty;
    const userIds = rows.map((r) => r.user_id);
    const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000).toISOString();
    const [{ data: recent }, { data: everRows }] = await Promise.all([
      supabaseAdmin.from("incidents").select("user_id").in("user_id", userIds).is("deleted_at", null).gte("created_at", since),
      supabaseAdmin.from("incidents").select("user_id").in("user_id", userIds).is("deleted_at", null),
    ]);
    const recentSet = new Set((recent ?? []).map((r) => r.user_id));
    const everSet = new Set((everRows ?? []).map((r) => r.user_id));
    const totals = { ...empty.totals };
    const perCode = new Map<string, number>();
    const now = Date.now();
    const within = (iso: string, days: number) => now - new Date(iso).getTime() <= days * 86_400_000;
    for (const r of rows) {
      totals.all_time += 1;
      if (within(r.created_at, 7)) totals.last_7_days += 1;
      if (within(r.created_at, 30)) totals.last_30_days += 1;
      if (within(r.created_at, 90)) totals.last_90_days += 1;
      if (recentSet.has(r.user_id)) totals.actively_documenting += 1;
      else if (everSet.has(r.user_id)) totals.inactive += 1;
      else totals.signed_up_only += 1;
      if (r.referred_by_code) perCode.set(r.referred_by_code, (perCode.get(r.referred_by_code) ?? 0) + 1);
    }
    return {
      org_name: org.name,
      codes: (links ?? []).map((l) => ({ ...l, referred_count: perCode.get(l.code) ?? 0 })),
      totals,
      active_window_days: ACTIVE_WINDOW_DAYS,
    };
  });

export const setReferralCodeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    code: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/), is_active: z.boolean(),
  }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin, member } = await requireOrgManager(context.userId);
    const { error } = await supabaseAdmin.from("referral_links")
      .update({ is_active: data.is_active, deactivated_at: data.is_active ? null : new Date().toISOString() })
      .eq("code", data.code).eq("org_id", member.org_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/** Owner/admin-only, email-bound organization invitation. No raw token is retained. */
export const createOrgMemberInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    email: z.string().email().max(255), role: z.enum(["admin", "member"]).default("member"),
    expires_days: z.number().int().min(1).max(30).default(7),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, member } = await requireOrgManager(context.userId);
    const email = data.email.trim().toLowerCase();
    const { error: revokeError } = await supabaseAdmin
      .from("org_member_invitations")
      .update({ status: "revoked" })
      .eq("org_id", member.org_id)
      .eq("email", email)
      .eq("status", "pending");
    if (revokeError) throw new Error(revokeError.message);
    const token = randomBytes(32).toString("base64url");
    const { data: invitation, error } = await supabaseAdmin.from("org_member_invitations")
      .insert({
        org_id: member.org_id, email,
        token_hash: createHash("sha256").update(token, "utf8").digest("hex"),
        invited_by: context.userId, role: data.role,
        expires_at: new Date(Date.now() + data.expires_days * 86_400_000).toISOString(),
      }).select("id,expires_at").single();
    if (error || !invitation) throw new Error(error?.message ?? "Could not create invitation.");
    return { invitation: { ...invitation, token } };
  });

export const acceptOrgMemberInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(20).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const email = await verifiedAccountEmail(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orgId, error } = await supabaseAdmin.rpc("accept_org_member_invitation", {
      p_token_hash: createHash("sha256").update(data.token, "utf8").digest("hex"),
      p_user_id: context.userId, p_email: email,
    });
    if (error || !orgId) throw new Error(error?.message ?? "Could not accept invitation.");
    return { ok: true, org_id: orgId };
  });

/* -------------------------------- admin side ------------------------------- */

export const listOrgAccessRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("org_access_requests")
      .select("id,org_name,contact_name,email,contact_role,survivors_per_month,message,status,created_at,reviewed_at")
      .order("created_at", { ascending: false })
      .limit(200);
    const { data: links } = await supabaseAdmin
      .from("referral_links")
      .select("code,org_name,request_id,is_active");
    return { requests: data ?? [], links: links ?? [] };
  });

function slugify(v: string): string {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export const approveOrgAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      request_id: z.string().uuid(),
      code: z.string().min(2).max(64).regex(/^[A-Za-z0-9_-]+$/).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);

    const { data: req } = await supabaseAdmin
      .from("org_access_requests")
      .select("*")
      .eq("id", data.request_id)
      .maybeSingle();
    if (!req) throw new Error("Request not found.");

    // 1. Org login on the existing (unused) advocate role.
    const email = String(req.email).toLowerCase();
    let userId: string | null = null;
    let tempPassword: string | null = null;

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) {
      userId = found.id;
    } else {
      tempPassword = `pp-${crypto.randomUUID()}`;
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { org_name: req.org_name, full_name: req.contact_name },
      });
      if (createErr || !created?.user) throw new Error(createErr?.message ?? "Could not create the org login.");
      userId = created.user.id;
    }

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "advocate" }, { onConflict: "user_id,role" });

    // Approval establishes the first verified organization membership. A
    // profile's free-form org name is never used as authorization.
    const { data: createdOrg, error: orgError } = await supabaseAdmin
      .from("dv_organizations")
      .insert({ name: req.org_name.trim(), created_by: userId })
      .select("id")
      .single();
    if (orgError || !createdOrg) throw new Error(orgError?.message ?? "Could not create organization.");
    const orgId = createdOrg.id;
    const { error: memberError } = await supabaseAdmin.from("org_members")
      .upsert({ org_id: orgId, user_id: userId, role: "owner" }, { onConflict: "org_id,user_id" });
    if (memberError) throw new Error(memberError.message);
    await supabaseAdmin.from("advocate_profiles").upsert(
      { user_id: userId, full_name: req.contact_name, org_name: req.org_name, org_id: orgId, email, onboarded: true },
      { onConflict: "user_id" },
    );

    // 2. Unique referral code.
    let code = data.code ?? slugify(req.org_name);
    if (!code) code = `org-${Math.random().toString(36).slice(2, 8)}`;
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = attempt === 0 ? code : `${code}-${Math.random().toString(36).slice(2, 6)}`;
      const { data: clash } = await supabaseAdmin
        .from("referral_links")
        .select("code")
        .eq("code", candidate)
        .maybeSingle();
      if (!clash) { code = candidate; break; }
      if (attempt === 19) throw new Error("Could not generate a unique referral code.");
    }

    const { error: linkErr } = await supabaseAdmin.from("referral_links").insert({
      code,
      org_name: req.org_name,
      org_user_id: userId,
      org_id: orgId,
      request_id: req.id,
      is_active: true,
      notes: `Approved from org access request ${req.id}`,
    });
    if (linkErr) throw new Error(linkErr.message);

    await supabaseAdmin
      .from("org_access_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: context.userId })
      .eq("id", req.id);

    return { ok: true as const, code, email, temp_password: tempPassword };
  });

export const denyOrgAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ request_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("org_access_requests")
      .update({ status: "denied", reviewed_at: new Date().toISOString(), reviewed_by: context.userId })
      .eq("id", data.request_id);
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
  .handler(async ({ context }): Promise<{ grace_period_hours: number; gaps: ReferralConsentGap[] }> => {
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
      .in("user_id", rows.map((r) => r.user_id));
    const acceptedSet = new Set((accepted ?? []).map((a) => a.user_id));

    const perCode = new Map<string, { org_name: string; pending_count: number }>();
    for (const r of rows) {
      if (acceptedSet.has(r.user_id)) continue;
      const code = r.referred_by_code!;
      const entry = perCode.get(code) ?? { org_name: r.referred_by_org_name ?? code, pending_count: 0 };
      entry.pending_count += 1;
      perCode.set(code, entry);
    }

    const gaps = Array.from(perCode.entries())
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.pending_count - a.pending_count);

    return { grace_period_hours: CONSENT_GRACE_HOURS, gaps };
  });
