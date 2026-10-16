import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { selectInChunks } from "@/lib/in-chunks.server";
import { requireAttorneyPortalAuth } from "@/lib/attorney-portal-auth";
import { z } from "zod";

const REVIEW_STATUSES = [
  "unreviewed",
  "useful",
  "needs_context",
  "duplicate",
  "exclude",
  "privileged",
  "exhibit_candidate",
] as const;

async function assertActiveLink(attorneyId: string, clientId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { assertLink, assertAttorney } = await import("@/lib/attorney-access.server");
  await assertAttorney(supabaseAdmin, attorneyId);
  return assertLink(supabaseAdmin, attorneyId, clientId);
}

export const listEvidenceReviews = createServerFn({ method: "POST" })
  .middleware([requireAttorneyPortalAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const link = await assertActiveLink(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!link.scope_evidence?.length) return { reviews: [] };
    const files = await selectInChunks<{ id: string }>(
      link.scope_evidence,
      (ids) =>
        supabaseAdmin
          .from("evidence")
          .select("id")
          .eq("user_id", data.clientId)
          .is("deleted_at", null)
          .in("id", ids),
      { what: "shared file" },
    );
    const rows = await selectInChunks<{
      evidence_id: string;
      status: string;
      exhibit_label: string | null;
      notes: string | null;
      linked_incident_id: string | null;
      updated_at: string;
    }>(
      files.map((file) => file.id),
      (ids) =>
        supabaseAdmin
          .from("attorney_evidence_reviews")
          .select("evidence_id,status,exhibit_label,notes,linked_incident_id,updated_at")
          .eq("attorney_user_id", context.userId)
          .eq("client_user_id", data.clientId)
          .in("evidence_id", ids),
      { what: "evidence review" },
    );
    const references = rows.flatMap((row) =>
      row.linked_incident_id && link.scope_incidents?.includes(row.linked_incident_id)
        ? [row.linked_incident_id]
        : [],
    );
    const currentIncidents = await selectInChunks<{ id: string }>(
      references,
      (ids) =>
        supabaseAdmin
          .from("incidents")
          .select("id")
          .eq("user_id", data.clientId)
          .is("deleted_at", null)
          .in("id", ids),
      { what: "shared entry" },
    );
    const visibleReferences = new Set(currentIncidents.map((row) => row.id));
    return {
      // Review notes can describe the referenced entry. Hide the whole review
      // when that entry leaves consent scope, matching the direct-read policy.
      reviews: rows.filter(
        (row) => !row.linked_incident_id || visibleReferences.has(row.linked_incident_id),
      ),
    };
  });

export const upsertEvidenceReview = createServerFn({ method: "POST" })
  .middleware([requireAttorneyPortalAuth])
  .inputValidator((input) =>
    z
      .object({
        clientId: z.string().uuid(),
        evidenceId: z.string().uuid(),
        status: z.enum(REVIEW_STATUSES).optional(),
        exhibit_label: z.string().trim().max(60).optional().nullable(),
        notes: z.string().trim().max(5000).optional().nullable(),
        linked_incident_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const link = await assertActiveLink(context.userId, data.clientId);
    const { idInScope } = await import("@/lib/attorney-access.server");
    if (
      !idInScope(link, "evidence", data.evidenceId) ||
      (data.linked_incident_id && !idInScope(link, "incident", data.linked_incident_id))
    ) {
      throw new Error("That record is not in the current share.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const checks = await Promise.all([
      supabaseAdmin
        .from("evidence")
        .select("id")
        .eq("id", data.evidenceId)
        .eq("user_id", data.clientId)
        .is("deleted_at", null)
        .maybeSingle(),
      data.linked_incident_id
        ? supabaseAdmin
            .from("incidents")
            .select("id")
            .eq("id", data.linked_incident_id)
            .eq("user_id", data.clientId)
            .is("deleted_at", null)
            .maybeSingle()
        : Promise.resolve({ data: { id: null }, error: null }),
    ]);
    if (checks.some((result) => result.error || !result.data))
      throw new Error("That record is no longer in the current share.");
    type Payload = {
      attorney_user_id: string;
      client_user_id: string;
      evidence_id: string;
      updated_at: string;
      status?: (typeof REVIEW_STATUSES)[number];
      exhibit_label?: string | null;
      notes?: string | null;
      linked_incident_id?: string | null;
    };
    const payload: Payload = {
      attorney_user_id: context.userId,
      client_user_id: data.clientId,
      evidence_id: data.evidenceId,
      updated_at: new Date().toISOString(),
    };
    if (data.status !== undefined) payload.status = data.status;
    if (data.exhibit_label !== undefined) payload.exhibit_label = data.exhibit_label;
    if (data.notes !== undefined) payload.notes = data.notes;
    if (data.linked_incident_id !== undefined) payload.linked_incident_id = data.linked_incident_id;
    const { error } = await supabaseAdmin
      .from("attorney_evidence_reviews")
      .upsert(payload, { onConflict: "attorney_user_id,evidence_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
