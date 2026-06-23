import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
  const { data } = await supabaseAdmin
    .from("attorney_client_links")
    .select("id,status")
    .eq("attorney_user_id", attorneyId)
    .eq("client_user_id", clientId)
    .maybeSingle();
  if (!data || data.status !== "active") throw new Error("No active access");
}

export const listEvidenceReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertActiveLink(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("attorney_evidence_reviews")
      .select("evidence_id,status,exhibit_label,notes,linked_incident_id,updated_at")
      .eq("attorney_user_id", context.userId)
      .eq("client_user_id", data.clientId);
    return { reviews: rows ?? [] };
  });

export const upsertEvidenceReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      clientId: z.string().uuid(),
      evidenceId: z.string().uuid(),
      status: z.enum(REVIEW_STATUSES).optional(),
      exhibit_label: z.string().trim().max(60).optional().nullable(),
      notes: z.string().trim().max(5000).optional().nullable(),
      linked_incident_id: z.string().uuid().optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertActiveLink(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    type Payload = {
      attorney_user_id: string;
      client_user_id: string;
      evidence_id: string;
      updated_at: string;
      status?: typeof REVIEW_STATUSES[number];
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