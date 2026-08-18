import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildDraftFromEvidence } from "./evidence-drafts.server";

export const analyzeEvidenceForDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      evidence_id: z.string().uuid(),
      frame_paths: z.array(z.string().min(1).max(500)).max(12).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) =>
    buildDraftFromEvidence(context.supabase, context.userId, data.evidence_id, data.frame_paths ?? []),
  );

export const listEvidenceDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("evidence_incident_drafts")
      .select("id, evidence_id, source, draft, transcript_excerpt, frame_count, created_at")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("We couldn't load your drafts. Try again in a moment.");
    const rows = (data ?? []) as Array<{ evidence_id: string }>;
    const ids = rows.map((r) => r.evidence_id);
    let files: Record<string, { title: string | null; file_url: string; mime: string | null }> = {};
    if (ids.length) {
      const ev = await supabase
        .from("evidence")
        .select("id, title, file_url, mime")
        .in("id", ids)
        .eq("user_id", userId);
      files = Object.fromEntries(
        ((ev.data ?? []) as Array<{ id: string; title: string | null; file_url: string; mime: string | null }>)
          .map((e) => [e.id, { title: e.title, file_url: e.file_url, mime: e.mime }]),
      );
    }
    return { drafts: data ?? [], files };
  });

export const acceptEvidenceDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      draft_id: z.string().uuid(),
      date: z.string().min(1).max(20),
      time: z.string().max(10).nullable().optional(),
      location: z.string().max(300).nullable().optional(),
      description: z.string().min(1).max(6000),
      abuse_types: z.array(z.string().max(40)).max(12).default([]),
      witnesses: z.string().max(300).nullable().optional(),
      emotional_impact: z.string().max(2000).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const found = await supabase
      .from("evidence_incident_drafts")
      .select("id, evidence_id, status")
      .eq("id", data.draft_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (found.error || !found.data) throw new Error("That draft is no longer here.");
    const row = found.data as { id: string; evidence_id: string; status: string };
    if (row.status !== "pending") return { ok: true as const, alreadyHandled: true as const };

    // Accepting after reading the draft IS the survivor's confirmation.
    const ins = await supabase
      .from("incidents")
      .insert({
        user_id: userId,
        date: data.date,
        time: data.time || null,
        location: data.location || null,
        description: data.description,
        abuse_types: data.abuse_types,
        witnesses: data.witnesses || null,
        emotional_impact: data.emotional_impact || null,
        date_precision: "exact",
        source: "ai_extracted",
        confirmed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) throw new Error("We couldn't save that. Try again in a moment.");
    const incidentId = (ins.data as { id: string }).id;

    await supabase
      .from("evidence")
      .update({ linked_incident_id: incidentId, review_status: "confirmed" })
      .eq("id", row.evidence_id)
      .eq("user_id", userId);

    await supabase
      .from("evidence_incident_drafts")
      .update({ status: "accepted", created_incident_id: incidentId })
      .eq("id", row.id)
      .eq("user_id", userId);

    return { ok: true as const, incidentId };
  });

export const dismissEvidenceDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ draft_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("evidence_incident_drafts")
      .update({ status: "dismissed" })
      .eq("id", data.draft_id)
      .eq("user_id", context.userId);
    return { ok: true as const };
  });