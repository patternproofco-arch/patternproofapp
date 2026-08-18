import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  FIRM_INCLUDED_SEATS,
  FIRM_MAX_SEATS,
  getFirmMembership,
  getOrgMembership,
  newInviteToken,
} from "@/lib/workspace.server";

const emailSchema = z.string().trim().toLowerCase().email().max(255);

export type WorkspaceMember = {
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  name: string | null;
  email: string | null;
};
export type WorkspaceInvite = {
  id: string;
  email: string;
  role: "owner" | "member";
  invite_token: string;
  expires_at: string;
  created_at: string;
};

/* ----------------------------- firm workspace ----------------------------- */

export const getMyFirmWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const membership = await getFirmMembership(context.userId);
    if (!membership) return { workspace: null, myRole: null, members: [], invites: [] } as const;

    const [{ data: firm }, { data: memberRows }, { data: inviteRows }] = await Promise.all([
      supabaseAdmin.from("firms").select("id,name,seats_purchased,seats_included").eq("id", membership.firm_id).maybeSingle(),
      supabaseAdmin.from("firm_members").select("user_id,role,joined_at").eq("firm_id", membership.firm_id).order("joined_at"),
      supabaseAdmin
        .from("firm_member_invitations")
        .select("id,email,role,invite_token,expires_at,created_at")
        .eq("firm_id", membership.firm_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    const ids = (memberRows ?? []).map((m) => m.user_id as string);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("attorney_profiles").select("user_id,full_name,email").in("user_id", ids)
      : { data: [] as Array<{ user_id: string; full_name: string | null; email: string | null }> };

    const members: WorkspaceMember[] = (memberRows ?? []).map((m) => {
      const p = (profiles ?? []).find((x) => x.user_id === m.user_id);
      return {
        user_id: m.user_id as string,
        role: m.role as "owner" | "member",
        joined_at: m.joined_at as string,
        name: p?.full_name ?? null,
        email: p?.email ?? null,
      };
    });

    const seatsPurchased = (firm?.seats_purchased as number | undefined) ?? FIRM_INCLUDED_SEATS;
    return {
      workspace: {
        id: membership.firm_id,
        name: (firm?.name as string | undefined) ?? "Your firm",
        seatsPurchased,
        seatsIncluded: (firm?.seats_included as number | undefined) ?? FIRM_INCLUDED_SEATS,
        seatsUsed: members.length + (inviteRows ?? []).length,
        seatsMax: FIRM_MAX_SEATS,
      },
      myRole: membership.role,
      members,
      invites: (inviteRows ?? []) as WorkspaceInvite[],
    } as const;
  });

export const createFirmWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ name: z.string().trim().min(2).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = await getFirmMembership(context.userId);
    if (existing) throw new Error("You already belong to a firm workspace.");

    const { data: profile } = await supabaseAdmin
      .from("attorney_profiles")
      .select("user_id,firm_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) throw new Error("Attorney profile required");

    let firmId = profile.firm_id as string | null;
    if (!firmId) {
      const { data: firm, error } = await supabaseAdmin
        .from("firms")
        .insert({ name: data.name, created_by: context.userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      firmId = firm.id as string;
      await supabaseAdmin.from("attorney_profiles").update({ firm_id: firmId }).eq("user_id", context.userId);
    }

    const { error: memberErr } = await supabaseAdmin
      .from("firm_members")
      .insert({ firm_id: firmId, user_id: context.userId, role: "owner" });
    if (memberErr) throw new Error(memberErr.message);
    return { ok: true, firmId } as const;
  });

export const inviteFirmMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ email: emailSchema, role: z.enum(["owner", "member"]).default("member") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const membership = await getFirmMembership(context.userId);
    if (!membership || membership.role !== "owner") throw new Error("Only a workspace owner can invite teammates.");

    const [{ data: firm }, { count: memberCount }, { count: pendingCount }] = await Promise.all([
      supabaseAdmin.from("firms").select("seats_purchased").eq("id", membership.firm_id).maybeSingle(),
      supabaseAdmin.from("firm_members").select("id", { count: "exact", head: true }).eq("firm_id", membership.firm_id),
      supabaseAdmin
        .from("firm_member_invitations")
        .select("id", { count: "exact", head: true })
        .eq("firm_id", membership.firm_id)
        .eq("status", "pending"),
    ]);
    const seats = Math.min((firm?.seats_purchased as number | undefined) ?? FIRM_INCLUDED_SEATS, FIRM_MAX_SEATS);
    if ((memberCount ?? 0) + (pendingCount ?? 0) >= seats) {
      throw new Error(`All ${seats} seats are in use. Add a seat before inviting another teammate.`);
    }

    const { data: dupe } = await supabaseAdmin
      .from("firm_member_invitations")
      .select("id")
      .eq("firm_id", membership.firm_id)
      .eq("email", data.email)
      .eq("status", "pending")
      .maybeSingle();
    if (dupe) throw new Error("That teammate already has a pending invite.");

    const { data: invite, error } = await supabaseAdmin
      .from("firm_member_invitations")
      .insert({
        firm_id: membership.firm_id,
        email: data.email,
        role: data.role,
        invited_by: context.userId,
        invite_token: newInviteToken(),
      })
      .select("id,email,role,invite_token,expires_at,created_at")
      .single();
    if (error) throw new Error(error.message);
    return { invite: invite as WorkspaceInvite };
  });

export const revokeFirmInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const membership = await getFirmMembership(context.userId);
    if (!membership || membership.role !== "owner") throw new Error("Only a workspace owner can do that.");
    const { error } = await supabaseAdmin
      .from("firm_member_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("firm_id", membership.firm_id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

export const removeFirmMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const membership = await getFirmMembership(context.userId);
    if (!membership || membership.role !== "owner") throw new Error("Only a workspace owner can remove teammates.");
    if (data.userId === context.userId) throw new Error("You can't remove yourself from the workspace.");
    const { error } = await supabaseAdmin
      .from("firm_members")
      .delete()
      .eq("firm_id", membership.firm_id)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

/* ------------------------------ org workspace ----------------------------- */

export const getMyOrgWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const membership = await getOrgMembership(context.userId);
    if (!membership) return { workspace: null, myRole: null, members: [], invites: [] } as const;

    const [{ data: org }, { data: memberRows }, { data: inviteRows }] = await Promise.all([
      supabaseAdmin.from("dv_organizations").select("id,name").eq("id", membership.org_id).maybeSingle(),
      supabaseAdmin.from("org_members").select("user_id,role,joined_at").eq("org_id", membership.org_id).order("joined_at"),
      supabaseAdmin
        .from("org_member_invitations")
        .select("id,email,role,invite_token,expires_at,created_at")
        .eq("org_id", membership.org_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    const ids = (memberRows ?? []).map((m) => m.user_id as string);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("advocate_profiles").select("user_id,full_name,email").in("user_id", ids)
      : { data: [] as Array<{ user_id: string; full_name: string | null; email: string | null }> };

    const members: WorkspaceMember[] = (memberRows ?? []).map((m) => {
      const p = (profiles ?? []).find((x) => x.user_id === m.user_id);
      return {
        user_id: m.user_id as string,
        role: m.role as "owner" | "member",
        joined_at: m.joined_at as string,
        name: p?.full_name ?? null,
        email: p?.email ?? null,
      };
    });

    return {
      workspace: {
        id: membership.org_id,
        name: (org?.name as string | undefined) ?? "Your organization",
        seatsUsed: members.length,
      },
      myRole: membership.role,
      members,
      invites: (inviteRows ?? []) as WorkspaceInvite[],
    } as const;
  });

export const createOrgWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ name: z.string().trim().min(2).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = await getOrgMembership(context.userId);
    if (existing) throw new Error("You already belong to an organization workspace.");
    const { data: profile } = await supabaseAdmin
      .from("advocate_profiles")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) throw new Error("Advocate profile required");

    const { data: org, error } = await supabaseAdmin
      .from("dv_organizations")
      .insert({ name: data.name, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("advocate_profiles")
      .update({ org_id: org.id, org_name: data.name })
      .eq("user_id", context.userId);
    const { error: memberErr } = await supabaseAdmin
      .from("org_members")
      .insert({ org_id: org.id, user_id: context.userId, role: "owner" });
    if (memberErr) throw new Error(memberErr.message);
    return { ok: true, orgId: org.id as string } as const;
  });

export const inviteOrgMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ email: emailSchema, role: z.enum(["owner", "member"]).default("member") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const membership = await getOrgMembership(context.userId);
    if (!membership || membership.role !== "owner") throw new Error("Only a workspace owner can invite teammates.");

    const { data: dupe } = await supabaseAdmin
      .from("org_member_invitations")
      .select("id")
      .eq("org_id", membership.org_id)
      .eq("email", data.email)
      .eq("status", "pending")
      .maybeSingle();
    if (dupe) throw new Error("That teammate already has a pending invite.");

    const { data: invite, error } = await supabaseAdmin
      .from("org_member_invitations")
      .insert({
        org_id: membership.org_id,
        email: data.email,
        role: data.role,
        invited_by: context.userId,
        invite_token: newInviteToken(),
      })
      .select("id,email,role,invite_token,expires_at,created_at")
      .single();
    if (error) throw new Error(error.message);
    return { invite: invite as WorkspaceInvite };
  });

export const revokeOrgInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const membership = await getOrgMembership(context.userId);
    if (!membership || membership.role !== "owner") throw new Error("Only a workspace owner can do that.");
    const { error } = await supabaseAdmin
      .from("org_member_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("org_id", membership.org_id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

export const removeOrgMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const membership = await getOrgMembership(context.userId);
    if (!membership || membership.role !== "owner") throw new Error("Only a workspace owner can remove teammates.");
    if (data.userId === context.userId) throw new Error("You can't remove yourself from the workspace.");
    const { error } = await supabaseAdmin
      .from("org_members")
      .delete()
      .eq("org_id", membership.org_id)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

/* ------------------------------ invite intake ----------------------------- */

export const peekTeamInvite = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: firmInv }, { data: orgInv }] = await Promise.all([
      supabaseAdmin
        .from("firm_member_invitations")
        .select("id,email,role,status,expires_at,firm_id")
        .eq("invite_token", data.token)
        .maybeSingle(),
      supabaseAdmin
        .from("org_member_invitations")
        .select("id,email,role,status,expires_at,org_id")
        .eq("invite_token", data.token)
        .maybeSingle(),
    ]);
    const inv = firmInv ?? orgInv;
    if (!inv) return { status: "not-found" as const };
    if (inv.status !== "pending") return { status: inv.status as "accepted" | "revoked" };
    if (new Date(inv.expires_at as string) < new Date()) return { status: "expired" as const };

    const kind = firmInv ? ("firm" as const) : ("org" as const);
    const { data: ws } = firmInv
      ? await supabaseAdmin.from("firms").select("name").eq("id", firmInv.firm_id).maybeSingle()
      : await supabaseAdmin.from("dv_organizations").select("name").eq("id", (orgInv as { org_id: string }).org_id).maybeSingle();
    return {
      status: "ok" as const,
      invite: { kind, email: inv.email as string, role: inv.role as "owner" | "member", workspaceName: (ws?.name as string | undefined) ?? "" },
    };
  });

export const acceptTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const jwtEmail = (context.claims as { email?: string } | undefined)?.email?.toLowerCase();
    if (!jwtEmail) throw new Error("Sign in with the invited email address first.");

    const { data: firmInv } = await supabaseAdmin
      .from("firm_member_invitations")
      .select("id,firm_id,email,role,status,expires_at")
      .eq("invite_token", data.token)
      .maybeSingle();
    const { data: orgInv } = firmInv
      ? { data: null }
      : await supabaseAdmin
          .from("org_member_invitations")
          .select("id,org_id,email,role,status,expires_at")
          .eq("invite_token", data.token)
          .maybeSingle();

    const inv = firmInv ?? orgInv;
    if (!inv) throw new Error("Invitation not found");
    if (inv.status !== "pending") throw new Error("Invitation no longer valid");
    if (new Date(inv.expires_at as string) < new Date()) throw new Error("Invitation expired");
    if (String(inv.email).toLowerCase() !== jwtEmail) {
      throw new Error("This invitation was sent to a different email address.");
    }

    if (firmInv) {
      const already = await getFirmMembership(context.userId);
      if (already && already.firm_id !== firmInv.firm_id) {
        throw new Error("You already belong to a different firm workspace.");
      }
      if (!already) {
        const { error } = await supabaseAdmin
          .from("firm_members")
          .insert({ firm_id: firmInv.firm_id, user_id: context.userId, role: firmInv.role });
        if (error) throw new Error(error.message);
      }
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: context.userId, role: "attorney" }, { onConflict: "user_id,role" });
      await supabaseAdmin.from("attorney_profiles").upsert(
        { user_id: context.userId, email: jwtEmail, full_name: jwtEmail, firm_id: firmInv.firm_id },
        { onConflict: "user_id" },
      );
      await supabaseAdmin
        .from("firm_member_invitations")
        .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: context.userId })
        .eq("id", firmInv.id);
      return { ok: true, kind: "firm" as const };
    }

    const orgInvite = orgInv as { id: string; org_id: string; role: "owner" | "member" };
    const already = await getOrgMembership(context.userId);
    if (already && already.org_id !== orgInvite.org_id) {
      throw new Error("You already belong to a different organization workspace.");
    }
    const { data: org } = await supabaseAdmin
      .from("dv_organizations")
      .select("name")
      .eq("id", orgInvite.org_id)
      .maybeSingle();
    if (!already) {
      const { error } = await supabaseAdmin
        .from("org_members")
        .insert({ org_id: orgInvite.org_id, user_id: context.userId, role: orgInvite.role });
      if (error) throw new Error(error.message);
    }
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "advocate" }, { onConflict: "user_id,role" });
    await supabaseAdmin.from("advocate_profiles").upsert(
      {
        user_id: context.userId,
        email: jwtEmail,
        full_name: jwtEmail,
        org_id: orgInvite.org_id,
        org_name: (org?.name as string | undefined) ?? null,
        onboarded: true,
      },
      { onConflict: "user_id" },
    );
    await supabaseAdmin
      .from("org_member_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: context.userId })
      .eq("id", orgInvite.id);
    return { ok: true, kind: "org" as const };
  });
