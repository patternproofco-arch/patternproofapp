import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ------------------------ firm membership ------------------------ */

export const getMyFirm = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("attorney_profiles")
      .select("user_id,full_name,email,firm_id,firm_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!prof) return { profile: null, firm: null, colleagues: [] };
    if (!prof.firm_id) return { profile: prof, firm: null, colleagues: [] };
    const { data: firm } = await supabaseAdmin
      .from("firms")
      .select("id,name,created_at")
      .eq("id", prof.firm_id)
      .maybeSingle();
    const { data: colleagues } = await supabaseAdmin
      .from("attorney_profiles")
      .select("user_id,full_name,email,role")
      .eq("firm_id", prof.firm_id)
      .neq("user_id", context.userId);
    return { profile: prof, firm: firm ?? null, colleagues: colleagues ?? [] };
  });

/**
 * Create-or-join a firm by name. If a firm with the same name (case-insensitive)
 * already exists, attach to it; otherwise create a new one and attach.
 */
export const setMyFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    name: z.string().trim().min(2).max(200),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const name = data.name.trim();
    const { data: existing } = await supabaseAdmin
      .from("firms")
      .select("id,name")
      .ilike("name", name)
      .limit(1)
      .maybeSingle();
    let firmId = existing?.id as string | undefined;
    if (!firmId) {
      const { data: created, error } = await supabaseAdmin
        .from("firms")
        .insert({ name, created_by: context.userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      firmId = created.id;
    }
    const { error: upErr } = await supabaseAdmin
      .from("attorney_profiles")
      .update({ firm_id: firmId, firm_name: name, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, firm_id: firmId };
  });

export const leaveMyFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("attorney_profiles")
      .update({ firm_id: null, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    return { ok: true };
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
    const { data: prof } = await supabaseAdmin
      .from("attorney_profiles")
      .select("firm_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!prof?.firm_id) return { colleagues: [], firm_id: null };
    const { data: colleagues } = await supabaseAdmin
      .from("attorney_profiles")
      .select("user_id,full_name,email,role")
      .eq("firm_id", prof.firm_id)
      .neq("user_id", context.userId);
    return { colleagues: colleagues ?? [], firm_id: prof.firm_id };
  });

export const listCaseGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const link = await assertOwnerLink(data.clientId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: grants } = await supabaseAdmin
      .from("case_grants")
      .select("id,attorney_user_id,granted_at,revoked_at")
      .eq("client_link_id", link.id)
      .order("granted_at", { ascending: false });
    const ids = (grants ?? []).map((g) => g.attorney_user_id);
    let profiles: { user_id: string; full_name: string; email: string }[] = [];
    if (ids.length) {
      const { data } = await supabaseAdmin
        .from("attorney_profiles")
        .select("user_id,full_name,email")
        .in("user_id", ids);
      profiles = data ?? [];
    }
    const byId = new Map(profiles.map((p) => [p.user_id, p]));
    return {
      grants: (grants ?? []).map((g) => ({
        id: g.id,
        attorney_user_id: g.attorney_user_id,
        granted_at: g.granted_at,
        revoked_at: g.revoked_at,
        full_name: byId.get(g.attorney_user_id)?.full_name ?? null,
        email: byId.get(g.attorney_user_id)?.email ?? null,
      })),
    };
  });

export const grantCaseAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    clientId: z.string().uuid(),
    attorney_user_id: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.attorney_user_id === context.userId) throw new Error("You already own this case.");
    const link = await assertOwnerLink(data.clientId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Verify the colleague is in the same firm
    const { data: me } = await supabaseAdmin
      .from("attorney_profiles")
      .select("firm_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!me?.firm_id) throw new Error("Set your firm before sharing a case.");
    const { data: them } = await supabaseAdmin
      .from("attorney_profiles")
      .select("user_id,firm_id")
      .eq("user_id", data.attorney_user_id)
      .maybeSingle();
    if (!them || them.firm_id !== me.firm_id) throw new Error("That attorney isn't in your firm.");

    // Reactivate if a previously revoked row exists; otherwise insert
    const { data: existing } = await supabaseAdmin
      .from("case_grants")
      .select("id,revoked_at")
      .eq("client_link_id", link.id)
      .eq("attorney_user_id", data.attorney_user_id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin
        .from("case_grants")
        .update({ revoked_at: null, granted_at: new Date().toISOString(), granted_by: context.userId })
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
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const revokeCaseGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("case_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("granted_by", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Cases that another firm attorney granted to me — used in "Shared with you". */
export const listGrantedToMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: grants } = await supabaseAdmin
      .from("case_grants")
      .select("id,client_link_id,granted_by,granted_at")
      .eq("attorney_user_id", context.userId)
      .is("revoked_at", null);
    if (!grants?.length) return { items: [] };
    const linkIds = grants.map((g) => g.client_link_id);
    const granterIds = Array.from(new Set(grants.map((g) => g.granted_by)));
    const [{ data: links }, { data: granters }] = await Promise.all([
      supabaseAdmin
        .from("attorney_client_links")
        .select("id,client_user_id,created_at,status")
        .in("id", linkIds)
        .eq("status", "active"),
      supabaseAdmin
        .from("attorney_profiles")
        .select("user_id,full_name,email")
        .in("user_id", granterIds),
    ]);
    const byLink = new Map((links ?? []).map((l) => [l.id, l]));
    const byGranter = new Map((granters ?? []).map((p) => [p.user_id, p]));
    return {
      items: grants
        .map((g) => {
          const link = byLink.get(g.client_link_id);
          if (!link) return null;
          const granter = byGranter.get(g.granted_by);
          return {
            grant_id: g.id,
            link_id: link.id,
            client_user_id: link.client_user_id,
            granted_at: g.granted_at,
            granted_by_name: granter?.full_name ?? null,
            granted_by_email: granter?.email ?? null,
          };
        })
        .filter(Boolean),
    };
  });