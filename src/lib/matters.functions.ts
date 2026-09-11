import { createHash, randomBytes } from "crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Firm matter records: an attorney creates and names a matter, optionally
 * attaches a client's shared file to it, and assigns advocates to that single
 * matter. Assignment never widens what the client shared — it only lets the
 * advocate open the same shared file, and only for that matter.
 */

function newToken() {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

const matterInput = z.object({
  matter_name: z.string().trim().min(1).max(160),
  matter_number: z.string().trim().max(60).optional().nullable(),
  case_type: z.string().trim().max(80).optional().nullable(),
  court: z.string().trim().max(120).optional().nullable(),
  jurisdiction: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  client_link_id: z.string().uuid().optional().nullable(),
});

async function assertOwnedMatter(userId: string, matterId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("matters")
    .select("*")
    .eq("id", matterId)
    .eq("attorney_user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That matter isn't available to you.");
  return data;
}

/** Only links the signed-in attorney actually holds may be attached. */
async function assertOwnedLink(userId: string, linkId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("attorney_client_links")
    .select("id,client_user_id,status")
    .eq("id", linkId)
    .eq("attorney_user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That shared file isn't available to you.");
  return data;
}

export const listMatters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [mattersRes, linksRes] = await Promise.all([
      supabaseAdmin
        .from("matters")
        .select("*")
        .eq("attorney_user_id", context.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("attorney_client_links")
        .select("id,client_user_id,status")
        .eq("attorney_user_id", context.userId)
        .eq("status", "active"),
    ]);
    const matters = mattersRes.data ?? [];
    const ids = matters.map((m) => m.id);
    const advocates = ids.length
      ? ((
          await supabaseAdmin
            .from("matter_advocates")
            .select("matter_id,advocate_email,advocate_name,revoked_at")
            .in("matter_id", ids)
            .is("revoked_at", null)
        ).data ?? [])
      : [];
    return {
      matters: matters.map((m) => ({
        ...m,
        advocate_count: advocates.filter((a) => a.matter_id === m.id).length,
      })),
      links: linksRes.data ?? [],
    };
  });

export const createMatter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => matterInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.client_link_id) await assertOwnedLink(context.userId, data.client_link_id);
    const { data: membership } = await supabaseAdmin
      .from("firm_members")
      .select("firm_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    const { data: matter, error } = await supabaseAdmin
      .from("matters")
      .insert({
        attorney_user_id: context.userId,
        firm_id: membership?.firm_id ?? null,
        matter_name: data.matter_name,
        matter_number: data.matter_number || null,
        case_type: data.case_type || null,
        court: data.court || null,
        jurisdiction: data.jurisdiction || null,
        notes: data.notes || null,
        client_link_id: data.client_link_id || null,
      })
      .select("*")
      .single();
    if (error || !matter) throw new Error(error?.message ?? "We couldn't open that matter.");
    return { matter };
  });

export const updateMatter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    matterInput
      .partial()
      .extend({
        id: z.string().uuid(),
        status: z.enum(["open", "closed"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertOwnedMatter(context.userId, data.id);
    if (data.client_link_id) await assertOwnedLink(context.userId, data.client_link_id);
    const { id, ...rest } = data;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) patch[k] = v === "" ? null : v;
    }
    const { data: matter, error } = await supabaseAdmin
      .from("matters")
      .update(patch)
      .eq("id", id)
      .eq("attorney_user_id", context.userId)
      .select("*")
      .single();
    if (error || !matter) throw new Error(error?.message ?? "We couldn't save that change.");
    return { matter };
  });

export const getMatter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const matter = await assertOwnedMatter(context.userId, data.id);
    const [advocatesRes, invitesRes, linksRes] = await Promise.all([
      supabaseAdmin
        .from("matter_advocates")
        .select("id,advocate_user_id,advocate_email,advocate_name,revoked_at,created_at")
        .eq("matter_id", matter.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("matter_advocate_invitations")
        .select("id,advocate_email,advocate_name,status,expires_at,created_at,accepted_at")
        .eq("matter_id", matter.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("attorney_client_links")
        .select("id,client_user_id,status")
        .eq("attorney_user_id", context.userId)
        .eq("status", "active"),
    ]);
    const link = matter.client_link_id
      ? ((linksRes.data ?? []).find((l) => l.id === matter.client_link_id) ?? null)
      : null;
    return {
      matter,
      client_user_id: link?.client_user_id ?? null,
      advocates: advocatesRes.data ?? [],
      invitations: invitesRes.data ?? [],
      links: linksRes.data ?? [],
    };
  });

export const inviteAdvocateToMatter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        matter_id: z.string().uuid(),
        email: z.string().email().max(255),
        name: z.string().trim().max(120).optional(),
        expires_days: z.number().int().min(1).max(30).default(14),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const matter = await assertOwnedMatter(context.userId, data.matter_id);
    const email = data.email.trim().toLowerCase();
    await supabaseAdmin
      .from("matter_advocate_invitations")
      .update({ status: "revoked" })
      .eq("matter_id", matter.id)
      .eq("advocate_email", email)
      .eq("status", "pending");
    const token = newToken();
    const { data: invitation, error } = await supabaseAdmin
      .from("matter_advocate_invitations")
      .insert({
        matter_id: matter.id,
        attorney_user_id: context.userId,
        advocate_email: email,
        advocate_name: data.name?.trim() || null,
        token_hash: hashToken(token),
        expires_at: new Date(Date.now() + data.expires_days * 86_400_000).toISOString(),
      })
      .select("id,advocate_email,advocate_name,status,expires_at,created_at,accepted_at")
      .single();
    if (error || !invitation) throw new Error(error?.message ?? "We couldn't send that invitation.");
    return { invitation, acceptPath: `/matter-invite/${token}` };
  });

export const revokeMatterInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("matter_advocate_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("attorney_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeMatterAdvocate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("matter_advocates")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("granted_by", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------- advocate side --------------------------- */

export const peekMatterInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(20).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invitation } = await supabaseAdmin
      .from("matter_advocate_invitations")
      .select("id,matter_id,advocate_email,status,expires_at")
      .eq("token_hash", hashToken(data.token))
      .maybeSingle();
    if (!invitation) return { invitation: null, matter: null };
    const { data: matter } = await supabaseAdmin
      .from("matters")
      .select("matter_name,matter_number,court,jurisdiction")
      .eq("id", invitation.matter_id)
      .maybeSingle();
    return { invitation, matter: matter ?? null };
  });

export const acceptMatterInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(20).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = user.user?.email?.trim().toLowerCase();
    if (!email || !user.user?.email_confirmed_at) {
      throw new Error("A confirmed account email is needed to accept this invitation.");
    }
    const { data: invitation } = await supabaseAdmin
      .from("matter_advocate_invitations")
      .select("id,matter_id,advocate_email,advocate_name,status,expires_at")
      .eq("token_hash", hashToken(data.token))
      .maybeSingle();
    if (!invitation || invitation.status !== "pending") {
      throw new Error("This invitation is no longer open.");
    }
    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from("matter_advocate_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
      throw new Error("This invitation has expired. Ask the attorney to send a new one.");
    }
    if (invitation.advocate_email !== email) {
      throw new Error("This invitation was sent to a different email address.");
    }
    const { data: matter } = await supabaseAdmin
      .from("matters")
      .select("id,attorney_user_id")
      .eq("id", invitation.matter_id)
      .single();
    if (!matter) throw new Error("That matter is no longer available.");

    const { error: assignError } = await supabaseAdmin.from("matter_advocates").upsert(
      {
        matter_id: matter.id,
        advocate_user_id: context.userId,
        granted_by: matter.attorney_user_id,
        advocate_email: email,
        advocate_name: invitation.advocate_name,
        revoked_at: null,
      },
      { onConflict: "matter_id,advocate_user_id" },
    );
    if (assignError) throw new Error(assignError.message);

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "advocate")) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: context.userId, role: "advocate" as const });
    }
    await supabaseAdmin
      .from("matter_advocate_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: context.userId,
      })
      .eq("id", invitation.id);
    return { ok: true, matter_id: matter.id };
  });

export const listMyAssignedMatters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: assignments } = await supabaseAdmin
      .from("matter_advocates")
      .select("id,matter_id,created_at")
      .eq("advocate_user_id", context.userId)
      .is("revoked_at", null);
    const ids = (assignments ?? []).map((a) => a.matter_id);
    if (!ids.length) return { matters: [] };
    const { data: matters } = await supabaseAdmin
      .from("matters")
      .select(
        "id,matter_name,matter_number,case_type,court,jurisdiction,status,client_link_id,created_at",
      )
      .in("id", ids)
      .order("created_at", { ascending: false });
    const linkIds = (matters ?? []).map((m) => m.client_link_id).filter(Boolean) as string[];
    const links = linkIds.length
      ? ((
          await supabaseAdmin
            .from("attorney_client_links")
            .select("id,client_user_id,status")
            .in("id", linkIds)
        ).data ?? [])
      : [];
    return {
      matters: (matters ?? []).map((m) => {
        const link = links.find((l) => l.id === m.client_link_id);
        return {
          ...m,
          client_user_id: link && link.status === "active" ? link.client_user_id : null,
        };
      }),
    };
  });
