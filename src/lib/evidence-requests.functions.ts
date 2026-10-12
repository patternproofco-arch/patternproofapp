import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isRevoked, isExpired } from "@/lib/attorney-access.server";
import type { RequestOutcome } from "@/lib/request-response";
import { respondToRequest } from "@/lib/request-response.server";
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
  response_outcome?: RequestOutcome | null;
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
  response_outcome?: RequestOutcome | null;
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
        "id,title,details,kind,due_at,status,response_outcome,created_at,response_note,response_evidence_ids,submitted_at,declined_at,attorney_user_id,link_id",
      )
      .eq("client_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("We couldn't load your requests. Try again in a moment.");
    const rows = data ?? [];
    // Hide requests whose sharing link is no longer active.
    const linkIds = [...new Set(rows.map((r) => r.link_id))];
    const { data: links, error: linkError } = linkIds.length
      ? await supabaseAdmin
          .from("attorney_client_links")
          .select("id,status,expires_at,revoked_at")
          .in("id", linkIds)
          .eq("client_user_id", context.userId)
      : {
          data: [] as Array<{
            id: string;
            status: string;
            expires_at: string | null;
            revoked_at: string | null;
          }>,
          error: null,
        };
    if (linkError)
      throw new Error("We couldn't check the sharing status of your requests. Try again.");
    const live = new Set(
      (links ?? [])
        .filter(
          (l) => l.status === "active" && !isRevoked(l.revoked_at) && !isExpired(l.expires_at),
        )
        .map((l) => l.id),
    );
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
          response_outcome: r.response_outcome as RequestOutcome | null,
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
    .select("id,status,link_id,client_user_id,title")
    .eq("id", id)
    .eq("client_user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("We couldn't find that request.");
  if (data.status !== "open") throw new Error("This request has already been answered.");
  return { admin: supabaseAdmin, req: data };
}

type Admin = Awaited<ReturnType<typeof loadOwnOpenRequest>>["admin"];

/**
 * Put a request answer into the survivor's "Drafts to review" tray.
 * The draft carries the survivor's note plus any transcript / photo text
 * already pulled from the picked files, so the survivor can edit it.
 * Nothing reaches the timeline until the survivor approves it there.
 * Failure here never blocks the send itself.
 */
async function queueRequestDraft(
  admin: Admin,
  userId: string,
  title: string,
  note: string,
  ids: string[],
  linkId: string | null,
): Promise<void> {
  try {
    const { data: files } = ids.length
      ? await admin
          .from("evidence")
          .select("id,title,date,transcript,extracted_text")
          .eq("user_id", userId)
          .in("id", ids)
      : {
          data: [] as {
            id: string;
            title: string;
            date: string | null;
            transcript: string | null;
            extracted_text: string | null;
          }[],
        };
    const parts: string[] = [];
    if (note) parts.push(note);
    for (const f of files ?? []) {
      const text = (f.transcript || f.extracted_text || "").trim();
      if (text) parts.push(`From "${f.title}":\n${text}`);
    }
    const description = (parts.join("\n\n") || `Answer to request: ${title}`).slice(0, 4000);
    const firstDate =
      (files ?? [])
        .map((f) => f.date)
        .filter(Boolean)
        .sort()[0] ?? null;
    await admin.from("proposed_incidents").insert({
      user_id: userId,
      batch_id: crypto.randomUUID(),
      sort_key: firstDate,
      sort_key_kind: firstDate ? "file_date" : null,
      date_certainty: "unknown",
      // share_with_link_id carries the sharing link this answer belongs to, so
      // that approving the draft puts the entry on the same professional's
      // binder the survivor already answered. It only ever names a link the
      // survivor has already chosen to share with.
      draft: { date: null, description, abuse_types: [], share_with_link_id: linkId },
      source_evidence_ids: ids,
      source_summary: `Answer to request: ${title}`,
      confidence_notes: [
        "Built from your answer to a request. Check the text and add the event date yourself.",
        "When you approve this, it joins your timeline and the binder your attorney sees.",
      ],
      status: "pending",
      model: null,
    });
  } catch {
    // Draft is a convenience; the answer was already sent.
  }
}

async function ownEvidenceIds(userId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("evidence")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("id", ids);
  if (error || (data ?? []).length !== new Set(ids).size) {
    throw new Error("A selected file could not be checked. Nothing was saved or sent.");
  }
  return (data ?? []).map((r) => r.id);
}

export const saveEvidenceRequestDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ResponseInput.parse(i))
  .handler(async ({ data, context }) => {
    await loadOwnOpenRequest(context.userId, data.id);
    const ids = await ownEvidenceIds(context.userId, data.evidence_ids);
    const { data: updated, error } = await context.supabase
      .from("attorney_document_requests")
      .update({
        response_note: data.note || null,
        response_evidence_ids: ids,
        draft_saved_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("client_user_id", context.userId)
      .eq("status", "open")
      .select("id")
      .maybeSingle();
    if (error || !updated) throw new Error("We couldn't save that. Try again in a moment.");
    return { ok: true };
  });

export const submitEvidenceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ResponseInput.parse(i))
  .handler(async ({ data, context }) => {
    const { admin, req } = await loadOwnOpenRequest(context.userId, data.id);
    const ids = [...new Set(data.evidence_ids)];
    const response = await respondToRequest(context.supabase, { ...data, action: "submit" });
    await queueRequestDraft(
      admin,
      context.userId,
      req.title ?? "Requested item",
      data.note,
      ids,
      req.link_id,
    );
    return { ok: true, shared: response.shared };
  });

export const declineEvidenceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await respondToRequest(context.supabase, { id: data.id, action: "decline" });
    return { ok: true };
  });

export const respondWithoutEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["unavailable", "help_requested"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await respondToRequest(context.supabase, data);
    return { ok: true };
  });

/* ------------------------------ professional ------------------------------ */

async function activeLinkFor(attorneyId: string, clientId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { assertLink } = await import("@/lib/attorney-access.server");
  const link = await assertLink(supabaseAdmin, attorneyId, clientId);
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
    const { data: rows, error } = await admin
      .from("attorney_document_requests")
      .select(
        "id,title,details,kind,due_at,status,response_outcome,created_at,submitted_at,declined_at,response_note,response_evidence_ids",
      )
      .eq("link_id", link.id)
      .eq("attorney_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("We couldn't load these requests. Try again.");
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
          response_outcome: r.response_outcome as RequestOutcome | null,
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
