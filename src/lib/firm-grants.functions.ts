import { createHash, randomBytes } from "crypto";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Hard maximum members per firm (owner + colleagues). */
export const FIRM_SEAT_MAX = 5;

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

async function firmSeatUsage(firmId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: firm, error: firmError }, { count: memberCount, error: memberError }] =
    await Promise.all([
      supabaseAdmin
        .from("firms")
        .select("seats_included,seats_purchased")
        .eq("id", firmId)
        .maybeSingle(),
      supabaseAdmin
        .from("firm_members")
        .select("id", { count: "exact", head: true })
        .eq("firm_id", firmId),
    ]);
  if (firmError) throw new Error(firmError.message);
  if (memberError) throw new Error(memberError.message);
  const rawLimit =
    Math.max(1, (firm?.seats_included ?? FIRM_SEAT_MAX) + (firm?.seats_purchased ?? 0));
  const limit = Math.min(FIRM_SEAT_MAX, rawLimit);
  const used = memberCount ?? 0;
  return { limit, used, available: Math.max(0, limit - used) };
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
    if (!membership) return { profile: profile ?? null, firm: null, membership: null, colleagues: [], seats: null };
    const { data: firm, error: firmError } = await supabaseAdmin
      .from("firms")
      .select("id,name,created_at,seats_included,seats_purchased")
      .eq("id", membership.firm_id)
      .maybeSingle();
    if (firmError) throw new Error(firmError.message);
    const seats = await firmSeatUsage(membership.firm_id);
    const { data: members, error: membersError } = await supabaseAdmin
      .from("firm_members")
      .select("user_id,role")
      .eq("firm_id", membership.firm_id)
      .neq("user_id", context.userId);
    if (membersError) throw new Error(membersError.message);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles, error: profilesError } = ids.length
      ? await supabaseAdmin.from("attorney_profiles").select("user_id,full_name,email,role").in("user_id", ids)
      : { data: [], error: null };
    if (profilesError) throw new Error(profilesError.message);
    const roleByUser = new Map((members ?? []).map((m) => [m.user_id, m.role]));
    return {
      profile: profile ?? null,
      firm: firm ?? null,
      membership,
      seats,
      colleagues: (profiles ?? []).map((p) => ({ ...p, membership_role: roleByUser.get(p.user_id) ?? "member" })),
    };
  });

/** Creates a new firm and its initial owner seat. It never joins by firm name. */
export const setMyFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ name: z.string().trim().min(2).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (await currentFirmMembership(context.userId)) {
      throw new Error("You already belong to a firm. Ask an owner to remove you before creating another.");
    }
    const name = data.name.trim();
    const { data: firm, error: firmError } = await supabaseAdmin
      .from("firms")
      .insert({
        name,
        created_by: context.userId,
        seats_included: FIRM_SEAT_MAX,
        seats_purchased: 0,
      })
      .select("id")
      .single();
    if (firmError || !firm) throw new Error(firmError?.message ?? "Could not create firm.");
    const { error: memberError } = await supabaseAdmin
      .from("firm_members")
      .insert({ firm_id: firm.id, user_id: context.userId, role: "owner" });
    if (memberError) throw new Error(memberError.message);
    // This is display-only legacy metadata. Authorization never reads it.
    await supabaseAdmin.from("attorney_profiles")
      .update({ firm_id: firm.id, firm_name: name, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    return { ok: true, firm_id: firm.id };
  });

export const leaveMyFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const membership = await currentFirmMembership(context.userId);
    if (!membership) return { ok: true };
    if (membership.role === "owner") {
      throw new Error("Firm owners cannot leave. Transfer ownership or remove the firm first.");
    }
    const { error } = await supabaseAdmin.from("firm_members")
      .delete().eq("firm_id", membership.firm_id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("attorney_profiles")
      .update({ firm_id: null, updated_at: new Date().toISOString() }).eq("user_id", context.userId);
    return { ok: true };
  });

/** Owner/admin-only, email-bound, short-lived, single-use invitation. */
export const createFirmMemberInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    email: z.string().email().max(255),
    role: z.enum(["admin", "member"]).default("member"),
    expires_days: z.number().int().min(1).max(30).default(7),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const manager = await assertFirmManager(context.userId);
    const seats = await firmSeatUsage(manager.firm_id);
    if (seats.available < 1) {
      throw new Error(`This firm has reached its seat limit (${seats.limit} of ${FIRM_SEAT_MAX}).`);
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
    // Raw token is returned once for a delivery mechanism; only its digest is stored.
    return { invitation: { ...invitation, token } };
  });

export const acceptFirmMemberInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(20).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const email = await verifiedAccountEmail(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: firmId, error } = await supabaseAdmin.rpc("accept_firm_member_invitation", {
      p_token_hash: hashToken(data.token), p_user_id: context.userId, p_email: email,
    });
    if (error || !firmId) throw new Error(error?.message ?? "Could not accept invitation.");
    return { ok: true, firm_id: firmId };
  });

/* ------------------------ case grants ------------------------ */

async function assertOwnerLink(clientId: string, ownerId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: link } = await supabaseAdmin
    .from("attorney_client_links")
    .select("id,attorney_user_id,client_user_id,status")
    .eq("attorney_user_id", ownerId).eq("client_user_id", clientId).maybeSingle();
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
    const { data: members, error: memberError } = await supabaseAdmin.from("firm_members")
      .select("user_id,role").eq("firm_id", mine.firm_id).neq("user_id", context.userId);
    if (memberError) throw new Error(memberError.message);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: colleagues, error: profileError } = ids.length
      ? await supabaseAdmin.from("attorney_profiles").select("user_id,full_name,email,role").in("user_id", ids)
      : { data: [], error: null };
    if (profileError) throw new Error(profileError.message);
    const membershipRoles = new Map((members ?? []).map((m) => [m.user_id, m.role]));
    return { colleagues: (colleagues ?? []).map((c) => ({ ...c, membership_role: membershipRoles.get(c.user_id) })), firm_id: mine.firm_id };
  });

export const listCaseGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const link = await assertOwnerLink(data.clientId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: grants, error } = await supabaseAdmin.from("case_grants")
      .select("id,attorney_user_id,granted_at,revoked_at").eq("client_link_id", link.id)
      .order("granted_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (grants ?? []).map((g) => g.attorney_user_id);
    const { data: profiles, error: profileError } = ids.length
      ? await supabaseAdmin.from("attorney_profiles").select("user_id,full_name,email").in("user_id", ids)
      : { data: [], error: null };
    if (profileError) throw new Error(profileError.message);
    const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    return { grants: (grants ?? []).map((g) => ({ ...g, full_name: byId.get(g.attorney_user_id)?.full_name ?? null, email: byId.get(g.attorney_user_id)?.email ?? null })) };
  });

export const grantCaseAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid(), attorney_user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.attorney_user_id === context.userId) throw new Error("You already own this case.");
    const link = await assertOwnerLink(data.clientId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mine = await currentFirmMembership(context.userId);
    const { data: theirs, error: theirError } = await supabaseAdmin.from("firm_members")
      .select("firm_id").eq("user_id", data.attorney_user_id).maybeSingle();
    if (theirError) throw new Error(theirError.message);
    if (!mine || !theirs || mine.firm_id !== theirs.firm_id) throw new Error("That attorney is not a verified member of your firm.");
    const { data: existing, error: existingError } = await supabaseAdmin.from("case_grants")
      .select("id").eq("client_link_id", link.id).eq("attorney_user_id", data.attorney_user_id).maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      const { error } = await supabaseAdmin.from("case_grants")
        .update({ revoked_at: null, granted_at: new Date().toISOString(), granted_by: context.userId }).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: existing.id };
    }
    const { data: row, error } = await supabaseAdmin.from("case_grants")
      .insert({ client_link_id: link.id, attorney_user_id: data.attorney_user_id, granted_by: context.userId }).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "Could not grant case access.");
    return { ok: true, id: row.id };
  });

export const revokeCaseGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: grant, error: lookupError } = await supabaseAdmin.from("case_grants")
      .select("id,client_link_id").eq("id", data.id).maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!grant) throw new Error("Case grant not found.");
    const { data: link } = await supabaseAdmin.from("attorney_client_links")
      .select("attorney_user_id,status").eq("id", grant.client_link_id).maybeSingle();
    if (!link || link.attorney_user_id !== context.userId || link.status !== "active") throw new Error("Only the case owner can revoke this grant.");
    const { error } = await supabaseAdmin.from("case_grants").update({ revoked_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Cases explicitly granted to the current verified firm member. */
export const listGrantedToMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: grants, error } = await supabaseAdmin.from("case_grants")
      .select("id,client_link_id,granted_by,granted_at").eq("attorney_user_id", context.userId).is("revoked_at", null);
    if (error || !grants?.length) return { items: [] };
    const linkIds = grants.map((g) => g.client_link_id);
    const { data: links } = await supabaseAdmin.from("attorney_client_links")
      .select("id,client_user_id,created_at,status").in("id", linkIds).eq("status", "active");
    const byLink = new Map((links ?? []).map((l) => [l.id, l]));
    return { items: grants.map((g) => {
      const link = byLink.get(g.client_link_id);
      return link ? { grant_id: g.id, link_id: link.id, client_user_id: link.client_user_id, granted_at: g.granted_at } : null;
    }).filter(Boolean) };
  });
