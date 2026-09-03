import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Consent-scoped content-type suggestions.
 *
 * This never runs on its own. A survivor has to ask for it, one batch at a
 * time. It describes what a file *looks like* — a photo of damage, a document,
 * a screenshot — and nothing more. It does not look for, score, or label
 * abuse, and it never draws a conclusion about anyone.
 */

const KINDS = [
  "physical_damage",
  "injury_photo",
  "document_or_letter",
  "screenshot_of_messages",
  "receipt_or_financial",
  "property_or_vehicle",
  "place_or_location",
  "other",
] as const;

export type SuggestedKind = (typeof KINDS)[number];

export const KIND_LABELS: Record<SuggestedKind, string> = {
  physical_damage: "Looks like damage to something",
  injury_photo: "Looks like a photo of an injury",
  document_or_letter: "Looks like a document or letter",
  screenshot_of_messages: "Looks like a screenshot of messages",
  receipt_or_financial: "Looks like a receipt or financial record",
  property_or_vehicle: "Looks like property or a vehicle",
  place_or_location: "Looks like a place",
  other: "Something else",
};

export interface ClassificationSuggestion {
  id: string;
  evidence_id: string;
  suggested_kind: string;
  confidence: number | null;
  rationale: string | null;
  status: string;
  title: string | null;
}

export const suggestContentTypes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { evidenceIds: string[] }) => {
    if (!input?.evidenceIds?.length) throw new Error("Nothing to look at.");
    return { evidenceIds: input.evidenceIds.slice(0, 40) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const rows = await supabase
      .from("evidence")
      .select("id, title, description, original_filename, mime, file_type")
      .eq("user_id", userId)
      .in("id", data.evidenceIds);
    if (rows.error) throw new Error("We couldn't open those files. Try again in a moment.");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Suggestions aren't available right now.");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { generateText, Output } = await import("ai");
    const { z } = await import("zod");

    const gateway = createLovableAiGatewayProvider(key);
    const listing = (rows.data ?? []).map((r) => ({
      id: r.id as string,
      hint: [r.title, r.original_filename, r.mime, r.description]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 400),
    }));

    const { output } = await generateText({
      model: gateway("google/gemini-3.6-flash"),
      output: Output.object({
        schema: z.object({
          items: z.array(
            z.object({
              id: z.string(),
              kind: z.enum(KINDS),
              confidence: z.number().min(0).max(1),
              rationale: z.string().max(160),
            }),
          ),
        }),
      }),
      system:
        "You sort files by what they appear to contain, for a personal records app. " +
        "Only describe the visible content type. Never infer intent, wrongdoing, abuse, blame, " +
        "or anyone's state of mind. Never diagnose. If unsure, use 'other' with low confidence. " +
        "The rationale must be one short factual clause about the file itself.",
      prompt: JSON.stringify(listing),
    });

    const suggestions = output.items.filter((i) => listing.some((l) => l.id === i.id));
    if (suggestions.length) {
      const ins = await supabase.from("evidence_classification_suggestions").insert(
        suggestions.map((s) => ({
          user_id: userId,
          evidence_id: s.id,
          suggested_kind: s.kind,
          confidence: s.confidence,
          rationale: s.rationale,
          status: "pending",
          model: "google/gemini-3.6-flash",
        })),
      );
      if (ins.error) throw new Error("We couldn't save those suggestions.");
    }
    return { count: suggestions.length };
  });

export const listContentSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { evidenceIds?: string[] } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("evidence_classification_suggestions")
      .select("id, evidence_id, suggested_kind, confidence, rationale, status, evidence(title)")
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(60);
    if (data.evidenceIds?.length) q = q.in("evidence_id", data.evidenceIds);
    const res = await q;
    if (res.error) return { suggestions: [] as ClassificationSuggestion[] };
    return {
      suggestions: (res.data ?? []).map((r) => {
        const ev = r.evidence as { title: string | null } | { title: string | null }[] | null;
        const title = Array.isArray(ev) ? (ev[0]?.title ?? null) : (ev?.title ?? null);
        return {
          id: r.id as string,
          evidence_id: r.evidence_id as string,
          suggested_kind: r.suggested_kind as string,
          confidence: r.confidence as number | null,
          rationale: r.rationale as string | null,
          status: r.status as string,
          title,
        };
      }),
    };
  });

export const decideContentSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; accept: boolean }) => {
    if (!input?.id) throw new Error("Missing suggestion");
    return input;
  })
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("evidence_classification_suggestions")
      .update({ status: data.accept ? "accepted" : "rejected" })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (res.error) throw new Error("We couldn't record that. Try again in a moment.");
    return { ok: true };
  });
