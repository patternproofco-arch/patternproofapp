import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Structured evidence requests.
 *
 * Staging rule: a survivor's answer and files are invisible to the
 * professional until the survivor presses Submit. Drafts stay private.
 * Declining needs no reason. Submitting shares ONLY the files the survivor
 * picked, by adding them to that professional's item-level scope.
 */

export type SurvivorRequest = {
  id: string;
  title: string;
  details: string | null;
  kind: string;
  due_at: string | null;
  status: string;
  created_at: string;
  response_note: string | null;
  response_evidence_ids: string[];
  submitted_at: string | null;
  declined_at: string | null;
  from_name: string | null;
};

export type ProfessionalRequest = {
  id: string;
  title: string;
  details: string | null;
  kind: string;
  due_at: string | null;
  status: string;
  created_at: string;
  submitted_at: string | null;
  declined_at: string | null;
  /** Only present once submitted. */
  response_note: string | null;
  shared_file_count: number;
};

const KIND = z.enum(["document", "photo", "recording", "note"]);

export const listMyEvidenceRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: SurvivorRequest[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("attorney_document_requests")
      .select(
        "id,title,details,kind,due_at,status,created_at,response_note,response_evidence_ids,submitted_at,declined_at,attorney_user_id,link_id",
      )
      .eq("client_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("We couldn't load your requests. Try again in a moment.");
    const rows = data ?? [];
    // Hide requests whose sharing link is no longer active.
    const linkIds = [...new Set(rows.map((r) => r.link_id))];
    const { data: links } = linkIds.length
      ? await supabaseAdmin
          .from("attorney_client_links")
          .select("id,status")
          .in("id", linkIds)
          .eq("client_user_id", context.userId)
      : { data: [] as Array<{ id: string; status: string }> };
    const live = new Set((links ?? []).filter((l) => l.status === "active").map((l) => l.id));
    const proIds = [...new Set(rows.map((r) => r.attorney_user_id))];
    const { data: pros } = proIds.length
      ? await supabaseAdmin
          .from("attorney_profiles")
          .select("user_id,full_name")
          .in("user_id", proIds)
      : { data: [] as Array<{ user_id: string; full_name: string | null }> };
    const names = new Map((pros ?? []).map((p) => [p.user_id, p.full_name]));
    return {
      items: rows
        .filter((r) => live.has(r.link_id) || r.status !== "open")
        .map((r) => ({
          id: r.id,
          title: r.title,
          details: r.details,
          kind: r.kind,
          due_at: r.due_at,
          status: r.status,
          created_at: r.created_at,
          response_note: r.response_note,
          response_evidence_ids: r.response_evidence_ids ?? [],
          submitted_at: r.submitted_at,
          declined_at: r.declined_at,
          from_name: names.get(r.attorney_user_id) ?? null,
        })),
    };
  });

const ResponseInput = z.object({
  id: z.string().uuid(),
  note: z.string().trim().max(4000).optional().default(""),
  evidence_ids: z.array(z.string().uuid()).max(40).optional().default([]),
});

async function loadOwnOpenRequest(userId: string, id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("attorney_document_requests")
    .select("id,status,link_id,client_user_id")
    .eq("id", id)
    .eq("client_user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("We couldn't find that request.");
  if (data.status !== "open") throw new Error("This request has already been answered.");
  return { admin: supabaseAdmin, req: data };
}

async function ownEvidenceIds(userId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("evidence")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("id", ids);
  return (data ?? []).map((r) => r.id);
}

export const saveEvidenceRequestDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ResponseInput.parse(i))
  .handler(async ({ data, context }) => {
    const { admin } = await loadOwnOpenRequest(context.userId, data.id);
    const ids = await ownEvidenceIds(context.userId, data.evidence_ids);
    const { error } = await admin
      .from("attorney_document_requests")
      .update({
        response_note: data.note || null,
        response_evidence_ids: ids,
        draft_saved_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("client_user_id", context.userId);
    if (error) throw new Error("We couldn't save that. Try again in a moment.");
    return { ok: true };
  });

export const submitEvidenceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ResponseInput.parse(i))
  .handler(async ({ data, context }) => {
    const { admin, req } = await loadOwnOpenRequest(context.userId, data.id);
    const ids = await ownEvidenceIds(context.userId, data.evidence_ids);
    if (!ids.length && !data.note) throw new Error("Add a note or pick a file before sending.");

    const { data: link } = await admin
      .from("attorney_client_links")
      .select("id,status,scope_evidence")
      .eq("id", req.link_id)
      .eq("client_user_id", context.userId)
      .maybeSingle();
    if (!link || link.status !== "active") {
      throw new Error("Sharing with this professional has ended, so nothing was sent.");
    }
    if (ids.length) {
      const merged = [...new Set([...(link.scope_evidence ?? []), ...ids])];
      const { error: scopeErr } = await admin
        .from("attorney_client_links")
        .update({ scope_evidence: merged })
        .eq("id", link.id);
      if (scopeErr) throw new Error("We couldn't send that. Try again in a moment.");
    }
    const now = new Date().toISOString();
    const { error } = await admin
      .from("attorney_document_requests")
      .update({
        status: "submitted",
        response_note: data.note || null,
        response_evidence_ids: ids,
        submitted_at: now,
        completed_at: now,
      })
      .eq("id", data.id);
    if (error) throw new Error("We couldn't send that. Try again in a moment.");
    await queueRequestDraft(admin, context.userId, req.title ?? "Requested item", data.note, ids);
    return { ok: true, shared: ids.length };
  });

export const declineEvidenceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { admin } = await loadOwnOpenRequest(context.userId, data.id);
    const now = new Date().toISOString();
    const { error } = await admin
      .from("attorney_document_requests")
      .update({
        status: "declined",
        declined_at: now,
        completed_at: now,
        response_note: null,
        response_evidence_ids: [],
      })
      .eq("id", data.id);
    if (error) throw new Error("We couldn't update that. Try again in a moment.");
    return { ok: true };
  });

/* ------------------------------ professional ------------------------------ */

async function activeLinkFor(attorneyId: string, clientId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: link } = await supabaseAdmin
    .from("attorney_client_links")
    .select("id,status")
    .eq("attorney_user_id", attorneyId)
    .eq("client_user_id", clientId)
    .maybeSingle();
  if (!link || link.status !== "active") throw new Error("Sharing with this client isn't active.");
  return { admin: supabaseAdmin, link };
}

export const createEvidenceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        clientId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        details: z.string().trim().max(2000).optional(),
        kind: KIND.default("document"),
        due_at: z.string().datetime().optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { admin, link } = await activeLinkFor(context.userId, data.clientId);
    const { error } = await admin.from("attorney_document_requests").insert({
      link_id: link.id,
      attorney_user_id: context.userId,
      client_user_id: data.clientId,
      title: data.title,
      details: data.details ?? null,
      kind: data.kind,
      due_at: data.due_at ?? null,
    });
    if (error) throw new Error("We couldn't send that request. Try again in a moment.");
    return { ok: true };
  });

export const listClientEvidenceRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ clientId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ items: ProfessionalRequest[] }> => {
    const { admin, link } = await activeLinkFor(context.userId, data.clientId);
    const { data: rows } = await admin
      .from("attorney_document_requests")
      .select(
        "id,title,details,kind,due_at,status,created_at,submitted_at,declined_at,response_note,response_evidence_ids",
      )
      .eq("link_id", link.id)
      .eq("attorney_user_id", context.userId)
      .order("created_at", { ascending: false });
    return {
      items: (rows ?? []).map((r) => {
        const submitted = r.status === "submitted";
        return {
          id: r.id,
          title: r.title,
          details: r.details,
          kind: r.kind,
          due_at: r.due_at,
          status: r.status,
          created_at: r.created_at,
          submitted_at: r.submitted_at,
          declined_at: r.declined_at,
          // Drafts never leak: answer only after the survivor submits.
          response_note: submitted ? r.response_note : null,
          shared_file_count: submitted ? (r.response_evidence_ids ?? []).length : 0,
        };
      }),
    };
  });
