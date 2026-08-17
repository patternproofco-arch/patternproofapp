import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  describeScope, emptyScope, evaluateGrant, filterEvidenceForGrant,
  filterIncidentsForGrant, parseScope, canDownloadItem,
  DENY_MESSAGE, type GrantLike, type GrantScope,
} from "@/lib/consent-scope";

/**
 * Record requests and consent grants.
 *
 * A DV-organization advocate may ASK. Only the survivor can turn a request
 * into a grant, and only a live grant returns records. A referral, an
 * advocate link, or an org relationship never returns records on its own.
 */

const REQUEST_STATUSES = [
  "draft", "pending_survivor", "approved", "modified", "declined", "expired", "revoked", "cancelled",
] as const;

const scopeInput = z.object({
  purpose: z.string().trim().min(5).max(1000),
  date_start: z.string().date().nullable().optional(),
  date_end: z.string().date().nullable().optional(),
  topics: z.array(z.string().max(60)).max(30).default([]),
  source_types: z.array(z.string().max(40)).max(20).default([]),
  include_incidents: z.boolean().default(true),
  include_evidence: z.boolean().default(true),
  expires_at: z.string().datetime().nullable().optional(),
  download_allowed: z.boolean().default(false),
});

/* --------------------------------- helpers -------------------------------- */

async function advocateClient(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: role } = await supabaseAdmin
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "advocate").maybeSingle();
  if (!role) throw new Error("This area is for partner organizations.");
  return supabaseAdmin;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function audit(db: any, userId: string, eventType: string, subjectKind: string, subjectId: string | null, actorKind: string, actorId: string, meta?: Record<string, unknown>) {
  // Append-only trail. Never carries record content — ids and statuses only.
  await db.from("audit_events").insert({
    user_id: userId,
    event_type: eventType,
    subject_kind: subjectKind,
    subject_id: subjectId,
    actor_kind: actorKind,
    actor_id: actorId,
    meta: meta ?? null,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notify(db: any, userId: string, kind: string, title: string, body: string, metadata?: Record<string, unknown>) {
  // Neutral wording only — no record content, no sensitive framing.
  await db.from("notifications").insert({ user_id: userId, kind, title, body, metadata: metadata ?? null });
}

/** Lazily flip a lapsed grant to "expired" so the stored status matches reality. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function settleExpiry(db: any, row: any) {
  if (row?.status === "active" && row.expires_at && new Date(row.expires_at) <= new Date()) {
    await db.from("consent_grants").update({ status: "expired" }).eq("id", row.id);
    return { ...row, status: "expired" };
  }
  return row;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGrant(row: any): GrantLike {
  return {
    id: row.id,
    survivor_user_id: row.survivor_user_id,
    recipient_user_id: row.recipient_user_id,
    status: row.status,
    effective_at: row.effective_at,
    expires_at: row.expires_at,
    download_allowed: row.download_allowed,
    scope: parseScope(row.scope),
  };
}

/* ------------------------------ advocate side ------------------------------ */

export const createRecordRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    scopeInput.extend({
      survivor_user_id: z.string().uuid(),
      submit: z.boolean().default(false),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await advocateClient(context.userId);

    // An advocate may only address someone who already chose to work with them.
    const { data: link } = await db
      .from("advocate_client_links").select("id,status")
      .eq("advocate_user_id", context.userId)
      .eq("client_user_id", data.survivor_user_id)
      .maybeSingle();
    if (!link) throw new Error("You can only send a request to someone who has connected with your organization.");

    const { data: profile } = await db
      .from("advocate_profiles").select("org_name,full_name")
      .eq("user_id", context.userId).maybeSingle();

    const scope: GrantScope = {
      ...emptyScope(),
      date_start: data.date_start ?? null,
      date_end: data.date_end ?? null,
      topics: data.topics,
      source_types: data.source_types,
      include_incidents: data.include_incidents,
      include_evidence: data.include_evidence,
    };

    const { data: row, error } = await db.from("record_requests").insert({
      requester_user_id: context.userId,
      survivor_user_id: data.survivor_user_id,
      org_name: profile?.org_name ?? profile?.full_name ?? null,
      purpose: data.purpose,
      date_start: data.date_start ?? null,
      date_end: data.date_end ?? null,
      topics: data.topics,
      source_types: data.source_types,
      include_incidents: data.include_incidents,
      include_evidence: data.include_evidence,
      expires_at: data.expires_at ?? null,
      download_allowed: data.download_allowed,
      status: data.submit ? "pending_survivor" : "draft",
      scope_summary: describeScope(scope, data.download_allowed, data.expires_at ?? null),
    }).select("*").single();
    if (error) throw new Error(error.message);

    await audit(db, data.survivor_user_id, data.submit ? "record_request_submitted" : "record_request_created",
      "record_request", row.id, "advocate", context.userId, { org_name: row.org_name });

    if (data.submit) {
      await notify(db, data.survivor_user_id, "record_request",
        "A request is waiting for you",
        "An organization you're connected with has asked to see part of your records. You decide what, if anything, they see.",
        { request_id: row.id });
    }
    return { request: row };
  });

export const submitRecordRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await advocateClient(context.userId);
    const { data: row } = await db.from("record_requests").select("*")
      .eq("id", data.id).eq("requester_user_id", context.userId).maybeSingle();
    if (!row) throw new Error("That request isn't on your account.");
    if (row.status !== "draft") throw new Error("That request has already been sent.");

    await db.from("record_requests").update({ status: "pending_survivor" }).eq("id", row.id);
    await audit(db, row.survivor_user_id, "record_request_submitted", "record_request", row.id, "advocate", context.userId);
    await notify(db, row.survivor_user_id, "record_request",
      "A request is waiting for you",
      "An organization you're connected with has asked to see part of your records. You decide what, if anything, they see.",
      { request_id: row.id });
    return { ok: true };
  });

export const cancelRecordRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await advocateClient(context.userId);
    const { data: row } = await db.from("record_requests").select("id,status,survivor_user_id")
      .eq("id", data.id).eq("requester_user_id", context.userId).maybeSingle();
    if (!row) throw new Error("That request isn't on your account.");
    if (["approved", "modified"].includes(row.status)) throw new Error("That request was already answered.");
    await db.from("record_requests").update({ status: "cancelled" }).eq("id", row.id);
    await audit(db, row.survivor_user_id, "record_request_cancelled", "record_request", row.id, "advocate", context.userId);
    return { ok: true };
  });

export const listOrgRecordRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await advocateClient(context.userId);
    const { data: requests } = await db.from("record_requests").select("*")
      .eq("requester_user_id", context.userId).order("created_at", { ascending: false }).limit(200);
    const { data: rawGrants } = await db.from("consent_grants").select("*")
      .eq("recipient_user_id", context.userId).order("created_at", { ascending: false }).limit(200);
    const grants = await Promise.all((rawGrants ?? []).map((g) => settleExpiry(db, g)));
    const { data: links } = await db.from("advocate_client_links")
      .select("id,client_user_id,status,created_at").eq("advocate_user_id", context.userId);

    return {
      requests: requests ?? [],
      // Recipients see status + scope, never the survivor's identity beyond the id they already hold.
      grants: (grants ?? []).map((g) => ({
        id: g.id,
        request_id: g.request_id,
        survivor_user_id: g.survivor_user_id,
        status: g.status,
        effective_at: g.effective_at,
        expires_at: g.expires_at,
        download_allowed: g.download_allowed,
        revoked_at: g.revoked_at,
        scope_summary: describeScope(parseScope(g.scope), g.download_allowed, g.expires_at),
        receipt: g.receipt,
      })),
      connections: (links ?? []).filter((l) => l.status === "active"),
    };
  });

/** The only advocate read path for granted records. Everything is re-checked here. */
export const getGrantedRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ grant_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await advocateClient(context.userId);
    const { data: raw } = await db.from("consent_grants").select("*").eq("id", data.grant_id).maybeSingle();
    const row = await settleExpiry(db, raw);
    const evaluation = evaluateGrant(row ? toGrant(row) : null, context.userId);
    if (!evaluation.ok) {
      if (row) {
        await audit(db, row.survivor_user_id, "advocate_access_denied", "consent_grant", row.id,
          "advocate", context.userId, { reason: evaluation.reason });
      }
      throw new Error(DENY_MESSAGE[evaluation.reason]);
    }
    const grant = evaluation.grant;
    const scope = grant.scope;

    const [{ data: incidents }, { data: evidence }] = await Promise.all([
      scope.include_incidents
        ? db.from("incidents").select("*").eq("user_id", grant.survivor_user_id)
            .is("deleted_at", null).or("source.neq.ai_extracted,confirmed_at.not.is.null")
            .order("date", { ascending: true })
        : Promise.resolve({ data: [] }),
      scope.include_evidence
        ? db.from("evidence").select("*").eq("user_id", grant.survivor_user_id)
            .is("deleted_at", null).eq("is_sealed", false).neq("review_status", "suggested")
            .order("date", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

    const { shapeAdvocateIncident, shapeAdvocateEvidence } = await import("@/lib/advocate-scope");
    const inc = filterIncidentsForGrant((incidents ?? []) as Array<Record<string, unknown>>, scope).map(shapeAdvocateIncident);
    const ev = filterEvidenceForGrant((evidence ?? []) as Array<Record<string, unknown>>, scope).map(shapeAdvocateEvidence);

    await audit(db, grant.survivor_user_id, "advocate_viewed_shared_records", "consent_grant", grant.id ?? null,
      "advocate", context.userId, { incident_count: inc.length, evidence_count: ev.length });

    return {
      incidents: inc,
      evidence: ev,
      consent: {
        effective_at: row.effective_at,
        expires_at: row.expires_at,
        download_allowed: row.download_allowed,
        scope_summary: describeScope(scope, row.download_allowed, row.expires_at),
        receipt: row.receipt,
      },
    };
  });

/** Short-lived signed URL, issued only when the grant explicitly allows downloads. */
export const createGrantedDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ grant_id: z.string().uuid(), evidence_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await advocateClient(context.userId);
    const { data: raw } = await db.from("consent_grants").select("*").eq("id", data.grant_id).maybeSingle();
    const row = await settleExpiry(db, raw);
    const evaluation = evaluateGrant(row ? toGrant(row) : null, context.userId);
    if (!evaluation.ok) {
      throw new Error(DENY_MESSAGE[evaluation.reason]);
    }
    const grant = evaluation.grant;
    if (!grant.download_allowed) {
      await audit(db, grant.survivor_user_id, "advocate_access_denied", "consent_grant", grant.id ?? null,
        "advocate", context.userId, { reason: "download_not_allowed" });
      throw new Error("This access doesn't include downloads.");
    }

    const { data: ev } = await db.from("evidence")
      .select("id,date,file_type,file_url,is_sealed,deleted_at,user_id")
      .eq("id", data.evidence_id).eq("user_id", grant.survivor_user_id).maybeSingle();
    if (!ev || ev.deleted_at || !canDownloadItem(grant, ev as Record<string, unknown>, context.userId)) {
      await audit(db, grant.survivor_user_id, "advocate_access_denied", "evidence", data.evidence_id,
        "advocate", context.userId, { reason: ev?.is_sealed ? "sealed" : "out_of_scope" });
      throw new Error("That item isn't part of what was shared with you.");
    }
    if (!ev.file_url) throw new Error("There's no file attached to that item.");

    const signed = await db.storage.from("evidence-files").createSignedUrl(ev.file_url, 300);
    if (signed.error || !signed.data?.signedUrl) throw new Error("We couldn't open that file. Try again in a moment.");

    await audit(db, grant.survivor_user_id, "advocate_download_generated", "evidence", ev.id,
      "advocate", context.userId, { grant_id: grant.id });

    return { url: signed.data.signedUrl, expires_in_seconds: 300 };
  });

/* ------------------------------ survivor side ------------------------------ */

export const listMyRecordRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data: requests } = await db.from("record_requests").select("*")
      .eq("survivor_user_id", context.userId).neq("status", "draft")
      .order("created_at", { ascending: false }).limit(200);
    const { data: rawGrants } = await db.from("consent_grants").select("*")
      .eq("survivor_user_id", context.userId).order("created_at", { ascending: false }).limit(200);
    const grants = await Promise.all((rawGrants ?? []).map((g) => settleExpiry(db, g)));

    const recipientIds = Array.from(new Set((grants ?? []).map((g) => g.recipient_user_id)
      .concat((requests ?? []).map((r) => r.requester_user_id))));
    const { data: profiles } = recipientIds.length
      ? await db.from("advocate_profiles").select("user_id,full_name,org_name").in("user_id", recipientIds)
      : { data: [] as Array<{ user_id: string; full_name: string; org_name: string | null }> };
    const who = new Map((profiles ?? []).map((p) => [p.user_id, p.org_name?.trim() || p.full_name]));

    return {
      requests: (requests ?? []).map((r) => ({
        ...r,
        requester_label: who.get(r.requester_user_id) ?? r.org_name ?? "An organization",
      })),
      grants: (grants ?? []).map((g) => ({
        ...g,
        recipient_label: who.get(g.recipient_user_id) ?? g.org_name ?? "An organization",
        scope_summary: describeScope(parseScope(g.scope), g.download_allowed, g.expires_at),
      })),
    };
  });

/** Survivor's own picker data for narrowing a request. Sealed items are marked. */
export const listMyShareableRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const [{ data: incidents }, { data: evidence }] = await Promise.all([
      db.from("incidents").select("id,date,description,abuse_types")
        .eq("user_id", context.userId).is("deleted_at", null)
        .order("date", { ascending: false }).limit(500),
      db.from("evidence").select("id,date,title,file_type,is_sealed")
        .eq("user_id", context.userId).is("deleted_at", null)
        .order("date", { ascending: false }).limit(500),
    ]);
    return { incidents: incidents ?? [], evidence: evidence ?? [] };
  });

export const setEvidenceSealed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ evidence_id: z.string().uuid(), sealed: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db.from("evidence")
      .update({ is_sealed: data.sealed, sealed_at: data.sealed ? new Date().toISOString() : null })
      .eq("id", data.evidence_id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await audit(db, context.userId, data.sealed ? "evidence_sealed" : "evidence_unsealed",
      "evidence", data.evidence_id, "user", context.userId);
    return { ok: true };
  });

export const respondToRecordRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["approve", "modify", "decline"]),
      note: z.string().trim().max(1000).optional(),
      // Only read for "modify" — the survivor's edits win over what was asked for.
      date_start: z.string().date().nullable().optional(),
      date_end: z.string().date().nullable().optional(),
      topics: z.array(z.string().max(60)).max(30).optional(),
      source_types: z.array(z.string().max(40)).max(20).optional(),
      incident_ids: z.array(z.string().uuid()).max(500).nullable().optional(),
      evidence_ids: z.array(z.string().uuid()).max(500).nullable().optional(),
      include_incidents: z.boolean().optional(),
      include_evidence: z.boolean().optional(),
      download_allowed: z.boolean().optional(),
      expires_at: z.string().datetime().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: req } = await db.from("record_requests").select("*")
      .eq("id", data.id).eq("survivor_user_id", context.userId).maybeSingle();
    if (!req) throw new Error("That request isn't on your account.");
    if (req.status !== "pending_survivor") throw new Error("You've already answered that request.");

    const now = new Date().toISOString();

    if (data.decision === "decline") {
      await db.from("record_requests").update({
        status: "declined", responded_at: now, survivor_note: data.note ?? null,
      }).eq("id", req.id);
      await audit(db, context.userId, "record_request_declined", "record_request", req.id, "user", context.userId);
      await notify(db, req.requester_user_id, "record_request_answered",
        "A request was answered", "A request you sent was declined. No records were shared.",
        { request_id: req.id });
      return { ok: true, grant_id: null as string | null };
    }

    const modified = data.decision === "modify";
    const scope: GrantScope = {
      date_start: modified ? (data.date_start ?? null) : (req.date_start ?? null),
      date_end: modified ? (data.date_end ?? null) : (req.date_end ?? null),
      topics: modified ? (data.topics ?? []) : (req.topics ?? []),
      source_types: modified ? (data.source_types ?? []) : (req.source_types ?? []),
      incident_ids: modified ? (data.incident_ids ?? null) : null,
      evidence_ids: modified ? (data.evidence_ids ?? null) : null,
      include_incidents: modified ? (data.include_incidents ?? true) : req.include_incidents,
      include_evidence: modified ? (data.include_evidence ?? true) : req.include_evidence,
    };
    // Downloads can only be narrowed by the survivor, never widened past the ask.
    const downloadAllowed = modified
      ? Boolean(data.download_allowed) && req.download_allowed
      : req.download_allowed;
    const expiresAt = modified ? (data.expires_at ?? req.expires_at ?? null) : (req.expires_at ?? null);

    // A sealed item can never enter a grant, even if the survivor ticked it.
    if (scope.evidence_ids?.length) {
      const { data: sealed } = await db.from("evidence").select("id")
        .eq("user_id", context.userId).eq("is_sealed", true).in("id", scope.evidence_ids);
      const sealedIds = new Set((sealed ?? []).map((s) => s.id));
      scope.evidence_ids = scope.evidence_ids.filter((id) => !sealedIds.has(id));
    }

    const summary = describeScope(scope, downloadAllowed, expiresAt);
    const { data: grant, error } = await db.from("consent_grants").insert({
      survivor_user_id: context.userId,
      recipient_user_id: req.requester_user_id,
      org_name: req.org_name,
      request_id: req.id,
      scope,
      effective_at: now,
      expires_at: expiresAt,
      download_allowed: downloadAllowed,
      status: "active",
      receipt: {
        who: req.org_name ?? "Partner organization",
        why: req.purpose,
        what: summary,
        approved_at: now,
        expires_at: expiresAt,
        download_allowed: downloadAllowed,
        modified_by_survivor: modified,
        note: "Anything already downloaded before a withdrawal stays with the recipient.",
      },
    }).select("*").single();
    if (error) throw new Error(error.message);

    await db.from("record_requests").update({
      status: modified ? "modified" : "approved",
      responded_at: now,
      survivor_note: data.note ?? null,
      scope_summary: summary,
    }).eq("id", req.id);

    await audit(db, context.userId, modified ? "record_request_modified" : "record_request_approved",
      "record_request", req.id, "user", context.userId);
    await audit(db, context.userId, "consent_grant_created", "consent_grant", grant.id, "user", context.userId,
      { request_id: req.id, download_allowed: downloadAllowed });
    await notify(db, req.requester_user_id, "record_request_answered",
      "A request was answered",
      modified
        ? "A request you sent was approved with changes. Open the consent centre to see what it covers."
        : "A request you sent was approved. Open the consent centre to see what it covers.",
      { request_id: req.id, grant_id: grant.id });

    return { ok: true, grant_id: grant.id as string };
  });

export const revokeConsentGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), reason: z.string().trim().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: grant } = await db.from("consent_grants").select("id,recipient_user_id,status")
      .eq("id", data.id).eq("survivor_user_id", context.userId).maybeSingle();
    if (!grant) throw new Error("That access isn't on your account.");
    const { error } = await db.from("consent_grants").update({
      status: "revoked", revoked_at: new Date().toISOString(), revocation_reason: data.reason ?? null,
    }).eq("id", grant.id).eq("survivor_user_id", context.userId);
    if (error) throw new Error(error.message);

    await audit(db, context.userId, "consent_grant_revoked", "consent_grant", grant.id, "user", context.userId);
    await notify(db, grant.recipient_user_id, "consent_revoked",
      "Access has ended", "Access you previously had has been withdrawn. Nothing further opens from it.",
      { grant_id: grant.id });
    return { ok: true };
  });

export const REQUEST_STATUS_VALUES = REQUEST_STATUSES;
