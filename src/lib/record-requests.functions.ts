import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createRequestSchema, respondSchema, idSchema, grantIdSchema,
  revokeSchema, downloadSchema, sealSchema,
} from "@/lib/record-requests.schema";
import {
  describeScope, emptyScope, evaluateGrant, filterEvidenceForGrant,
  filterIncidentsForGrant, parseScope, canDownloadItem, DENY_MESSAGE,
  type GrantScope,
} from "@/lib/consent-scope";
import {
  admin, advocateClient, audit, notify, settleExpiry, toGrant,
} from "@/lib/record-requests.server";

/**
 * Record requests and consent grants.
 *
 * A DV-organization advocate may ASK. Only the survivor can turn a request
 * into a grant, and only a live grant returns records. A referral, an
 * advocate link, or an org relationship never returns records on its own.
 */

/* ------------------------------ advocate side ------------------------------ */

export const createRecordRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createRequestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await advocateClient(context.userId);

    // An advocate may only address someone who already chose to work with them.
    const { data: link } = await db
      .from("advocate_client_links").select("id,status")
      .eq("advocate_user_id", context.userId)
      .eq("client_user_id", data.survivor_user_id)
      .maybeSingle();
    if (!link || link.status !== "active") {
      throw new Error("You can only send a request to someone who has connected with your organization.");
    }

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

    await audit(db, data.survivor_user_id,
      data.submit ? "record_request_submitted" : "record_request_created",
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
  .inputValidator((input) => idSchema.parse(input))
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
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await advocateClient(context.userId);
    const { data: row } = await db.from("record_requests").select("id,status,survivor_user_id")
      .eq("id", data.id).eq("requester_user_id", context.userId).maybeSingle();
    if (!row) throw new Error("That request isn't on your account.");
    if (row.status === "approved" || row.status === "modified") {
      throw new Error("That request was already answered.");
    }
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
    const grants = await Promise.all((rawGrants ?? []).map((g: { id: string }) => settleExpiry(db, g)));
    const { data: links } = await db.from("advocate_client_links")
      .select("id,client_user_id,status,created_at").eq("advocate_user_id", context.userId);

    return {
      requests: (requests ?? []) as Array<Record<string, never> & {
        id: string; survivor_user_id: string; purpose: string; status: string;
        scope_summary: string | null; created_at: string; responded_at: string | null;
        download_allowed: boolean; expires_at: string | null; survivor_note: string | null;
      }>,
      // Recipients see status + scope, never anything beyond the id they already hold.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      grants: (grants ?? []).map((g: any) => ({
        id: g.id as string,
        request_id: g.request_id as string | null,
        survivor_user_id: g.survivor_user_id as string,
        status: g.status as string,
        effective_at: g.effective_at as string,
        expires_at: g.expires_at as string | null,
        download_allowed: g.download_allowed as boolean,
        revoked_at: g.revoked_at as string | null,
        scope_summary: describeScope(parseScope(g.scope), g.download_allowed, g.expires_at),
      })),
      connections: ((links ?? []) as Array<{ id: string; client_user_id: string; status: string; created_at: string }>)
        .filter((l) => l.status === "active"),
    };
  });

/** The only advocate read path for granted records. Everything is re-checked here. */
export const getGrantedRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => grantIdSchema.parse(input))
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

    const [incQ, evQ] = await Promise.all([
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
    const inc = filterIncidentsForGrant(
      (incQ.data ?? []) as Array<Record<string, unknown>>, scope,
    ).map(shapeAdvocateIncident);
    const ev = filterEvidenceForGrant(
      (evQ.data ?? []) as Array<Record<string, unknown>>, scope,
    ).map(shapeAdvocateEvidence);

    await audit(db, grant.survivor_user_id, "advocate_viewed_shared_records", "consent_grant",
      grant.id ?? null, "advocate", context.userId,
      { incident_count: inc.length, evidence_count: ev.length });

    return {
      incidents: inc,
      evidence: ev,
      consent: {
        effective_at: row.effective_at as string,
        expires_at: row.expires_at as string | null,
        download_allowed: row.download_allowed as boolean,
        scope_summary: describeScope(scope, row.download_allowed, row.expires_at),
      },
    };
  });

/** Short-lived signed URL, issued only when the grant explicitly allows downloads. */
export const createGrantedDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => downloadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await advocateClient(context.userId);
    const { data: raw } = await db.from("consent_grants").select("*").eq("id", data.grant_id).maybeSingle();
    const row = await settleExpiry(db, raw);
    const evaluation = evaluateGrant(row ? toGrant(row) : null, context.userId);
    if (!evaluation.ok) throw new Error(DENY_MESSAGE[evaluation.reason]);
    const grant = evaluation.grant;

    if (!grant.download_allowed) {
      await audit(db, grant.survivor_user_id, "advocate_access_denied", "consent_grant",
        grant.id ?? null, "advocate", context.userId, { reason: "download_not_allowed" });
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
    if (signed.error || !signed.data?.signedUrl) {
      throw new Error("We couldn't open that file. Try again in a moment.");
    }

    await audit(db, grant.survivor_user_id, "advocate_download_generated", "evidence", ev.id,
      "advocate", context.userId, { grant_id: grant.id });

    return { url: signed.data.signedUrl as string, expires_in_seconds: 300 };
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
    const grants = await Promise.all((rawGrants ?? []).map((g: { id: string }) => settleExpiry(db, g)));

    const ids = Array.from(new Set([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(grants ?? []).map((g: any) => g.recipient_user_id as string),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...((requests ?? []) as any[]).map((r) => r.requester_user_id as string),
    ]));
    const { data: profiles } = ids.length
      ? await db.from("advocate_profiles").select("user_id,full_name,org_name").in("user_id", ids)
      : { data: [] };
    const who = new Map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((profiles ?? []) as any[]).map((p) => [p.user_id as string, (p.org_name?.trim() || p.full_name) as string]),
    );

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      requests: ((requests ?? []) as any[]).map((r) => ({
        id: r.id as string,
        purpose: r.purpose as string,
        status: r.status as string,
        date_start: r.date_start as string | null,
        date_end: r.date_end as string | null,
        topics: (r.topics ?? []) as string[],
        source_types: (r.source_types ?? []) as string[],
        include_incidents: r.include_incidents as boolean,
        include_evidence: r.include_evidence as boolean,
        expires_at: r.expires_at as string | null,
        download_allowed: r.download_allowed as boolean,
        scope_summary: r.scope_summary as string | null,
        created_at: r.created_at as string,
        responded_at: r.responded_at as string | null,
        requester_label: who.get(r.requester_user_id) ?? r.org_name ?? "An organization",
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      grants: ((grants ?? []) as any[]).map((g) => ({
        id: g.id as string,
        status: g.status as string,
        effective_at: g.effective_at as string,
        expires_at: g.expires_at as string | null,
        revoked_at: g.revoked_at as string | null,
        download_allowed: g.download_allowed as boolean,
        recipient_label: (who.get(g.recipient_user_id) ?? g.org_name ?? "An organization") as string,
        scope_summary: describeScope(parseScope(g.scope), g.download_allowed, g.expires_at),
      })),
    };
  });

/** Survivor's own picker data for narrowing a request. Sealed items are marked. */
export const listMyShareableRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const [incQ, evQ] = await Promise.all([
      db.from("incidents").select("id,date,description,abuse_types")
        .eq("user_id", context.userId).is("deleted_at", null)
        .order("date", { ascending: false }).limit(500),
      db.from("evidence").select("id,date,title,file_type,is_sealed")
        .eq("user_id", context.userId).is("deleted_at", null)
        .order("date", { ascending: false }).limit(500),
    ]);
    return {
      incidents: (incQ.data ?? []) as Array<{ id: string; date: string | null; description: string | null; abuse_types: string[] | null }>,
      evidence: (evQ.data ?? []) as Array<{ id: string; date: string | null; title: string | null; file_type: string | null; is_sealed: boolean }>,
    };
  });

export const setEvidenceSealed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sealSchema.parse(input))
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
  .inputValidator((input) => respondSchema.parse(input))
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
      topics: modified ? (data.topics ?? []) : ((req.topics ?? []) as string[]),
      source_types: modified ? (data.source_types ?? []) : ((req.source_types ?? []) as string[]),
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

    // A sealed item can never enter a grant, even if it was ticked in the picker.
    if (scope.evidence_ids?.length) {
      const { data: sealed } = await db.from("evidence").select("id")
        .eq("user_id", context.userId).eq("is_sealed", true).in("id", scope.evidence_ids);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sealedIds = new Set(((sealed ?? []) as any[]).map((s) => s.id as string));
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
  .inputValidator((input) => revokeSchema.parse(input))
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
