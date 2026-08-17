import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * DV organization advocate access.
 *
 * Mirrors the attorney invite/link pattern exactly: the survivor invites an
 * advocate by email, the advocate opens a secure token link, signs in with the
 * invited address, and receives a READ-ONLY view of the case. The survivor can
 * see and revoke that access at any time. No billing — this tier is free.
 */

/* ------------------------------ survivor side ------------------------------ */

export const createAdvocateInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        advocate_email: z.string().email().max(255),
        advocate_name: z.string().trim().max(120).optional(),
        org_name: z.string().trim().max(200).optional(),
        personal_note: z.string().trim().max(2000).optional(),
        date_range_start: z.string().optional().nullable(),
        date_range_end: z.string().optional().nullable(),
        include_all_incidents: z.boolean().default(true),
        include_all_evidence: z.boolean().default(true),
        include_patterns: z.boolean().default(true),
        expires_days: z.number().int().min(1).max(365).default(30),
        case_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let scopedCaseId: string | null = null;
    if (data.case_id) {
      const { data: c } = await supabaseAdmin
        .from("cases")
        .select("id")
        .eq("id", data.case_id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!c) throw new Error("That case isn't on your account.");
      scopedCaseId = c.id;
    }
    const expires = new Date(Date.now() + data.expires_days * 86400000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("advocate_invitations")
      .insert({
        client_user_id: context.userId,
        advocate_email: data.advocate_email.toLowerCase(),
        advocate_name: data.advocate_name ?? null,
        org_name: data.org_name ?? null,
        personal_note: data.personal_note ?? null,
        date_range_start: data.date_range_start || null,
        date_range_end: data.date_range_end || null,
        include_all_incidents: data.include_all_incidents,
        include_all_evidence: data.include_all_evidence,
        include_patterns: data.include_patterns,
        expires_at: expires,
        case_id: scopedCaseId,
      })
      .select("id,invite_token,expires_at")
      .single();
    if (error) throw new Error(error.message);
    return { invitation: row };
  });

export const listMyAdvocateAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invitations } = await supabaseAdmin
      .from("advocate_invitations")
      .select("*")
      .eq("client_user_id", context.userId)
      .order("created_at", { ascending: false });
    const { data: links } = await supabaseAdmin
      .from("advocate_client_links")
      .select("id,advocate_user_id,invitation_id,created_at,status,revoked_at,include_all_incidents,include_all_evidence,include_patterns,case_id")
      .eq("client_user_id", context.userId)
      .order("created_at", { ascending: false });

    const advocateIds = (links ?? []).map((l) => l.advocate_user_id);
    const { data: profiles } = advocateIds.length
      ? await supabaseAdmin
          .from("advocate_profiles")
          .select("user_id,full_name,org_name,email")
          .in("user_id", advocateIds)
      : { data: [] as Array<{ user_id: string; full_name: string; org_name: string | null; email: string }> };
    const profMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    const caseIds = Array.from(
      new Set([
        ...(links ?? []).map((l) => l.case_id).filter((v): v is string => !!v),
        ...(invitations ?? []).map((i) => i.case_id).filter((v): v is string => !!v),
      ]),
    );
    const { data: cases } = caseIds.length
      ? await supabaseAdmin.from("cases").select("id,case_name,other_party").in("id", caseIds)
      : { data: [] as Array<{ id: string; case_name: string | null; other_party: string | null }> };
    const caseMap = new Map((cases ?? []).map((c) => [c.id, c]));
    const labelFor = (id: string | null) => {
      if (!id) return null;
      const c = caseMap.get(id);
      if (!c) return null;
      return (c.case_name?.trim() || c.other_party?.trim() || "Case") as string;
    };

    return {
      invitations: (invitations ?? []).map((i) => ({ ...i, case_label: labelFor(i.case_id) })),
      links: (links ?? []).map((l) => {
        const inv = l.invitation_id ? (invitations ?? []).find((i) => i.id === l.invitation_id) : undefined;
        return {
          ...l,
          profile: profMap.get(l.advocate_user_id) ?? null,
          case_label: labelFor(l.case_id),
          grant: {
            date_range_start: inv?.date_range_start ?? null,
            date_range_end: inv?.date_range_end ?? null,
            expires_at: inv?.expires_at ?? null,
            granted_at: l.created_at,
            invited_email: inv?.advocate_email ?? null,
            org_name: inv?.org_name ?? null,
          },
        };
      }),
    };
  });

export const revokeAdvocateInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("advocate_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("client_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeAdvocateLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("advocate_client_links")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("client_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ advocate side ------------------------------ */

export const peekAdvocateInvitation = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("advocate_invitations")
      .select("id,advocate_email,advocate_name,org_name,personal_note,status,expires_at,include_all_incidents,include_all_evidence,include_patterns,case_id")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) return { status: "not-found" as const };
    if (inv.status !== "pending") return { status: inv.status as "accepted" | "revoked" };
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return { status: "expired" as const };
    let case_label: string | null = null;
    if (inv.case_id) {
      const { data: c } = await supabaseAdmin
        .from("cases")
        .select("case_name,other_party")
        .eq("id", inv.case_id)
        .maybeSingle();
      if (c) case_label = (c.case_name?.trim() || c.other_party?.trim() || "Case") as string;
    }
    return { status: "ok" as const, invitation: { ...inv, case_label } };
  });

export const acceptAdvocateInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        token: z.string().min(8).max(128),
        full_name: z.string().trim().min(1).max(120).optional(),
        org_name: z.string().trim().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("advocate_invitations")
      .select("*")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Invitation not found");
    if (inv.status !== "pending") throw new Error("Invitation no longer valid");
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) throw new Error("Invitation expired");

    const jwtEmail = (context.claims as { email?: string } | undefined)?.email?.toLowerCase();
    if (!jwtEmail || jwtEmail !== String(inv.advocate_email).toLowerCase()) {
      throw new Error("This invitation was sent to a different email address.");
    }

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "advocate" }, { onConflict: "user_id,role" });

    await supabaseAdmin.from("advocate_profiles").upsert(
      {
        user_id: context.userId,
        full_name: data.full_name?.trim() || inv.advocate_name || jwtEmail,
        org_name: data.org_name?.trim() || inv.org_name || null,
        email: jwtEmail,
        onboarded: true,
      },
      { onConflict: "user_id" },
    );

    const { data: existing } = await supabaseAdmin
      .from("advocate_client_links")
      .select("id")
      .eq("advocate_user_id", context.userId)
      .eq("client_user_id", inv.client_user_id)
      .maybeSingle();

    let linkId = existing?.id ?? null;
    if (linkId) {
      await supabaseAdmin
        .from("advocate_client_links")
        .update({
          status: "active",
          revoked_at: null,
          invitation_id: inv.id,
          include_all_incidents: inv.include_all_incidents,
          include_all_evidence: inv.include_all_evidence,
          include_patterns: inv.include_patterns,
          case_id: inv.case_id ?? null,
        })
        .eq("id", linkId);
    } else {
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("advocate_client_links")
        .insert({
          advocate_user_id: context.userId,
          client_user_id: inv.client_user_id,
          invitation_id: inv.id,
          include_all_incidents: inv.include_all_incidents,
          include_all_evidence: inv.include_all_evidence,
          include_patterns: inv.include_patterns,
          scope_incidents: inv.scope_incidents,
          scope_evidence: inv.scope_evidence,
          case_id: inv.case_id ?? null,
          status: "active",
        })
        .select("id")
        .single();
      if (linkErr) throw new Error(linkErr.message);
      linkId = link.id;
    }

    await supabaseAdmin
      .from("advocate_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: context.userId })
      .eq("id", inv.id);

    await supabaseAdmin.rpc("record_audit_event", {
      p_user_id: inv.client_user_id,
      p_event_type: "advocate_access_granted",
      p_subject_kind: "advocate_client_link",
      p_subject_id: linkId,
      p_actor_kind: "advocate",
      p_actor_id: context.userId,
      p_meta: { org_name: inv.org_name ?? null },
    });

    return { ok: true, clientId: inv.client_user_id as string };
  });

export const getMyAdvocateRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "advocate")
      .maybeSingle();
    const { data: profile } = await supabaseAdmin
      .from("advocate_profiles")
      .select("full_name,org_name,email")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { isAdvocate: !!role, profile: profile ?? null };
  });

export const listAdvocateClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: links } = await supabaseAdmin
      .from("advocate_client_links")
      .select("id,client_user_id,created_at,status,revoked_at,case_id")
      .eq("advocate_user_id", context.userId)
      .order("created_at", { ascending: false });
    const clientIds = (links ?? []).map((l) => l.client_user_id);
    const { data: cases } = clientIds.length
      ? await supabaseAdmin.from("cases").select("id,user_id,case_name,other_party").in("user_id", clientIds)
      : { data: [] as Array<{ id: string; user_id: string; case_name: string | null; other_party: string | null }> };
    return {
      clients: (links ?? []).map((l) => {
        const c = (cases ?? []).find((x) => (l.case_id ? x.id === l.case_id : x.user_id === l.client_user_id));
        return {
          ...l,
          case_label: c ? (c.case_name?.trim() || c.other_party?.trim() || "Case") : null,
        };
      }),
    };
  });

/** Read-only case view for an advocate. No notes, no writes, no file downloads. */
export const getAdvocateCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("advocate_client_links")
      .select("id,status,include_all_incidents,include_all_evidence,include_patterns,scope_incidents,scope_evidence,case_id,created_at,invitation_id")
      .eq("advocate_user_id", context.userId)
      .eq("client_user_id", data.clientId)
      .maybeSingle();
    if (!link || link.status !== "active") throw new Error("No active access");

    let includeAllIncidents = link.include_all_incidents;
    let includeAllEvidence = link.include_all_evidence;
    let scopedIncidents = (link.scope_incidents ?? []) as string[];
    let scopedEvidence = (link.scope_evidence ?? []) as string[];

    if (link.case_id) {
      const { data: c } = await supabaseAdmin
        .from("cases")
        .select("highlighted_incident_ids,attached_evidence_ids")
        .eq("id", link.case_id)
        .eq("user_id", data.clientId)
        .maybeSingle();
      includeAllIncidents = false;
      includeAllEvidence = false;
      scopedIncidents = (c?.highlighted_incident_ids ?? []) as string[];
      scopedEvidence = (c?.attached_evidence_ids ?? []) as string[];
    }

    const [incQ, evQ, patQ, caseQ] = await Promise.all([
      includeAllIncidents
        ? supabaseAdmin.from("incidents").select("*").eq("user_id", data.clientId).is("deleted_at", null).eq("is_sealed", false).or("source.neq.ai_extracted,confirmed_at.not.is.null").order("date", { ascending: true })
        : scopedIncidents.length
          ? supabaseAdmin.from("incidents").select("*").eq("user_id", data.clientId).in("id", scopedIncidents).is("deleted_at", null).eq("is_sealed", false).or("source.neq.ai_extracted,confirmed_at.not.is.null").order("date", { ascending: true })
          : Promise.resolve({ data: [] }),
      includeAllEvidence
        ? supabaseAdmin.from("evidence").select("*").eq("user_id", data.clientId).is("deleted_at", null).eq("is_sealed", false).neq("review_status", "suggested").order("date", { ascending: true })
        : scopedEvidence.length
          ? supabaseAdmin.from("evidence").select("*").eq("user_id", data.clientId).in("id", scopedEvidence).is("deleted_at", null).eq("is_sealed", false).neq("review_status", "suggested").order("date", { ascending: true })
          : Promise.resolve({ data: [] }),
      link.include_patterns
        ? supabaseAdmin.from("pattern_analyses").select("*").eq("user_id", data.clientId).order("created_at", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      link.case_id
        ? supabaseAdmin.from("cases").select("*").eq("id", link.case_id).eq("user_id", data.clientId).maybeSingle()
        : supabaseAdmin.from("cases").select("*").eq("user_id", data.clientId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    // Advocates get an allowlisted projection only: survivor-approved
    // narratives plus evidence titles/dates/descriptions. No files, no GPS,
    // no EXIF/raw metadata, no filenames, no checksums, no transcripts.
    const {
      shapeAdvocateIncident, shapeAdvocateEvidence, shapeAdvocateCase, withinDateWindow,
    } = await import("@/lib/advocate-scope");

    // Pattern analysis is survivor-review gated before it leaves the survivor's
    // account: claims marked "rejected" (or still "unsure") are stripped out.
    const { buildPatternExport } = await import("@/lib/pattern-export");
    const rawPattern = patQ.data as
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | { analysis: any; reviewed_status?: any; created_at?: string }
      | null;
    const gatedPattern = rawPattern
      ? buildPatternExport(rawPattern.analysis, rawPattern.reviewed_status)
      : null;
    const patternForAdvocate =
      rawPattern && gatedPattern && Object.keys(gatedPattern.redactedAnalysis).length > 0
        ? {
            created_at: rawPattern.created_at ?? null,
            analysis: gatedPattern.redactedAnalysis,
            excluded_rejected_claims: gatedPattern.rejectedCount,
            withheld_unsure_claims: gatedPattern.unsureCount,
          }
        : null;

    let grant = { date_range_start: null as string | null, date_range_end: null as string | null, expires_at: null as string | null };
    if (link.invitation_id) {
      const { data: inv } = await supabaseAdmin
        .from("advocate_invitations")
        .select("date_range_start,date_range_end,expires_at")
        .eq("id", link.invitation_id)
        .maybeSingle();
      if (inv) {
        grant = {
          date_range_start: inv.date_range_start ?? null,
          date_range_end: inv.date_range_end ?? null,
          expires_at: inv.expires_at ?? null,
        };
      }
    }

    const incidentsForAdvocate = withinDateWindow(
      (incQ.data ?? []) as Array<Record<string, unknown>>,
      grant.date_range_start,
      grant.date_range_end,
    ).map(shapeAdvocateIncident);
    const evidenceForAdvocate = withinDateWindow(
      (evQ.data ?? []) as Array<Record<string, unknown>>,
      grant.date_range_start,
      grant.date_range_end,
    ).map(shapeAdvocateEvidence);

    return {
      case: shapeAdvocateCase((caseQ.data ?? null) as Record<string, unknown> | null),
      incidents: incidentsForAdvocate,
      evidence: evidenceForAdvocate,
      pattern_analysis: patternForAdvocate,
      consent: {
        granted_at: link.created_at,
        include_all_incidents: includeAllIncidents,
        include_all_evidence: includeAllEvidence,
        include_patterns: link.include_patterns,
        scoped_incident_count: includeAllIncidents ? null : scopedIncidents.length,
        scoped_evidence_count: includeAllEvidence ? null : scopedEvidence.length,
        case_scoped: !!link.case_id,
        ...grant,
      },
    };
  });