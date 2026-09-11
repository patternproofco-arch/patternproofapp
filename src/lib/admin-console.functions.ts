// -----------------------------------------------------------------------------
// Internal ops/support console — account lookup and share-link revocation for
// PatternProof staff. Every handler requires the caller to hold the "admin"
// row in user_roles (same check org-portal.functions.ts already uses for its
// partner-verification admin page).
//
// PRIVACY RULE, same as org-portal.functions.ts: this console shows account
// plumbing (roles, entitlement status, who a survivor has shared with) — it
// never surfaces survivor incident/evidence content, and the reverse lookup
// (which survivors an attorney/advocate has been granted access to) is a
// count only, never other survivors' identifiers.
// -----------------------------------------------------------------------------

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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

/** Client-side gate for the _admin layout: is the signed-in user an admin? */
export const getMyAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

export type AdminShareGiven = {
  id: string;
  type: "attorney" | "advocate";
  counterpartyLabel: string;
  status: string;
  createdAt: string;
  revokedAt: string | null;
};

export type AdminAccountLookup = {
  account: {
    id: string;
    email: string;
    createdAt: string;
    emailConfirmedAt: string | null;
    lastSignInAt: string | null;
  };
  roles: string[];
  attorney: {
    firmName: string | null;
    fullName: string;
    onboarded: boolean;
    subscriptionStatus: string | null;
    planTier: string | null;
    currentPeriodEnd: string | null;
  } | null;
  advocate: { fullName: string; orgName: string | null; onboarded: boolean } | null;
  orgMembership: { orgName: string; role: string } | null;
  sharesGiven: AdminShareGiven[];
  professionalLinkCounts: { attorneyActive: number; advocateActive: number };
};

export const adminLookupAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ email: z.string().trim().email() }).parse(input))
  .handler(async ({ data, context }): Promise<AdminAccountLookup> => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const email = data.email.trim().toLowerCase();

    // The auth schema isn't exposed over PostgREST, so a matching user is
    // found through the GoTrue admin API rather than a table query. There is
    // no server-side email filter on this SDK version, so this pages through
    // accounts (newest first isn't guaranteed, but pre-pilot volume is small)
    // and stops as soon as it finds a match.
    let authUser: { id: string; email: string; created_at: string; email_confirmed_at: string | null; last_sign_in_at: string | null } | null =
      null;
    for (let page = 1; page <= 20 && !authUser; page++) {
      const { data: listed, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (listErr) throw new Error(listErr.message);
      const match = listed.users.find((u) => u.email?.toLowerCase() === email);
      if (match) {
        authUser = {
          id: match.id,
          email: match.email ?? email,
          created_at: match.created_at,
          email_confirmed_at: match.email_confirmed_at ?? null,
          last_sign_in_at: match.last_sign_in_at ?? null,
        };
      }
      if (listed.users.length < 1000) break;
    }
    if (!authUser) throw new Error("No account found with that email.");

    const uid = authUser.id;

    const [roleRows, attorneyProfile, advocateProfile, orgMember, sub] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", uid),
      supabaseAdmin
        .from("attorney_profiles")
        .select("firm_name,full_name,onboarded")
        .eq("user_id", uid)
        .maybeSingle(),
      supabaseAdmin
        .from("advocate_profiles")
        .select("full_name,org_name,onboarded")
        .eq("user_id", uid)
        .maybeSingle(),
      supabaseAdmin.from("org_members").select("org_id,role").eq("user_id", uid).maybeSingle(),
      supabaseAdmin
        .from("subscriptions")
        .select("status,plan_tier,current_period_end")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    let orgMembership: AdminAccountLookup["orgMembership"] = null;
    if (orgMember.data?.org_id) {
      const { data: org } = await supabaseAdmin
        .from("dv_organizations")
        .select("name")
        .eq("id", orgMember.data.org_id)
        .maybeSingle();
      orgMembership = { orgName: org?.name ?? "Unknown organization", role: orgMember.data.role };
    }

    const [attLinks, advLinks] = await Promise.all([
      supabaseAdmin
        .from("attorney_client_links")
        .select("id,attorney_user_id,status,created_at,revoked_at")
        .eq("client_user_id", uid),
      supabaseAdmin
        .from("advocate_client_links")
        .select("id,advocate_user_id,status,created_at,revoked_at")
        .eq("client_user_id", uid),
    ]);

    const attorneyIds = Array.from(new Set((attLinks.data ?? []).map((l) => l.attorney_user_id)));
    const advocateIds = Array.from(new Set((advLinks.data ?? []).map((l) => l.advocate_user_id)));

    const [attProfiles, advProfiles] = await Promise.all([
      attorneyIds.length
        ? supabaseAdmin.from("attorney_profiles").select("user_id,firm_name,full_name").in("user_id", attorneyIds)
        : Promise.resolve({ data: [] as Array<{ user_id: string; firm_name: string | null; full_name: string }> }),
      advocateIds.length
        ? supabaseAdmin.from("advocate_profiles").select("user_id,full_name,org_name").in("user_id", advocateIds)
        : Promise.resolve({ data: [] as Array<{ user_id: string; full_name: string; org_name: string | null }> }),
    ]);

    const attorneyLabel = new Map(
      (attProfiles.data ?? []).map((p) => [p.user_id, p.firm_name ?? p.full_name]),
    );
    const advocateLabel = new Map(
      (advProfiles.data ?? []).map((p) => [p.user_id, p.org_name ?? p.full_name]),
    );

    const sharesGiven: AdminShareGiven[] = [
      ...(attLinks.data ?? []).map((l) => ({
        id: l.id,
        type: "attorney" as const,
        counterpartyLabel: attorneyLabel.get(l.attorney_user_id) ?? "Unknown attorney",
        status: l.status,
        createdAt: l.created_at,
        revokedAt: l.revoked_at,
      })),
      ...(advLinks.data ?? []).map((l) => ({
        id: l.id,
        type: "advocate" as const,
        counterpartyLabel: advocateLabel.get(l.advocate_user_id) ?? "Unknown advocate",
        status: l.status,
        createdAt: l.created_at,
        revokedAt: l.revoked_at,
      })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // Reverse direction — counts only. Never list which other survivors this
    // professional has access to; that would leak identifiers across cases.
    const [attAsProGiven, advAsProGiven] = await Promise.all([
      supabaseAdmin
        .from("attorney_client_links")
        .select("id", { count: "exact", head: true })
        .eq("attorney_user_id", uid)
        .eq("status", "active"),
      supabaseAdmin
        .from("advocate_client_links")
        .select("id", { count: "exact", head: true })
        .eq("advocate_user_id", uid)
        .eq("status", "active"),
    ]);

    return {
      account: {
        id: uid,
        email: authUser.email,
        createdAt: authUser.created_at,
        emailConfirmedAt: authUser.email_confirmed_at,
        lastSignInAt: authUser.last_sign_in_at,
      },
      roles: (roleRows.data ?? []).map((r) => r.role),
      attorney: attorneyProfile.data
        ? {
            firmName: attorneyProfile.data.firm_name,
            fullName: attorneyProfile.data.full_name,
            onboarded: attorneyProfile.data.onboarded,
            subscriptionStatus: sub.data?.status ?? null,
            planTier: sub.data?.plan_tier ?? null,
            currentPeriodEnd: sub.data?.current_period_end ?? null,
          }
        : null,
      advocate: advocateProfile.data
        ? {
            fullName: advocateProfile.data.full_name,
            orgName: advocateProfile.data.org_name,
            onboarded: advocateProfile.data.onboarded,
          }
        : null,
      orgMembership,
      sharesGiven,
      professionalLinkCounts: {
        attorneyActive: attAsProGiven.count ?? 0,
        advocateActive: advAsProGiven.count ?? 0,
      },
    };
  });

export const adminRevokeShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        linkType: z.enum(["attorney", "advocate"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const table = data.linkType === "attorney" ? "attorney_client_links" : "advocate_client_links";
    const professionalCol = data.linkType === "attorney" ? "attorney_user_id" : "advocate_user_id";

    const { data: link } = await supabaseAdmin
      .from(table)
      .select(`id,client_user_id,${professionalCol}`)
      .eq("id", data.id)
      .maybeSingle();
    if (!link) throw new Error("Share link not found.");

    const { error } = await supabaseAdmin
      .from(table)
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const professionalUserId = (link as Record<string, unknown>)[professionalCol] as string;
    const clientUserId = (link as Record<string, unknown>).client_user_id as string;

    const { purgeProfessionalExports } = await import("@/lib/professional-links.server");
    await purgeProfessionalExports(supabaseAdmin, {
      professionalUserId,
      clientUserId,
    });

    await supabaseAdmin
      .rpc("record_audit_event", {
        p_user_id: clientUserId,
        p_event_type: "access.revoked_by_admin",
        p_subject_kind: data.linkType,
        p_subject_id: data.id,
        p_actor_kind: "admin",
        p_actor_id: context.userId,
        p_meta: { professional_user_id: professionalUserId },
      })
      .then(
        () => undefined,
        (e: unknown) => console.error("[admin] audit log failed", e),
      );

    return { ok: true };
  });
