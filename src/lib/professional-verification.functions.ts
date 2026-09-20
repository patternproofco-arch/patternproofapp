import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  ATTORNEY_NOT_VERIFIED_MESSAGE,
  ORG_NOT_VERIFIED_MESSAGE,
  SURVIVOR_CONFIRM_REQUIRED_MESSAGE,
  VERIFICATION_STATUSES,
  assertAttorneyVerified,
  attorneyHasVerifiedJurisdiction,
  assertOrgVerified,
  denyAttorneySurvivorLookup,
  isLiveVerifiedStatus,
} from "@/lib/professional-verification.server";

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

const statusSchema = z.enum(VERIFICATION_STATUSES);

/* -------------------- admin: human CLEAR only -------------------- */

export const setOrgVerificationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        org_id: z.string().uuid(),
        status: statusSchema,
        reason: z.string().trim().max(2000).optional().nullable(),
        expires_at: z.string().datetime().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    // No payment / scrape path — human actor only via admin role.
    const { error } = await supabaseAdmin.rpc("set_org_verification_status", {
      p_org_id: data.org_id,
      p_status: data.status,
      p_actor_id: context.userId,
      p_reason: data.reason ?? null,
      p_expires_at: data.expires_at ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setAttorneyVerificationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        attorney_user_id: z.string().uuid(),
        status: statusSchema,
        reason: z.string().trim().max(2000).optional().nullable(),
        expires_at: z.string().datetime().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    if (
      data.status === "verified" &&
      !(await attorneyHasVerifiedJurisdiction(supabaseAdmin, data.attorney_user_id))
    ) {
      throw new Error(
        "Every bar jurisdiction must have current verification before this account can be verified.",
      );
    }
    const { error } = await supabaseAdmin.rpc("set_attorney_verification_status", {
      p_user_id: data.attorney_user_id,
      p_status: data.status,
      p_actor_id: context.userId,
      p_reason: data.reason ?? null,
      p_expires_at: data.expires_at ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Record a bar-jurisdiction CLEAR. Callback phone must be the bar-record
 * phone supplied by the reviewer — never auto-copied from signup.
 */
export const setAttorneyBarJurisdictionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        attorney_user_id: z.string().uuid(),
        jurisdiction: z.string().trim().min(2).max(120),
        bar_number: z.string().trim().max(60).optional().nullable(),
        bar_callback_phone: z.string().trim().max(40).optional().nullable(),
        status: statusSchema,
        expires_at: z.string().datetime().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    if (data.status === "verified" && !data.bar_callback_phone?.trim()) {
      throw new Error("Bar CLEAR requires the callback phone from the bar record.");
    }
    const patch = {
      attorney_user_id: data.attorney_user_id,
      jurisdiction: data.jurisdiction,
      bar_number: data.bar_number ?? null,
      bar_callback_phone: data.bar_callback_phone ?? null,
      verification_status: data.status,
      verified_at: data.status === "verified" ? new Date().toISOString() : null,
      verified_by: data.status === "verified" ? context.userId : null,
      verification_expires_at:
        data.status === "verified"
          ? (data.expires_at ?? new Date(Date.now() + 365 * 86_400_000).toISOString())
          : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from("attorney_bar_jurisdictions").upsert(patch, {
      onConflict: "attorney_user_id,jurisdiction",
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Proof metadata only — bytes stay in storage; never forwarded to AI. */
export const recordVerificationProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        subject_kind: z.enum(["organization", "attorney"]),
        subject_id: z.string().uuid(),
        storage_path: z.string().trim().min(3).max(500),
        content_type: z.string().trim().max(120).optional().nullable(),
        original_filename: z.string().trim().max(260).optional().nullable(),
        byte_size: z.number().int().min(0).max(50_000_000).optional().nullable(),
        reviewer_note: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("professional_verification_proofs")
      .insert({
        subject_kind: data.subject_kind,
        subject_id: data.subject_id,
        uploaded_by: context.userId,
        storage_path: data.storage_path,
        content_type: data.content_type ?? null,
        original_filename: data.original_filename ?? null,
        byte_size: data.byte_size ?? null,
        reviewer_note: data.reviewer_note ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: row.id as string };
  });

/* -------------------- share targets / search (Verified only) -------------------- */

export const searchVerifiedOrganizations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ query: z.string().trim().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.query.replace(/[%_]/g, "");
    const { data: rows, error } = await supabaseAdmin
      .from("dv_organizations")
      .select("id,name,verification_status,verification_expires_at")
      .ilike("name", `%${q}%`)
      .limit(25);
    if (error) throw new Error(error.message);
    const orgs = (
      (rows ?? []) as Array<{
        id: string;
        name: string;
        verification_status: string;
        verification_expires_at: string | null;
      }>
    )
      .filter((o) => isLiveVerifiedStatus(o.verification_status, o.verification_expires_at))
      .map((o) => ({ id: o.id, name: o.name }));
    return { orgs };
  });

/**
 * Survivor-facing attorney share targets. Address hidden by default.
 * Never returns Pending/Suspended. Never exposes survivor lookup.
 */
export const searchVerifiedAttorneysForShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ query: z.string().trim().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.query.replace(/[%_]/g, "");
    const { data: rows, error } = await supabaseAdmin
      .from("attorney_profiles")
      .select(
        "user_id,full_name,firm_name,verification_status,verification_expires_at,address_visible_to_survivors,office_address",
      )
      .or(`full_name.ilike.%${q}%,firm_name.ilike.%${q}%`)
      .limit(25);
    if (error) throw new Error(error.message);
    const candidates = (rows ?? []) as Array<{
      user_id: string;
      full_name: string;
      firm_name: string | null;
      verification_status: string;
      verification_expires_at: string | null;
      address_visible_to_survivors: boolean;
      office_address: string | null;
    }>;
    const out: Array<{
      user_id: string;
      full_name: string;
      firm_name: string | null;
      office_address: string | null;
    }> = [];
    for (const row of candidates) {
      if (!isLiveVerifiedStatus(row.verification_status, row.verification_expires_at)) continue;
      try {
        await assertAttorneyVerified(supabaseAdmin, row.user_id);
      } catch {
        continue;
      }
      out.push({
        user_id: row.user_id,
        full_name: row.full_name,
        firm_name: row.firm_name,
        office_address: row.address_visible_to_survivors ? row.office_address : null,
      });
    }
    return { attorneys: out };
  });

/** Explicit hard-deny surface — any future "lookup survivor" attempt should call this. */
export const attorneyLookupSurvivor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().optional(),
        name: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async () => {
    denyAttorneySurvivorLookup();
  });

/* -------------------- survivor confirm + engagement -------------------- */

export const confirmAttorneyShareIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        invitation_id: z.string().uuid(),
        is_my_attorney: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin
      .from("attorney_invitations")
      .select("id,client_user_id,status")
      .eq("id", data.invitation_id)
      .eq("client_user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv || inv.status !== "pending") throw new Error("Invitation not found.");
    const { error: upErr } = await supabaseAdmin
      .from("attorney_invitations")
      .update({
        survivor_confirmed_attorney_at: new Date().toISOString(),
        survivor_confirmed_attorney_by: context.userId,
      })
      .eq("id", data.invitation_id)
      .eq("client_user_id", context.userId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true as const };
  });

export const confirmAttorneyCaseEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ link_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAttorneyVerified(supabaseAdmin, context.userId);
    const { data: link } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id,attorney_user_id,status")
      .eq("id", data.link_id)
      .eq("attorney_user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();
    if (!link) throw new Error("Active case link not found.");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("attorney_client_links")
      .update({
        case_engagement_confirmed_at: now,
        case_engagement_confirmed_by: context.userId,
        reminder_150_sent_at: null,
        reminder_165_sent_at: null,
        reminder_175_sent_at: null,
        survivor_notice_sent_at: null,
        cutoff_at: null,
      })
      .eq("id", data.link_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("attorney_access_confirmations").insert({
      link_id: data.link_id,
      confirmed_by: context.userId,
      confirmed_role: "attorney",
    });
    return { ok: true as const };
  });

export const listMySuspensionNotices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("professional_suspension_notices")
      .select("id,subject_kind,subject_id,created_at,seen_at")
      .eq("survivor_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { notices: data ?? [] };
  });

export const markSuspensionNoticeSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("professional_suspension_notices")
      .update({ seen_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("survivor_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export {
  ORG_NOT_VERIFIED_MESSAGE,
  ATTORNEY_NOT_VERIFIED_MESSAGE,
  SURVIVOR_CONFIRM_REQUIRED_MESSAGE,
};

/** Own status and renewal handles only; no survivor identities or case content. */
export const getMyVerificationReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("attorney_profiles")
      .select("verification_status,verification_expires_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { data: jurisdictions, error: barError } = await supabaseAdmin
      .from("attorney_bar_jurisdictions")
      .select("jurisdiction,verification_status,verification_expires_at")
      .eq("attorney_user_id", context.userId);
    if (barError) throw new Error(barError.message);
    let verified = false;
    try {
      await assertAttorneyVerified(supabaseAdmin, context.userId);
      verified = true;
    } catch {
      /* deny */
    }
    const { data: links, error: linksError } = verified
      ? await supabaseAdmin
          .from("attorney_client_links")
          .select("id,created_at,case_engagement_confirmed_at")
          .eq("attorney_user_id", context.userId)
          .eq("status", "active")
      : { data: [], error: null };
    if (linksError) throw new Error(linksError.message);
    const { isCaseEngagementCurrent } = await import("@/lib/professional-verification.server");
    return {
      profile,
      verified,
      jurisdictions: jurisdictions ?? [],
      renewals: (links ?? []).filter(
        (link) => !isCaseEngagementCurrent(link.created_at, link.case_engagement_confirmed_at),
      ),
    };
  });

export const listProfessionalReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context.userId);
    const [orgs, attorneys, jurisdictions] = await Promise.all([
      admin
        .from("dv_organizations")
        .select("id,name,verification_status,verification_expires_at")
        .order("name")
        .limit(100),
      admin
        .from("attorney_profiles")
        .select(
          "user_id,full_name,email,jurisdiction,bar_number,verification_status,verification_expires_at",
        )
        .order("full_name")
        .limit(100),
      admin
        .from("attorney_bar_jurisdictions")
        .select("attorney_user_id,jurisdiction,verification_status,verification_expires_at")
        .limit(1000),
    ]);
    for (const result of [orgs, attorneys, jurisdictions])
      if (result.error) throw new Error(result.error.message);
    return {
      orgs: orgs.data ?? [],
      attorneys: attorneys.data ?? [],
      jurisdictions: jurisdictions.data ?? [],
    };
  });


/* ------------------------- survivor: cutoff-warning notices ------------------------- */

export const listMyAttorneyAccessNotices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: notices, error } = await supabaseAdmin
      .from("attorney_access_notices")
      .select("id,link_id,notice_type,created_at,read_at,action,action_at")
      .eq("client_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    const rows = notices ?? [];
    const linkIds = Array.from(new Set(rows.map((n) => n.link_id)));
    const { data: links } = linkIds.length
      ? await supabaseAdmin
          .from("attorney_client_links")
          .select("id,attorney_user_id,status")
          .in("id", linkIds)
      : { data: [] as Array<{ id: string; attorney_user_id: string; status: string }> };
    const attorneyIds = Array.from(new Set((links ?? []).map((l) => l.attorney_user_id)));
    const { data: profiles } = attorneyIds.length
      ? await supabaseAdmin.from("attorney_profiles").select("user_id,full_name").in("user_id", attorneyIds)
      : { data: [] as Array<{ user_id: string; full_name: string | null }> };
    const linkById = new Map((links ?? []).map((l) => [l.id, l]));
    const nameByAttorney = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));
    return {
      notices: rows.map((n) => {
        const link = linkById.get(n.link_id);
        return {
          ...n,
          attorney_name: link ? (nameByAttorney.get(link.attorney_user_id) ?? "Your attorney") : "Your attorney",
          link_still_active: link?.status === "active",
        };
      }),
    };
  });

/** Survivor one-tap keep-access. In-app only. Cannot revive a cutoff link. */
export const keepAttorneyAccessGoing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ notice_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: notice, error } = await supabaseAdmin
      .from("attorney_access_notices")
      .select("id,link_id,client_user_id,action_at")
      .eq("id", data.notice_id)
      .eq("client_user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!notice || notice.action_at) throw new Error("This notice is no longer actionable.");

    const { data: link } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id,status,client_user_id")
      .eq("id", notice.link_id)
      .maybeSingle();
    if (!link || link.client_user_id !== context.userId || link.status !== "active") {
      throw new Error("This access has already ended.");
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("attorney_client_links")
      .update({
        case_engagement_confirmed_at: now,
        case_engagement_confirmed_by: context.userId,
        reminder_150_sent_at: null,
        reminder_165_sent_at: null,
        reminder_175_sent_at: null,
        survivor_notice_sent_at: null,
        cutoff_at: null,
      })
      .eq("id", notice.link_id);
    await supabaseAdmin.from("attorney_access_confirmations").insert({
      link_id: notice.link_id,
      confirmed_by: context.userId,
      confirmed_role: "survivor",
    });
    await supabaseAdmin
      .from("attorney_access_notices")
      .update({ action: "kept_access", action_at: now, read_at: now })
      .eq("id", data.notice_id);
    return { ok: true as const };
  });
