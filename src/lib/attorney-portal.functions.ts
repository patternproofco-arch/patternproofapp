import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isPossibleNameOverlap } from "@/lib/name-match";

/* ------------------------- shared helpers ------------------------- */

async function assertAttorney(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "attorney")
    .maybeSingle();
  if (!data) throw new Error("Attorney role required");
}

async function resolveFirmId(firmName: string | null | undefined, createdBy: string): Promise<string | null> {
  const name = firmName?.trim();
  if (!name) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("firms")
    .select("id")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await supabaseAdmin
    .from("firms")
    .insert({ name, created_by: createdBy })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}

async function assertSameFirm(attorneyA: string, attorneyB: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("attorney_profiles")
    .select("user_id,firm_id")
    .in("user_id", [attorneyA, attorneyB]);
  const a = (data ?? []).find((p) => p.user_id === attorneyA)?.firm_id;
  const b = (data ?? []).find((p) => p.user_id === attorneyB)?.firm_id;
  if (!a || !b || a !== b) throw new Error("No active firm-level access");
}

async function assertLink(attorneyId: string, clientId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("attorney_client_links")
    .select("id,status,include_all_incidents,include_all_evidence,include_patterns,scope_incidents,scope_evidence,case_id")
    .eq("attorney_user_id", attorneyId)
    .eq("client_user_id", clientId)
    .maybeSingle();
  if (!data || data.status !== "active") throw new Error("No active access");
  await applyCaseScope(data, clientId);
  return data;
}

/**
 * If the link is scoped to a specific case (`case_id`), fold that case's
 * highlighted incident / attached evidence / legal-document IDs into the
 * link's scope fields so downstream query builders (which already understand
 * scope_incidents / scope_evidence + include_all_*) transparently return
 * only per-case data. Legacy links with a null case_id keep their previous
 * "everything the survivor shared" behavior.
 */
async function applyCaseScope(
  link: {
    case_id?: string | null;
    include_all_incidents: boolean;
    include_all_evidence: boolean;
    scope_incidents: string[] | null;
    scope_evidence: string[] | null;
  },
  clientUserId: string,
): Promise<void> {
  if (!link.case_id) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: c } = await supabaseAdmin
    .from("cases")
    .select("highlighted_incident_ids,attached_evidence_ids,legal_document_ids")
    .eq("id", link.case_id)
    .eq("user_id", clientUserId)
    .maybeSingle();
  const inc = (c?.highlighted_incident_ids ?? []) as string[];
  const ev = (c?.attached_evidence_ids ?? []) as string[];
  link.include_all_incidents = false;
  link.include_all_evidence = false;
  link.scope_incidents = inc;
  link.scope_evidence = ev;
}

/**
 * Allow either the owning attorney OR an active case collaborator to access a
 * client case file. Read-only data + messaging only; private attorney notes
 * remain owner-only because their server fns scope by attorney_user_id.
 */
async function assertCaseAccess(userId: string, clientId: string): Promise<{
  link: {
    id: string;
    attorney_user_id?: string;
    status: string;
    include_all_incidents: boolean;
    include_all_evidence: boolean;
    include_patterns: boolean;
    scope_incidents: string[] | null;
    scope_evidence: string[] | null;
    case_id?: string | null;
  };
  role: "owner" | "collaborator";
  collabRole?: "paralegal" | "associate" | "attorney";
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: owner } = await supabaseAdmin
    .from("attorney_client_links")
    .select("id,status,include_all_incidents,include_all_evidence,include_patterns,scope_incidents,scope_evidence,case_id")
    .eq("attorney_user_id", userId)
    .eq("client_user_id", clientId)
    .maybeSingle();
  if (owner && owner.status === "active") {
    await applyCaseScope(owner, clientId);
    return { link: owner, role: "owner" };
  }

  const { data: collabRows } = await supabaseAdmin
    .from("case_collaborators")
    .select("role,link_id")
    .eq("collaborator_user_id", userId)
    .eq("status", "active");

  // Firm-level case grants: owner granted this attorney access to a specific link.
  const { data: grantRows } = await supabaseAdmin
    .from("case_grants")
    .select("client_link_id")
    .eq("attorney_user_id", userId)
    .is("revoked_at", null);

  const candidateLinkIds = [
    ...(collabRows ?? []).map((r) => r.link_id),
    ...(grantRows ?? []).map((r) => r.client_link_id),
  ];
  if (!candidateLinkIds.length) throw new Error("No active access");

  const { data: link } = await supabaseAdmin
    .from("attorney_client_links")
    .select("id,attorney_user_id,status,include_all_incidents,include_all_evidence,include_patterns,scope_incidents,scope_evidence,client_user_id,case_id")
    .in("id", candidateLinkIds)
    .eq("client_user_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (!link) throw new Error("No active access");
  await applyCaseScope(link, clientId);
  const collabRole = (collabRows ?? []).find((c) => c.link_id === link.id)?.role as
    | "paralegal" | "associate" | "attorney" | undefined;
  if (!collabRole && (grantRows ?? []).some((g) => g.client_link_id === link.id)) {
    await assertSameFirm(userId, link.attorney_user_id);
  }
  return { link, role: "collaborator", collabRole };
}

/**
 * Same idea but keyed by link_id (used by message + doc-request fns). Allows
 * the owning attorney, the survivor, or an active collaborator.
 */
async function assertLinkParticipant(linkId: string, userId: string): Promise<{
  link: { id: string; attorney_user_id: string; client_user_id: string; status: string };
  role: "owner" | "survivor" | "collaborator";
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: link } = await supabaseAdmin
    .from("attorney_client_links")
    .select("id,attorney_user_id,client_user_id,status")
    .eq("id", linkId)
    .maybeSingle();
  if (!link || link.status !== "active") throw new Error("No active link");
  if (link.attorney_user_id === userId) return { link, role: "owner" };
  if (link.client_user_id === userId) return { link, role: "survivor" };
  const { data: collab } = await supabaseAdmin
    .from("case_collaborators")
    .select("id")
    .eq("link_id", linkId)
    .eq("collaborator_user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (collab) return { link, role: "collaborator" };
  const { data: grant } = await supabaseAdmin
    .from("case_grants")
    .select("id")
    .eq("client_link_id", linkId)
    .eq("attorney_user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (grant) {
    await assertSameFirm(userId, link.attorney_user_id);
    return { link, role: "collaborator" };
  }
  throw new Error("Not a participant");
}

/* ------------------------- role + profile ------------------------- */

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: rolesData }, { count: collabCount }, { count: grantCount }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId),
      supabaseAdmin
        .from("case_collaborators")
        .select("id", { count: "exact", head: true })
        .eq("collaborator_user_id", context.userId)
        .eq("status", "active"),
      supabaseAdmin
        .from("case_grants")
        .select("id", { count: "exact", head: true })
        .eq("attorney_user_id", context.userId)
        .is("revoked_at", null),
    ]);
    const roles = (rolesData ?? []).map((r) => r.role as string);
    const hasCollaborations = (collabCount ?? 0) > 0 || (grantCount ?? 0) > 0;
    let is_org_partner = false;
    if (roles.includes("advocate")) {
      const { count } = await supabaseAdmin
        .from("referral_links")
        .select("code", { count: "exact", head: true })
        .eq("org_user_id", context.userId);
      is_org_partner = (count ?? 0) > 0;
    }
    let role: "attorney" | "collaborator" | "advocate" | "survivor" = "survivor";
    if (roles.includes("attorney")) role = "attorney";
    else if (roles.includes("advocate") && !roles.includes("survivor")) role = "advocate";
    else if (hasCollaborations) role = "collaborator";
    return { role, roles, hasCollaborations, is_org_partner };
  });

export const upsertAttorneyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      full_name: z.string().trim().min(1).max(120),
      firm_name: z.string().trim().max(200).optional().nullable(),
      bar_number: z.string().trim().max(60).optional().nullable(),
      jurisdiction: z.string().trim().max(120).optional().nullable(),
      email: z.string().email().max(255),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const firm_id = await resolveFirmId(data.firm_name, context.userId);
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: context.userId, role: "attorney" },
      { onConflict: "user_id,role" },
    );
    const { error } = await supabaseAdmin
      .from("attorney_profiles")
      .upsert({ user_id: context.userId, ...data, firm_id, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeAttorneyOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      full_name: z.string().trim().min(1).max(120),
      email: z.string().email().max(255),
      firm_name: z.string().trim().max(200).optional().nullable(),
      bar_number: z.string().trim().max(60).optional().nullable(),
      jurisdiction: z.string().trim().max(120).optional().nullable(),
      role: z.enum(["solo", "firm", "paralegal", "advocate"]),
      confidentiality_accepted: z.literal(true),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const firm_id = await resolveFirmId(data.firm_name, context.userId);
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: context.userId, role: "attorney" },
      { onConflict: "user_id,role" },
    );
    const { error } = await supabaseAdmin
      .from("attorney_profiles")
      .upsert({
        user_id: context.userId,
        full_name: data.full_name,
        email: data.email,
        firm_name: data.firm_name ?? null,
        firm_id,
        bar_number: data.bar_number ?? null,
        jurisdiction: data.jurisdiction ?? null,
        role: data.role,
        confidentiality_accepted_at: new Date().toISOString(),
        onboarded: true,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAttorneyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("attorney_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { profile: data };
  });

/* ------------------------- client list ------------------------- */

export const listMyClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Owner attorney's own client links
    const ownerQ = supabaseAdmin
      .from("attorney_client_links")
      .select("id,client_user_id,created_at,status,include_all_incidents,include_all_evidence,include_patterns,scope_incidents,scope_evidence,case_id")
      .eq("attorney_user_id", context.userId)
      .eq("status", "active");

    // Cases where the caller is an active collaborator
    const collabQ = supabaseAdmin
      .from("case_collaborators")
      .select("link_id")
      .eq("collaborator_user_id", context.userId)
      .eq("status", "active");

    // Cases where the caller has been granted firm-level access
    const grantQ = supabaseAdmin
      .from("case_grants")
      .select("client_link_id,granted_by,granted_at")
      .eq("attorney_user_id", context.userId)
      .is("revoked_at", null);

    const [{ data: ownerLinks }, { data: collabRows }, { data: grantRows }] = await Promise.all([ownerQ, collabQ, grantQ]);
    const sharedLinkIds = Array.from(new Set([
      ...(collabRows ?? []).map((r) => r.link_id),
      ...(grantRows ?? []).map((r) => r.client_link_id),
    ]));
    const grantedSet = new Set((grantRows ?? []).map((r) => r.client_link_id));
    let collabLinks: typeof ownerLinks = [];
    if (sharedLinkIds.length) {
      const { data } = await supabaseAdmin
        .from("attorney_client_links")
        .select("id,client_user_id,created_at,status,include_all_incidents,include_all_evidence,include_patterns,scope_incidents,scope_evidence,case_id")
        .in("id", sharedLinkIds)
        .eq("status", "active");
      collabLinks = data ?? [];
    }
    const linksMap = new Map<string, NonNullable<typeof ownerLinks>[number]>();
    for (const l of (ownerLinks ?? []).concat(collabLinks ?? [])) linksMap.set(l.id, l);
    const ownerSet = new Set((ownerLinks ?? []).map((l) => l.id));
    const links = Array.from(linksMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const clients = await Promise.all(
      (links ?? []).map(async (l) => {
        // Case-scope the link in place so the queries below stay uniform.
        await applyCaseScope(l, l.client_user_id);
        const scopedIncidentIds = (l.scope_incidents ?? []) as string[];
        const scopedEvidenceIds = (l.scope_evidence ?? []) as string[];
        const incidentsQ = l.include_all_incidents
          ? supabaseAdmin.from("incidents").select("id,date,severity_level", { count: "exact" }).eq("user_id", l.client_user_id).is("deleted_at", null).eq("is_sealed", false).or("source.neq.ai_extracted,confirmed_at.not.is.null")
          : scopedIncidentIds.length
            ? supabaseAdmin.from("incidents").select("id,date,severity_level", { count: "exact" }).eq("user_id", l.client_user_id).in("id", scopedIncidentIds).is("deleted_at", null).eq("is_sealed", false).or("source.neq.ai_extracted,confirmed_at.not.is.null")
            : Promise.resolve({ data: [], count: 0 });
        const evidenceQ = l.include_all_evidence
          ? supabaseAdmin.from("evidence").select("id", { count: "exact", head: true }).eq("user_id", l.client_user_id).is("deleted_at", null).eq("is_sealed", false).neq("review_status", "suggested")
          : scopedEvidenceIds.length
            ? supabaseAdmin.from("evidence").select("id", { count: "exact", head: true }).eq("user_id", l.client_user_id).in("id", scopedEvidenceIds).is("deleted_at", null).eq("is_sealed", false).neq("review_status", "suggested")
            : Promise.resolve({ data: null, count: 0 });
        const [inc, ev, pat, msg, doc] = await Promise.all([
          incidentsQ,
          evidenceQ,
          l.include_patterns
            ? supabaseAdmin.from("pattern_analyses").select("analysis,created_at").eq("user_id", l.client_user_id).order("created_at", { ascending: false }).limit(1).maybeSingle()
            : Promise.resolve({ data: null }),
          supabaseAdmin.from("attorney_messages").select("id", { count: "exact", head: true }).eq("link_id", l.id).is("read_at", null).neq("sender_user_id", context.userId),
          supabaseAdmin.from("attorney_document_requests").select("id", { count: "exact", head: true }).eq("link_id", l.id).eq("status", "open"),
        ]);

        const incidents = inc.data ?? [];
        const datedIncidents = incidents.filter((r): r is typeof r & { date: string } => !!r.date);
        const lastIncident = datedIncidents.reduce<string | null>((acc, r) => (!acc || r.date > acc ? r.date : acc), null);
        const earliestIncident = datedIncidents.reduce<string | null>((acc, r) => (!acc || r.date < acc ? r.date : acc), null);
        const avgSeverity = incidents.length
          ? incidents.reduce((s, r) => s + (r.severity_level ?? 0), 0) / incidents.length
          : 0;

        // "documentation_density" summarises how much the survivor has logged
        // (volume of incidents + the 1–5 impact ratings they entered
        // themselves). It is NOT a clinical, forensic, or risk assessment, and
        // nothing in it is AI-generated.
        const documentationDensity: "low" | "moderate" | "elevated" | "high" =
          avgSeverity >= 4 ? "high"
          : avgSeverity >= 3 ? "elevated"
          : incidents.length >= 5 ? "moderate"
          : "low";

        return {
          link_id: l.id,
          client_user_id: l.client_user_id,
          linked_at: l.created_at,
          incident_count: inc.count ?? 0,
          evidence_count: ev.count ?? 0,
          unread_messages: msg.count ?? 0,
          open_doc_requests: doc.count ?? 0,
          last_incident_date: lastIncident,
          earliest_incident_date: earliestIncident,
          avg_severity: avgSeverity,
          documentation_density: documentationDensity,
          documentation_density_note:
            "Reflects documentation volume and the 1–5 impact ratings the survivor entered themselves — not a clinical, forensic, or risk assessment, and not AI-generated.",
          has_pattern_analysis: !!pat.data,
          pattern_updated_at: pat.data?.created_at ?? null,
          access_kind: ownerSet.has(l.id) ? ("owner" as const) : grantedSet.has(l.id) ? ("granted" as const) : ("collaborator" as const),
        };
      }),
    );
    return { clients };
  });

/* ------------------------- single-client case ------------------------- */

/* ------------------------- caseload overview ------------------------- */

export const getCaseloadOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Reuse the same access model as listMyClients: owner links + collaborator + firm-granted links.
    const [{ data: ownerLinks }, { data: collabRows }, { data: grantRows }] = await Promise.all([
      supabaseAdmin
        .from("attorney_client_links")
        .select("id,client_user_id,created_at,status,include_all_incidents,include_all_evidence,include_patterns,scope_incidents,scope_evidence,case_id")
        .eq("attorney_user_id", context.userId)
        .eq("status", "active"),
      supabaseAdmin
        .from("case_collaborators")
        .select("link_id")
        .eq("collaborator_user_id", context.userId)
        .eq("status", "active"),
      supabaseAdmin
        .from("case_grants")
        .select("client_link_id")
        .eq("attorney_user_id", context.userId)
        .is("revoked_at", null),
    ]);

    const sharedLinkIds = Array.from(new Set([
      ...(collabRows ?? []).map((r) => r.link_id),
      ...(grantRows ?? []).map((r) => r.client_link_id),
    ]));
    let sharedLinks: NonNullable<typeof ownerLinks> = [];
    if (sharedLinkIds.length) {
      const { data } = await supabaseAdmin
        .from("attorney_client_links")
        .select("id,client_user_id,created_at,status,include_all_incidents,include_all_evidence,include_patterns,scope_incidents,scope_evidence,case_id")
        .in("id", sharedLinkIds)
        .eq("status", "active");
      sharedLinks = data ?? [];
    }
    const linksMap = new Map<string, NonNullable<typeof ownerLinks>[number]>();
    for (const l of (ownerLinks ?? []).concat(sharedLinks)) linksMap.set(l.id, l);
    const links = Array.from(linksMap.values());

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const rows = await Promise.all(
      links.map(async (l) => {
        await applyCaseScope(l, l.client_user_id);
        const scopedIncidentIds = (l.scope_incidents ?? []) as string[];
        const scopedEvidenceIds = (l.scope_evidence ?? []) as string[];

        // Confirmed-only incident count (matches getClientCase / listMyClients filter).
        const confirmedIncidentsQ = l.include_all_incidents
          ? supabaseAdmin.from("incidents").select("id,date,created_at", { count: "exact" })
              .eq("user_id", l.client_user_id).is("deleted_at", null).eq("is_sealed", false)
              .or("source.neq.ai_extracted,confirmed_at.not.is.null")
          : scopedIncidentIds.length
            ? supabaseAdmin.from("incidents").select("id,date,created_at", { count: "exact" })
                .eq("user_id", l.client_user_id).in("id", scopedIncidentIds).is("deleted_at", null).eq("is_sealed", false)
                .or("source.neq.ai_extracted,confirmed_at.not.is.null")
            : Promise.resolve({ data: [] as { id: string; date: string | null; created_at: string }[], count: 0 });

        // Unconfirmed AI drafts count.
        const unconfirmedQ = l.include_all_incidents
          ? supabaseAdmin.from("incidents").select("id", { count: "exact", head: true })
              .eq("user_id", l.client_user_id).is("deleted_at", null).eq("is_sealed", false)
              .eq("source", "ai_extracted").is("confirmed_at", null)
          : scopedIncidentIds.length
            ? supabaseAdmin.from("incidents").select("id", { count: "exact", head: true })
                .eq("user_id", l.client_user_id).in("id", scopedIncidentIds).is("deleted_at", null).eq("is_sealed", false)
                .eq("source", "ai_extracted").is("confirmed_at", null)
            : Promise.resolve({ data: null, count: 0 });

        // Evidence: total + most recent created_at.
        const evidenceTotalQ = l.include_all_evidence
          ? supabaseAdmin.from("evidence").select("id", { count: "exact", head: true })
              .eq("user_id", l.client_user_id).is("deleted_at", null).eq("is_sealed", false).neq("review_status", "suggested")
          : scopedEvidenceIds.length
            ? supabaseAdmin.from("evidence").select("id", { count: "exact", head: true })
                .eq("user_id", l.client_user_id).in("id", scopedEvidenceIds).is("deleted_at", null).eq("is_sealed", false).neq("review_status", "suggested")
            : Promise.resolve({ data: null, count: 0 });
        const evidenceRecentQ = l.include_all_evidence
          ? supabaseAdmin.from("evidence").select("created_at")
              .eq("user_id", l.client_user_id).is("deleted_at", null).eq("is_sealed", false).neq("review_status", "suggested")
              .order("created_at", { ascending: false }).limit(1).maybeSingle()
          : scopedEvidenceIds.length
            ? supabaseAdmin.from("evidence").select("created_at")
                .eq("user_id", l.client_user_id).in("id", scopedEvidenceIds).is("deleted_at", null).eq("is_sealed", false).neq("review_status", "suggested")
                .order("created_at", { ascending: false }).limit(1).maybeSingle()
            : Promise.resolve({ data: null as { created_at: string } | null });

        // Latest pattern analysis (recency only).
        const patternQ = l.include_patterns
          ? supabaseAdmin.from("pattern_analyses")
              .select("analysis,reviewed_status,created_at")
              .eq("user_id", l.client_user_id)
              .order("created_at", { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null as { analysis: AnyJson; reviewed_status: AnyJson | null; created_at: string } | null });

        const [confirmedInc, unconfirmed, evTotal, evRecent, pattern] = await Promise.all([
          confirmedIncidentsQ, unconfirmedQ, evidenceTotalQ, evidenceRecentQ, patternQ,
        ]);

        const incRows = confirmedInc.data ?? [];
        // "Last activity" = most recent of (incident created_at, evidence created_at, incident date).
        const lastIncidentCreated = incRows.reduce<string | null>((acc, r) => (!acc || r.created_at > acc ? r.created_at : acc), null);
        const lastEvidenceCreated = evRecent.data?.created_at ?? null;
        const lastActivity = [lastIncidentCreated, lastEvidenceCreated]
          .filter((v): v is string => !!v)
          .reduce<string | null>((acc, v) => (!acc || v > acc ? v : acc), null);

        // Disengagement: no incident OR no evidence added in the last 30 days.
        const recentIncidentAdded = incRows.some((r) => r.created_at >= thirtyDaysAgo);
        const recentEvidenceAdded = lastEvidenceCreated ? lastEvidenceCreated >= thirtyDaysAgo : false;
        const disengaged = !recentIncidentAdded && !recentEvidenceAdded;

        return {
          link_id: l.id,
          client_user_id: l.client_user_id,
          linked_at: l.created_at,
          confirmed_incident_count: confirmedInc.count ?? 0,
          unconfirmed_ai_draft_count: unconfirmed.count ?? 0,
          evidence_count: evTotal.count ?? 0,
          last_activity_at: lastActivity,
          disengaged_30d: disengaged,
        };
      }),
    );

    const needs_attention = (r: typeof rows[number]) =>
      r.unconfirmed_ai_draft_count > 0 || r.disengaged_30d;

    rows.sort((a, b) => {
      const aa = needs_attention(a), bb = needs_attention(b);
      if (aa !== bb) return aa ? -1 : 1;
      const aScore = a.unconfirmed_ai_draft_count + (a.disengaged_30d ? 1 : 0);
      const bScore = b.unconfirmed_ai_draft_count + (b.disengaged_30d ? 1 : 0);
      if (aScore !== bScore) return bScore - aScore;
      return (b.last_activity_at ?? "").localeCompare(a.last_activity_at ?? "");
    });

    const disengaged_clients = rows.filter((r) => r.disengaged_30d).map((r) => ({
      client_user_id: r.client_user_id,
      link_id: r.link_id,
      last_activity_at: r.last_activity_at,
    }));

    return {
      totals: {
        active_client_count: rows.length,
        total_unconfirmed_ai_drafts: rows.reduce((s, r) => s + r.unconfirmed_ai_draft_count, 0),
        disengaged_client_count: disengaged_clients.length,
      },
      disengaged_clients,
      clients: rows,
    };
  });

/* ------------------------- single-client case ------------------------- */

// Use `any` here — TanStack server fn serializer rejects `unknown` index signatures,
// and these payloads are arbitrary JSON returned to the client untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyJson = Record<string, any>;

export const getClientCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { link } = await assertCaseAccess(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Provenance: record that this professional opened the case file.
    await supabaseAdmin.rpc("record_audit_event", {
      p_user_id: data.clientId,
      p_event_type: "case.viewed_by_professional",
      p_subject_kind: "case",
      p_subject_id: undefined,
      p_actor_kind: "attorney",
      p_actor_id: context.userId,
      p_meta: { link_id: link.id ?? null },
    }).then(() => undefined, (e: unknown) => console.error("[audit] case view log failed", e));
    const scopedIncidentIds = link.scope_incidents ?? [];
    const scopedEvidenceIds = link.scope_evidence ?? [];

    const [incQ, evQ, patQ, escQ, voiceQ, comsQ, legalQ, caseQ] = await Promise.all([
      link.include_all_incidents
        ? supabaseAdmin.from("incidents").select("*").eq("user_id", data.clientId).is("deleted_at", null).eq("is_sealed", false).or("source.neq.ai_extracted,confirmed_at.not.is.null").order("date", { ascending: true })
        : scopedIncidentIds.length
          ? supabaseAdmin.from("incidents").select("*").eq("user_id", data.clientId).in("id", scopedIncidentIds).is("deleted_at", null).eq("is_sealed", false).or("source.neq.ai_extracted,confirmed_at.not.is.null").order("date", { ascending: true })
          : Promise.resolve({ data: [] }),
      link.include_all_evidence
        ? supabaseAdmin.from("evidence").select("*").eq("user_id", data.clientId).is("deleted_at", null).eq("is_sealed", false).neq("review_status", "suggested").order("date", { ascending: true })
        : scopedEvidenceIds.length
          ? supabaseAdmin.from("evidence").select("*").eq("user_id", data.clientId).in("id", scopedEvidenceIds).is("deleted_at", null).eq("is_sealed", false).neq("review_status", "suggested").order("date", { ascending: true })
          : Promise.resolve({ data: [] }),
      link.include_patterns
        ? supabaseAdmin.from("pattern_analyses").select("*").eq("user_id", data.clientId).order("created_at", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      link.include_all_incidents
        ? supabaseAdmin.from("escalation_flags").select("*").eq("user_id", data.clientId).order("created_at", { ascending: false })
        : scopedIncidentIds.length
          ? supabaseAdmin.from("escalation_flags").select("*").eq("user_id", data.clientId).in("incident_id", scopedIncidentIds).order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
      supabaseAdmin.from("voice_notes").select("id,title,date,transcript,duration_seconds").eq("user_id", data.clientId).order("date", { ascending: false }),
      supabaseAdmin.from("communications").select("id,date,time,direction,channel,from_party,content,harassment_flag,linked_incident_id").eq("user_id", data.clientId).order("date", { ascending: false }),
      supabaseAdmin.from("legal_documents").select("id,title,document_type,effective_date,expiration_date,case_number,court_name").eq("user_id", data.clientId).order("effective_date", { ascending: false }),
      supabaseAdmin.from("cases").select("*").eq("user_id", data.clientId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const incidents = incQ.data ?? [];
    // The attorney should be able to see the exact terms they hold access
    // under, not just the data itself.
    const { data: grantInv } = link.id
      ? await supabaseAdmin
          .from("attorney_client_links")
          .select("created_at,invitation_id")
          .eq("id", link.id)
          .maybeSingle()
      : { data: null };
    let grantRange: { start: string | null; end: string | null; expires: string | null } = {
      start: null, end: null, expires: null,
    };
    if (grantInv?.invitation_id) {
      const { data: inv } = await supabaseAdmin
        .from("attorney_invitations")
        .select("date_range_start,date_range_end,expires_at")
        .eq("id", grantInv.invitation_id)
        .maybeSingle();
      if (inv) {
        grantRange = {
          start: inv.date_range_start ?? null,
          end: inv.date_range_end ?? null,
          expires: inv.expires_at ?? null,
        };
      }
    }
    // Quarantined GPS fields must never reach the attorney UI — the survivor
    // opts in per-item in her own view, and even then it's not shared.
    const evidence = (evQ.data ?? []).map((e) => {
      const clone = { ...(e as Record<string, unknown>) };
      delete clone.gps_lat;
      delete clone.gps_lon;
      delete clone.gps_reveal_opt_in;
      return clone as typeof e;
    });
    const flags = escQ.data ?? [];
    const pattern = (patQ.data ?? null) as { analysis: AnyJson; created_at: string; reviewed_status?: AnyJson } | null;

    /* ---- behavior categories: derived from structured abuse_types tags,
       not regex on free-text descriptions. This is a simple survivor-logged
       tag count, not classification. ---- */
    const categoryCounts: Record<string, number> = {};
    for (const i of incidents) {
      for (const t of (i.abuse_types ?? []) as string[]) {
        if (!t) continue;
        categoryCounts[t] = (categoryCounts[t] ?? 0) + 1;
      }
    }

    /* ---- documented-category counts come from the survivor's own structured
       abuse_types tags. AI-generated behaviour labels ("abuser_tactics") are
       never surfaced: the app reports frequency only, never interpretation. ---- */
    const patternAnalysis = pattern?.analysis ?? {};
    const patternReviewedStatus = (pattern?.reviewed_status ?? {}) as Record<string, AnyJson>;
    const checklist = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([type, count]) => ({
        item: type,
        key: type,
        documented: count > 0,
        count,
        incident_ids: incidents.filter((i) => ((i.abuse_types ?? []) as string[]).includes(type)).map((i) => i.id),
      }));

    /* ---- gaps: deterministic checks + AI pattern-analysis gaps.
       No more regex-derived "Missing category" or "No escalation flags" gaps —
       those are covered (with citations + Confirm/Edit/Reject/Unsure review)
       by the pattern-analysis gaps field. ---- */
    const incidentsWithEvidence = new Set(evidence.map((e) => e.linked_incident_id).filter(Boolean));
    const incidentsWithoutEvidence = incidents.filter((i) => !incidentsWithEvidence.has(i.id));
    const gaps: Array<{
      kind: string;
      detail: string;
      why_it_matters: string;
      suggested_fix: string;
      severity: "low" | "moderate" | "high";
      suggested_request: string;
      source?: "deterministic" | "pattern_analysis";
    }> = [];
    if (incidentsWithoutEvidence.length > 0) {
      gaps.push({
        kind: "Unsupported incidents",
        detail: `${incidentsWithoutEvidence.length} incident${incidentsWithoutEvidence.length === 1 ? "" : "s"} have no linked evidence file.`,
        why_it_matters: "Incidents without corroborating evidence (photos, texts, medical records, witness statements) are vulnerable on cross-examination. Judges weigh patterns more heavily when each event has at least one independent artifact.",
        suggested_fix: "Ask the client to attach any photos, screenshots, messages, medical records, police reports, or third-party messages that reference these events — even if indirect.",
        severity: "high",
        suggested_request: "Please review any unlinked incidents and attach any supporting photos, screenshots, messages, or records you can find — even partial corroboration helps.",
        source: "deterministic",
      });
    }
    const incidentsWithoutSeverity = incidents.filter((i) => i.severity_level == null).length;
    if (incidentsWithoutSeverity > 0) {
      gaps.push({
        kind: "Severity unrated",
        detail: `${incidentsWithoutSeverity} incidents are missing a severity rating.`,
        why_it_matters: "Severity ratings drive the risk timeline and the court-packet summary. Unrated incidents under-count the case's true weight.",
        suggested_fix: "Ask the client to revisit unrated incidents and assign a 1–5 severity based on impact and fear.",
        severity: "low",
        suggested_request: "Some of your incidents don't have a severity rating yet. When you're ready, please open each one and add a 1–5 rating based on how it affected you.",
        source: "deterministic",
      });
    }
    // AI pattern-analysis gaps: { gap, suggestion } per pattern-analysis schema.
    const rawPatternGaps = Array.isArray(patternAnalysis.gaps) ? patternAnalysis.gaps : [];
    for (const g of rawPatternGaps) {
      const label = typeof g === "string" ? g : String((g as AnyJson)?.gap ?? "").trim();
      const suggestion = typeof g === "string" ? "" : String((g as AnyJson)?.suggestion ?? "").trim();
      if (!label) continue;
      gaps.push({
        kind: label,
        detail: label,
        why_it_matters: "",
        suggested_fix: suggestion,
        severity: "moderate",
        suggested_request: suggestion || `Could you tell me more about: ${label}?`,
        source: "pattern_analysis",
      });
    }

    /* ---- documentation density (volume + severity + recency) ---- */
    const flagsHigh = flags.filter((f) => (f.severity_tier ?? 0) >= 3 && !f.dismissed_at).length;
    const avgSeverity = incidents.length
      ? incidents.reduce((s, i) => s + (i.severity_level ?? 0), 0) / incidents.length
      : 0;
    const last30 = incidents.filter((i) => {
      if (!i.date) return false;
      const d = new Date(i.date);
      return Date.now() - d.getTime() < 30 * 24 * 60 * 60 * 1000;
    }).length;
    const documentation_density: "low" | "moderate" | "elevated" | "high" =
      flagsHigh >= 2 || avgSeverity >= 4 || last30 >= 4 ? "high"
      : flagsHigh >= 1 || avgSeverity >= 3 || last30 >= 2 ? "elevated"
      : incidents.length >= 5 ? "moderate"
      : "low";

    /* ---- escalation timeline buckets ---- */
    const byMonth: Record<string, { count: number; severity: number }> = {};
    for (const i of incidents) {
      const k = i.date?.slice(0, 7) ?? "unknown";
      if (!byMonth[k]) byMonth[k] = { count: 0, severity: 0 };
      byMonth[k].count += 1;
      byMonth[k].severity += i.severity_level ?? 0;
    }
    const timeline = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, count: v.count, avg_severity: v.count ? v.severity / v.count : 0 }));

    return {
      case: caseQ.data ?? null,
      incidents,
      evidence,
      flags,
      voice_notes: voiceQ.data ?? [],
      communications: comsQ.data ?? [],
      legal_documents: legalQ.data ?? [],
      pattern_analysis: pattern,
      pattern_analysis_present: !!pattern,
      pattern_reviewed_status: patternReviewedStatus,
      categories: Object.entries(categoryCounts).map(([type, count]) => ({ type, count })),
      checklist,
      gaps,
      documentation_density,
      documentation_density_note:
        "Reflects documentation volume and severity ratings the survivor has logged — not a clinical or forensic risk assessment.",
      avg_severity: avgSeverity,
      last_30_days: last30,
      timeline,
      link_id: link.id,
      consent: {
        granted_at: grantInv?.created_at ?? null,
        include_all_incidents: link.include_all_incidents,
        include_all_evidence: link.include_all_evidence,
        include_patterns: link.include_patterns,
        scoped_incident_count: link.include_all_incidents ? null : scopedIncidentIds.length,
        scoped_evidence_count: link.include_all_evidence ? null : scopedEvidenceIds.length,
        date_range_start: grantRange.start,
        date_range_end: grantRange.end,
        expires_at: grantRange.expires,
        case_scoped: !!link.case_id,
      },
    };
  });

/* ------------------------- deposition prep (AI) ------------------------- */

export const generateDepositionPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAttorney(context.userId);
    const link = await assertLink(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Survivor-controlled consent to have her own words AI-rephrased into
    // "court-safe" language. Off by default; the rest of deposition prep
    // (contradictions, credibility_gaps, weak_spots, cross_warnings, etc.)
    // runs without this consent because those items don't rephrase her words.
    const { data: linkFull } = await supabaseAdmin
      .from("attorney_client_links")
      .select("deposition_prep_consent")
      .eq("id", link.id)
      .maybeSingle();
    const phrasingConsent = !!linkFull?.deposition_prep_consent;

    const [{ data: incidents }, { data: evidence }, { data: pattern }] = await Promise.all([
      link.include_all_incidents
        ? supabaseAdmin.from("incidents").select("id,date,description,abuse_types,severity_level,witnesses,source,confirmed_at").eq("user_id", data.clientId).is("deleted_at", null).eq("is_sealed", false).or("source.neq.ai_extracted,confirmed_at.not.is.null").order("date")
        : (link.scope_incidents ?? []).length
          ? supabaseAdmin.from("incidents").select("id,date,description,abuse_types,severity_level,witnesses,source,confirmed_at").eq("user_id", data.clientId).in("id", link.scope_incidents ?? []).is("deleted_at", null).eq("is_sealed", false).or("source.neq.ai_extracted,confirmed_at.not.is.null").order("date")
          : Promise.resolve({ data: [] }),
      link.include_all_evidence
        ? supabaseAdmin.from("evidence").select("id,title,date,file_type,linked_incident_id").eq("user_id", data.clientId).is("deleted_at", null).eq("is_sealed", false).neq("review_status", "suggested")
        : (link.scope_evidence ?? []).length
          ? supabaseAdmin.from("evidence").select("id,title,date,file_type,linked_incident_id").eq("user_id", data.clientId).in("id", link.scope_evidence ?? []).is("deleted_at", null).eq("is_sealed", false).neq("review_status", "suggested")
          : Promise.resolve({ data: [] }),
      link.include_patterns
        ? supabaseAdmin.from("pattern_analyses").select("analysis").eq("user_id", data.clientId).order("created_at", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (!incidents || incidents.length < 3) {
      return { ok: false as const, reason: "not-enough-data" as const };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false as const, reason: "no-key" as const };

    const prompt = `You are a litigation strategist preparing a domestic-violence / coercive-control case for deposition. Read the survivor's documented incidents and produce a JSON object with these fields:

- chronology_strengths: string[]  — the 3-6 strongest chronological anchors (specific dated patterns that survive cross-examination).
- weak_spots: { issue: string; risk: string; suggested_fix: string }[]  — places opposing counsel will attack (gaps, inconsistencies, lone witnesses, undated screenshots, etc.).
- credibility_gaps: { gap: string; address_before_testimony: string }[]  — internal inconsistencies the client should be prepared to address.
- prep_questions: string[]  — 8-12 direct examination questions, ordered, that surface the pattern.
- cross_warnings: string[]  — questions opposing counsel is likely to ask; brief recommended framing.
- contradictions: { topic: string; conflicting_accounts: string; how_to_reconcile: string }[]  — internal contradictions across incidents, dates, or descriptions that opposing counsel will exploit; explain how to reconcile or frame.
- strongest_evidence: { item: string; why_it_helps: string; tied_to_incident: string }[]  — 3-6 evidence items (by title/date) that most strongly support the pattern.
- weakest_evidence: { item: string; risk: string; recommended_action: string }[]  — evidence items most vulnerable to challenge (authenticity, hearsay, provenance & integrity, prejudicial value).
- talking_points: string[]  — 5-8 concise, court-safe themes the attorney can return to repeatedly (the case's narrative spine).${phrasingConsent ? `
- court_safe_phrasing: { instead_of: string; say: string }[]  — therapeutic, emotional, or accusatory phrases the client tends to use, rewritten in measured, judicial register. This is AI-suggested phrasing for the attorney's prep, NOT the client's own words.` : ""}

Be forensic, legal-register, not therapeutic. Return ONLY the JSON object.${phrasingConsent ? "" : "\nDo NOT include a court_safe_phrasing field."}

INCIDENTS (${incidents.length}):
${incidents.map((i, idx) => `${idx + 1}. ${i.date} — severity ${i.severity_level ?? "n/a"} — ${(i.abuse_types ?? []).join(", ")} — witnesses: ${i.witnesses ?? "none"} — ${i.description}`).join("\n")}

EVIDENCE (${(evidence ?? []).length}): ${(evidence ?? []).map((e) => `${e.date} ${e.file_type} "${e.title}" → incident ${e.linked_incident_id ?? "(unlinked)"}`).join("; ")}

EXISTING PATTERN ANALYSIS: ${pattern?.analysis ? JSON.stringify(pattern.analysis).slice(0, 2000) : "none"}
`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) return { ok: false as const, reason: "rate-limit" as const };
    if (resp.status === 402) return { ok: false as const, reason: "credits" as const };
    if (!resp.ok) return { ok: false as const, reason: "error" as const };
    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: AnyJson;
    try { parsed = JSON.parse(content); } catch { return { ok: false as const, reason: "parse" as const }; }
    if (!phrasingConsent) {
      delete parsed.court_safe_phrasing;
    }
    return {
      ok: true as const,
      prep: parsed,
      phrasing_consent: phrasingConsent,
      phrasing_consent_note: phrasingConsent
        ? "Court-safe phrasing is AI-suggested language for your prep — not the client's own words. Never export or attribute it as her statement."
        : "Court-safe phrasing is disabled. Your client has not consented to have her statements AI-rephrased. Ask her to enable it from her Share-with-attorney settings if you need it.",
    };
  });

/* Survivor grants/revokes consent for AI-rephrased "court-safe" statements */
export const setDepositionPrepConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ link_id: z.string().uuid(), consent: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("attorney_client_links")
      .update({
        deposition_prep_consent: data.consent,
        deposition_prep_consent_at: data.consent ? new Date().toISOString() : null,
      })
      .eq("id", data.link_id)
      .eq("client_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ------------------------- messages + doc requests ------------------------- */

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      link_id: z.string().uuid(),
      content: z.string().trim().min(1).max(5000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { role } = await assertLinkParticipant(data.link_id, context.userId);
    const sender_role = role === "survivor" ? "survivor" : "attorney";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("attorney_messages").insert({
      link_id: data.link_id,
      sender_user_id: context.userId,
      sender_role,
      content: data.content,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ link_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertLinkParticipant(data.link_id, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: messages } = await supabaseAdmin
      .from("attorney_messages")
      .select("*")
      .eq("link_id", data.link_id)
      .order("created_at", { ascending: true });
    return { messages: messages ?? [] };
  });

export const markMessagesRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ link_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertLinkParticipant(data.link_id, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("attorney_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("link_id", data.link_id)
      .is("read_at", null)
      .neq("sender_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Returns unread message counts for the survivor viewing their attorney list. */
export const getMyUnreadCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: links } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id")
      .eq("client_user_id", context.userId)
      .eq("status", "active");
    const ids = (links ?? []).map((l) => l.id);
    if (!ids.length) return { counts: {} as Record<string, number> };
    const counts: Record<string, number> = {};
    await Promise.all(ids.map(async (id) => {
      const { count } = await supabaseAdmin
        .from("attorney_messages")
        .select("id", { count: "exact", head: true })
        .eq("link_id", id)
        .is("read_at", null)
        .neq("sender_user_id", context.userId);
      counts[id] = count ?? 0;
    }));
    return { counts };
  });

export const createDocRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      clientId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      details: z.string().trim().max(2000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAttorney(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id,status")
      .eq("attorney_user_id", context.userId)
      .eq("client_user_id", data.clientId)
      .maybeSingle();
    if (!link || link.status !== "active") throw new Error("No active link");
    const { error } = await supabaseAdmin.from("attorney_document_requests").insert({
      link_id: link.id,
      attorney_user_id: context.userId,
      client_user_id: data.clientId,
      title: data.title,
      details: data.details ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listDocRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ link_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertLinkParticipant(data.link_id, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: requests } = await supabaseAdmin
      .from("attorney_document_requests")
      .select("*")
      .eq("link_id", data.link_id)
      .order("created_at", { ascending: false });
    return { requests: requests ?? [] };
  });

/* ------------------------- time logging ------------------------- */

export const logTime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      clientId: z.string().uuid(),
      page_path: z.string().max(200).optional(),
      duration_seconds: z.number().int().min(1).max(60 * 60 * 4),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAttorney(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id, status")
      .eq("attorney_user_id", context.userId)
      .eq("client_user_id", data.clientId)
      .maybeSingle();
    if (!link || link.status !== "active") {
      throw new Error("No active link for this client");
    }
    const now = new Date();
    const started = new Date(now.getTime() - data.duration_seconds * 1000);
    await supabaseAdmin.from("attorney_time_logs").insert({
      attorney_user_id: context.userId,
      client_user_id: data.clientId,
      link_id: link.id,
      page_path: data.page_path ?? null,
      started_at: started.toISOString(),
      ended_at: now.toISOString(),
      duration_seconds: data.duration_seconds,
    });
    return { ok: true };
  });

export const getTimeSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAttorney(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: logs } = await supabaseAdmin
      .from("attorney_time_logs")
      .select("duration_seconds,started_at,page_path")
      .eq("attorney_user_id", context.userId)
      .eq("client_user_id", data.clientId)
      .order("started_at", { ascending: false });
    const total_seconds = (logs ?? []).reduce((s, r) => s + (r.duration_seconds ?? 0), 0);
    return { logs: logs ?? [], total_seconds };
  });

/* ------------------------- attorney private notes ------------------------- */

export const listAttorneyNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAttorney(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id")
      .eq("attorney_user_id", context.userId)
      .eq("client_user_id", data.clientId)
      .eq("status", "active")
      .maybeSingle();
    if (!link) return { notes: [] as Array<{ incident_id: string; note: string | null; flagged: boolean; reviewed: boolean }>, link_id: null };
    const { data: notes } = await supabaseAdmin
      .from("attorney_incident_notes")
      .select("incident_id,note,flagged,reviewed")
      .eq("link_id", link.id)
      .eq("attorney_user_id", context.userId);
    return { notes: notes ?? [], link_id: link.id };
  });

export const upsertAttorneyNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      clientId: z.string().uuid(),
      incidentId: z.string().uuid(),
      note: z.string().max(5000).optional().nullable(),
      flagged: z.boolean().optional(),
      reviewed: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAttorney(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id")
      .eq("attorney_user_id", context.userId)
      .eq("client_user_id", data.clientId)
      .eq("status", "active")
      .maybeSingle();
    if (!link) throw new Error("No active access");
    type NoteUpsert = {
      link_id: string;
      attorney_user_id: string;
      client_user_id: string;
      incident_id: string;
      updated_at: string;
      note?: string | null;
      flagged?: boolean;
      reviewed?: boolean;
    };
    const payload: NoteUpsert = {
      link_id: link.id,
      attorney_user_id: context.userId,
      client_user_id: data.clientId,
      incident_id: data.incidentId,
      updated_at: new Date().toISOString(),
    };
    if (data.note !== undefined) payload.note = data.note;
    if (data.flagged !== undefined) payload.flagged = data.flagged;
    if (data.reviewed !== undefined) payload.reviewed = data.reviewed;
    const { error } = await supabaseAdmin
      .from("attorney_incident_notes")
      .upsert(payload, { onConflict: "link_id,incident_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------- case-level attorney notes ------------------------- */

export const getCaseNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAttorney(context.userId);
    const { link } = await assertCaseAccess(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("attorney_client_links")
      .select("attorney_case_notes")
      .eq("id", link.id)
      .maybeSingle();
    return { note: (row as { attorney_case_notes: string | null } | null)?.attorney_case_notes ?? "" };
  });

export const saveCaseNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      clientId: z.string().uuid(),
      note: z.string().max(20000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAttorney(context.userId);
    const { link } = await assertCaseAccess(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("attorney_client_links")
      .update({ attorney_case_notes: data.note })
      .eq("id", link.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ------------------------- signed evidence URLs ------------------------- */

export const getSignedEvidenceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ clientId: z.string().uuid(), evidenceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { link } = await assertCaseAccess(context.userId, data.clientId);
    if (!link.include_all_evidence && !(link.scope_evidence ?? []).includes(data.evidenceId)) {
      throw new Error("Evidence not shared for this case");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ev } = await supabaseAdmin
      .from("evidence")
      .select("file_url,file_type,title")
      .eq("id", data.evidenceId)
      .eq("user_id", data.clientId)
      .maybeSingle();
    if (!ev) throw new Error("Evidence not found");
    await supabaseAdmin.rpc("record_audit_event", {
      p_user_id: data.clientId,
      p_event_type: "evidence.downloaded_by_professional",
      p_subject_kind: "evidence",
      p_subject_id: data.evidenceId,
      p_actor_kind: "attorney",
      p_actor_id: context.userId,
      p_meta: { link_id: link.id ?? null },
    }).then(() => undefined, (e: unknown) => console.error("[audit] evidence download log failed", e));
    // file_url may be a storage path inside evidence-files bucket OR an absolute URL.
    if (/^https?:\/\//i.test(ev.file_url)) return { url: ev.file_url, file_type: ev.file_type, title: ev.title };
    const { data: signed } = await supabaseAdmin.storage
      .from("evidence-files")
      .createSignedUrl(ev.file_url, 60 * 30);
    return { url: signed?.signedUrl ?? null, file_type: ev.file_type, title: ev.title };
  });

/* ------------------------- has-active-share for survivor ------------------------- */

export const hasActiveAttorneyShare = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ count: links }, { count: invites }] = await Promise.all([
      supabaseAdmin
        .from("attorney_client_links")
        .select("id", { count: "exact", head: true })
        .eq("client_user_id", context.userId)
        .eq("status", "active"),
      supabaseAdmin
        .from("attorney_invitations")
        .select("id", { count: "exact", head: true })
        .eq("client_user_id", context.userId)
        .eq("status", "pending"),
    ]);
    return { active_links: links ?? 0, pending_invites: invites ?? 0 };
  });

/* ------------------------- message threads (attorney view) ------------------------- */

export const listClientThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertCaseAccess(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("message_threads")
      .select("id,source_filename,source_type,conversation_participant,exhibit_label,parse_status,message_count,summary,attorney_summary,flags,created_at")
      .eq("user_id", data.clientId)
      .order("created_at", { ascending: false });
    return { threads: rows ?? [] };
  });

export const getClientThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ clientId: z.string().uuid(), threadId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCaseAccess(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: thread } = await supabaseAdmin
      .from("message_threads")
      .select("*")
      .eq("id", data.threadId)
      .eq("user_id", data.clientId)
      .maybeSingle();
    if (!thread) throw new Error("Thread not found");
    const { data: messages } = await supabaseAdmin
      .from("thread_messages")
      .select("id,position,sender,recipient,sent_on,sent_at_time,body,attachment_name,flags")
      .eq("thread_id", data.threadId)
      .eq("user_id", data.clientId)
      .order("position", { ascending: true })
      .limit(2000);
    return { thread, messages: messages ?? [] };
  });
/* ------------------------- firm conflict check ------------------------- */

// Surfaces possible same-name overlaps between clients across attorneys in the
// same firm. Returns an empty result for solo practitioners (no firm_id).
// Threshold: substring match OR ≥60% similarity (dist/longer ≤ 0.4) — slightly
// looser than case-builder's material-change threshold since a false positive
// here is just a prompt to double-check, not an auto-action.
export const getFirmConflictFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: me } = await supabaseAdmin
      .from("attorney_profiles")
      .select("firm_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!me?.firm_id) return { firm_id: null as string | null, flags: [] as ConflictFlag[] };

    const { data: colleagues } = await supabaseAdmin
      .from("attorney_profiles")
      .select("user_id,full_name")
      .eq("firm_id", me.firm_id);
    const others = (colleagues ?? []).filter((c) => c.user_id !== context.userId);
    if (others.length === 0) return { firm_id: me.firm_id, flags: [] as ConflictFlag[] };

    const allAttorneyIds = [context.userId, ...others.map((o) => o.user_id)];
    const nameByAttorney = new Map<string, string>();
    for (const c of colleagues ?? []) nameByAttorney.set(c.user_id, c.full_name);

    // Active client links per attorney.
    const { data: links } = await supabaseAdmin
      .from("attorney_client_links")
      .select("attorney_user_id,client_user_id")
      .in("attorney_user_id", allAttorneyIds)
      .eq("status", "active");
    if (!links || links.length === 0) return { firm_id: me.firm_id, flags: [] as ConflictFlag[] };

    const clientIds = Array.from(new Set(links.map((l) => l.client_user_id)));
    const { data: cases } = await supabaseAdmin
      .from("cases")
      .select("user_id,other_party")
      .in("user_id", clientIds);
    const otherPartyByClient = new Map<string, string>();
    for (const c of cases ?? []) {
      if (c.other_party && c.other_party.trim()) otherPartyByClient.set(c.user_id, c.other_party);
    }

    // My clients (with other_party) vs colleagues' clients (with other_party).
    type Row = { attorney_id: string; client_id: string; other_party: string };
    const rowsByAttorney = new Map<string, Row[]>();
    for (const l of links) {
      const op = otherPartyByClient.get(l.client_user_id);
      if (!op) continue;
      if (!rowsByAttorney.has(l.attorney_user_id)) rowsByAttorney.set(l.attorney_user_id, []);
      rowsByAttorney.get(l.attorney_user_id)!.push({
        attorney_id: l.attorney_user_id,
        client_id: l.client_user_id,
        other_party: op,
      });
    }

    const mine = rowsByAttorney.get(context.userId) ?? [];
    if (mine.length === 0) return { firm_id: me.firm_id, flags: [] as ConflictFlag[] };

    const flags: ConflictFlag[] = [];
    const seen = new Set<string>();
    for (const other of others) {
      const theirs = rowsByAttorney.get(other.user_id) ?? [];
      for (const a of mine) {
        for (const b of theirs) {
          if (a.client_id === b.client_id) continue;
          if (!isPossibleNameOverlap(a.other_party, b.other_party)) continue;
          const key = [a.client_id, b.client_id, other.user_id].sort().join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          flags.push({
            my_client_id: a.client_id,
            other_client_id: b.client_id,
            other_attorney_id: other.user_id,
            other_attorney_name: nameByAttorney.get(other.user_id) ?? "Colleague",
            my_matched_name: a.other_party,
            other_matched_name: b.other_party,
          });
        }
      }
    }

    return { firm_id: me.firm_id, flags };
  });

export type ConflictFlag = {
  my_client_id: string;
  other_client_id: string;
  other_attorney_id: string;
  other_attorney_name: string;
  my_matched_name: string;
  other_matched_name: string;
};

/* --------------------- missing-evidence checklist --------------------- */

export const listMissingEvidenceChecklist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { link } = await assertCaseAccess(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("attorney_missing_evidence_checklist")
      .select("id,item_label,notes,is_resolved,resolved_at,source,created_at,attorney_user_id")
      .eq("link_id", link.id)
      .order("created_at", { ascending: true });
    return { items: rows ?? [] };
  });

export const addMissingEvidenceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { clientId: string; itemLabel: string; notes?: string }) =>
    z.object({ clientId: z.string().uuid(), itemLabel: z.string().min(1).max(500), notes: z.string().max(2000).optional() }).parse(data))
  .handler(async ({ data, context }) => {
    const { link } = await assertCaseAccess(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("attorney_missing_evidence_checklist")
      .insert({
        link_id: link.id,
        attorney_user_id: context.userId,
        client_user_id: data.clientId,
        item_label: data.itemLabel.trim(),
        notes: data.notes?.trim() || null,
        source: "manual",
      })
      .select("id,item_label,notes,is_resolved,resolved_at,source,created_at")
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const setMissingEvidenceResolved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; clientId: string; resolved: boolean }) =>
    z.object({ id: z.string().uuid(), clientId: z.string().uuid(), resolved: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { link } = await assertCaseAccess(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("attorney_missing_evidence_checklist")
      .update({
        is_resolved: data.resolved,
        resolved_at: data.resolved ? new Date().toISOString() : null,
        attorney_user_id: context.userId,
      })
      .eq("id", data.id)
      .eq("link_id", link.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Idempotent: pulls the latest pattern-analysis gaps for this client and inserts
// any missing 'ai_gap' rows. Existing resolved/unresolved 'ai_gap' rows with the
// same item_label are left untouched. A unique index on
// (attorney_user_id, client_user_id, item_label) WHERE source='ai_gap' backs the
// no-duplicate guarantee even under concurrent syncs.
export const syncMissingEvidenceChecklistFromGaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { link } = await assertCaseAccess(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pat } = await supabaseAdmin
      .from("pattern_analyses")
      .select("analysis")
      .eq("user_id", data.clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const analysis = (pat?.analysis ?? {}) as { gaps?: unknown };
    const rawGaps = Array.isArray(analysis.gaps) ? analysis.gaps : [];
    const labels = new Set<string>();
    for (const g of rawGaps) {
      let label: string | null = null;
      if (typeof g === "string") label = g;
      else if (g && typeof g === "object") {
        const o = g as Record<string, unknown>;
        const cand = o.gap ?? o.kind ?? o.title ?? o.label;
        if (typeof cand === "string") label = cand;
      }
      const trimmed = label?.trim();
      if (trimmed) labels.add(trimmed);
    }
    if (labels.size === 0) return { added: 0, skipped: 0 };

    const { data: existing } = await supabaseAdmin
      .from("attorney_missing_evidence_checklist")
      .select("item_label")
      .eq("link_id", link.id)
      .eq("source", "ai_gap");
    const have = new Set((existing ?? []).map((r) => r.item_label));

    const toInsert = Array.from(labels)
      .filter((l) => !have.has(l))
      .map((l) => ({
        link_id: link.id,
        attorney_user_id: context.userId,
        client_user_id: data.clientId,
        item_label: l,
        source: "ai_gap" as const,
      }));

    let added = 0;
    if (toInsert.length) {
      // Insert one-by-one so a rare concurrent duplicate (23505 against the
      // partial unique index missing_evidence_ai_gap_unique) is skipped
      // instead of failing the whole batch. Sequential repeat clicks are
      // already handled by the pre-fetch existence check above.
      for (const row of toInsert) {
        const { error } = await supabaseAdmin
          .from("attorney_missing_evidence_checklist")
          .insert(row);
        if (!error) added += 1;
        else if (!/duplicate key|23505/i.test(error.message)) throw new Error(error.message);
      }
    }
    return { added, skipped: labels.size - added };
  });

/* ---------------- survivor-side view of document requests ---------------- */

export const listMyDocumentRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: links } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id, attorney_user_id")
      .eq("client_user_id", context.userId)
      .eq("status", "active");
    const linkIds = (links ?? []).map((l) => l.id);
    if (linkIds.length === 0) return { requests: [] };

    const { data: requests } = await supabaseAdmin
      .from("attorney_document_requests")
      .select("id, link_id, title, details, status, created_at, attorney_user_id")
      .in("link_id", linkIds)
      .eq("status", "open")
      .order("created_at", { ascending: false });

    const attorneyIds = Array.from(new Set((requests ?? []).map((r) => r.attorney_user_id)));
    const { data: profiles } = attorneyIds.length
      ? await supabaseAdmin.from("attorney_profiles").select("user_id, full_name, firm_name").in("user_id", attorneyIds)
      : { data: [] as Array<{ user_id: string; full_name: string | null; firm_name: string | null }> };
    const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    return {
      requests: (requests ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        details: r.details,
        created_at: r.created_at,
        attorney_name: byId.get(r.attorney_user_id)?.full_name ?? "Your attorney",
        firm_name: byId.get(r.attorney_user_id)?.firm_name ?? null,
      })),
    };
  });
