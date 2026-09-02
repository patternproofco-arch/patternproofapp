import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Multi-source timeline synthesizer.
 *
 * Gathers unlinked evidence (photos, videos with transcripts, message threads,
 * voice notes), asks the model for a chronologically ordered set of draft
 * incident entries, stores them as proposed_incidents, and returns them for
 * human Accept / Deny / Edit. Nothing is written to incidents until accept.
 */

const TIMELINE_SYSTEM_PROMPT = `You are the PatternProof Timeline Synthesizer.

ROLE
You are a calm, highly experienced mediator and former law-school professor who understands trauma and human memory. Your only job is to help a survivor turn the materials they already uploaded into clearer, more specific, chronologically ordered draft entries. You never give legal advice, never predict outcomes, never diagnose, and never invent facts.

NORTH STAR
- Use ONLY information that is present in the provided materials (photos, screenshots, videos, transcripts, message threads, voice notes, existing incident notes).
- Never invent dates, quotes, locations, people, motives, or emotions.
- When something is unclear, mark it as uncertain or leave the field null.
- Never label behavior as "abuse," "coercive control," "narcissistic," or any diagnostic/legal conclusion.
- Never ask leading questions. You are not conversing with the user in this step; you are only producing structured drafts.
- Every draft must be easy for a human to accept, edit, or discard. Prefer under-claiming over over-claiming.

OUTPUT RULES
Return valid JSON only. No markdown, no preamble, no trailing text.

Schema:
{
  "proposed_timeline": [
    {
      "sort_key": "YYYY-MM-DD or YYYY-MM-DDTHH:MM or null",
      "date_certainty": "confirmed" | "approximate" | "unknown",
      "draft_incident": {
        "date": "YYYY-MM-DD or null",
        "time": "HH:MM (24h) or null",
        "location": "string or null",
        "description": "1–5 calm, factual, first-person sentences drawn only from the materials. Use the survivor’s voice when possible. Separate what is shown from what is inferred. If only a single message or photo is available, describe only what is visible.",
        "abuse_types": [],
        "witnesses": "string or null",
        "emotional_impact": "string or null",
        "people_present": "string or null"
      },
      "source_evidence_ids": ["uuid", ...],
      "source_summary": "Short plain-language note, e.g. 'Drawn from 2 screenshots and 1 video transcript'",
      "confidence_notes": [
        "List any uncertainty, e.g. 'Date taken from EXIF; time is approximate', 'No clear location shown'"
      ]
    }
  ],
  "unmatched_items": [
    {
      "evidence_id": "uuid",
      "reason": "Why it could not be placed or turned into an entry"
    }
  ]
}

CLOSED SET FOR abuse_types (use sparingly, only when clearly supported by the material):
["physical","emotional","financial","coercive","custody","surveillance","location_tracking","account_control","smart_home","impersonation","digital_intimidation","other"]

CHRONOLOGY RULES
- Order the proposed_timeline array from earliest to latest.
- Prefer EXIF / file metadata / explicit dates in text over upload time.
- If only an approximate period is known, set date_certainty to "approximate" and still place the item in the best relative order you can.
- Do not create duplicate entries for the same underlying event. Merge sources that clearly refer to the same incident.
- If materials are too thin to support even a minimal factual description, put the item in unmatched_items instead of inventing content.

STYLE FOR description
- Calm, plain, first-person where natural.
- Specific over vague.
- Never add interpretation, diagnosis, or legal conclusions.
- If the material is a transcript, quote short relevant phrases and attribute them neutrally (e.g. "Speaker 1 said …").
- Keep each description to 1–5 sentences.

VIDEO / AUDIO
- Base the draft primarily on the provided transcript and any supplied metadata.
- Do not invent visual details that are not described in the transcript or metadata.
- Speaker labels are approximate ("Speaker 1", "Speaker 2"); never assign real names unless the survivor’s own notes already do so.

FINAL CHECK BEFORE OUTPUT
- Did I invent any fact? If yes, remove it.
- Is every claim traceable to a source_evidence_id?
- Is the language free of legal conclusions and diagnoses?
- Would a survivor be able to accept this as-is or easily edit it?
`;

const DraftIncidentSchema = z.object({
  date: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  description: z.string().min(1).max(4000),
  abuse_types: z.array(z.string()).default([]),
  witnesses: z.string().nullable().optional(),
  emotional_impact: z.string().nullable().optional(),
  people_present: z.string().nullable().optional(),
});

type DraftIncident = z.infer<typeof DraftIncidentSchema>;

export const proposeTimelineFromEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        evidence_ids: z.array(z.string().uuid()).max(40).optional(),
        include_threads: z.boolean().optional().default(true),
        include_voice_notes: z.boolean().optional().default(true),
        date_range: z
          .object({
            from: z.string().optional(),
            to: z.string().optional(),
          })
          .optional(),
        max_items: z.number().int().min(1).max(40).optional().default(40),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { ok: false as const, reason: "The guide is not available right now." };
    }

    // ---- Gather evidence ----
    let evidenceQuery = supabase
      .from("evidence")
      .select(
        "id, title, file_type, mime, description, date, exif_captured_at, in_image_timestamp_text, transcript, transcript_status, ingested_at, created_at, linked_incident_id, original_filename",
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(data.max_items);

    if (data.evidence_ids?.length) {
      evidenceQuery = evidenceQuery.in("id", data.evidence_ids);
    } else {
      // Prefer items not yet linked to an incident
      evidenceQuery = evidenceQuery.is("linked_incident_id", null);
    }

    const { data: evidenceRows, error: evidenceError } = await evidenceQuery;
    if (evidenceError) throw new Error(evidenceError.message);

    // Do not create repeated drafts for uploads that are already waiting for
    // survivor review. Accepted uploads are excluded by linked_incident_id.
    const pending = await supabase
      .from("proposed_incidents")
      .select("source_evidence_ids")
      .eq("user_id", userId)
      .eq("status", "pending");
    const alreadyProposed = new Set<string>(
      (pending.data ?? []).flatMap((row) => (row.source_evidence_ids ?? []) as string[]),
    );
    const availableEvidenceRows = (evidenceRows ?? []).filter(
      (row) => !alreadyProposed.has(row.id),
    );

    const materials: Array<{
      evidence_id: string;
      kind: string;
      title: string;
      date_hint: string | null;
      text: string;
    }> = [];

    for (const row of availableEvidenceRows) {
      const isRecordedMedia = row.mime?.startsWith("video/") || row.mime?.startsWith("audio/");
      if (isRecordedMedia && (!row.transcript || row.transcript_status !== "ready")) {
        // A filename or user title is not enough evidence to draft what
        // happened in a recording. Wait for a real transcript.
        continue;
      }
      const dateHint =
        row.exif_captured_at ??
        row.in_image_timestamp_text ??
        row.date ??
        row.ingested_at ??
        row.created_at;
      let text = row.description ?? row.title ?? "";
      if (row.transcript && row.transcript_status === "ready") {
        text = [text, "--- Transcript ---", row.transcript].filter(Boolean).join("\n");
      }
      materials.push({
        evidence_id: row.id,
        kind: row.mime?.startsWith("video/")
          ? "video"
          : row.mime?.startsWith("audio/")
            ? "audio"
            : row.mime?.startsWith("image/")
              ? "image"
              : (row.file_type ?? "file"),
        title: row.title ?? row.original_filename ?? "Untitled",
        date_hint: dateHint,
        text: text.slice(0, 6000),
      });
    }

    // ---- Optional: recent message threads (summaries only) ----
    if (data.include_threads) {
      const { data: threads } = await supabase
        .from("message_threads")
        .select(
          "id, source_filename, summary, attorney_summary, captured_at, created_at, message_count",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      for (const t of threads ?? []) {
        materials.push({
          evidence_id: t.id,
          kind: "message_thread",
          title: t.source_filename ?? "Message thread",
          date_hint: t.captured_at ?? t.created_at,
          text: (
            t.attorney_summary ??
            t.summary ??
            `Thread with ${t.message_count ?? 0} messages`
          ).slice(0, 3000),
        });
      }
    }

    // ---- Optional: voice notes ----
    if (data.include_voice_notes) {
      const { data: notes } = await supabase
        .from("voice_notes")
        .select("id, title, date, transcript, transcription_status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      for (const n of notes ?? []) {
        materials.push({
          evidence_id: n.id,
          kind: "voice_note",
          title: n.title ?? "Voice note",
          date_hint: n.date ?? n.created_at,
          text: (n.transcription_status === "ready" ? n.transcript : null) ?? n.title ?? "",
        });
      }
    }

    if (materials.length === 0) {
      return {
        ok: true as const,
        proposed_timeline: [],
        unmatched_items: [],
        generated_at: new Date().toISOString(),
        message: "No unlinked uploads found to organize yet.",
      };
    }

    // Cap total context size
    const contextPayload = materials.slice(0, data.max_items).map((m) => ({
      evidence_id: m.evidence_id,
      kind: m.kind,
      title: m.title,
      date_hint: m.date_hint,
      content: m.text.slice(0, 4000),
    }));

    const userMessage = `Here are the materials the survivor has uploaded. Produce a chronologically ordered set of draft incident entries. Use only what is present. Return JSON only.\n\n${JSON.stringify(contextPayload, null, 2)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: TIMELINE_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 4000,
      }),
    });

    if (!res.ok) {
      return {
        ok: false as const,
        reason: `Could not generate proposals right now (${res.status}). Try again in a moment.`,
      };
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed: {
      proposed_timeline?: Array<{
        sort_key?: string | null;
        date_certainty?: string;
        draft_incident?: DraftIncident;
        source_evidence_ids?: string[];
        source_summary?: string;
        confidence_notes?: string[];
      }>;
      unmatched_items?: Array<{ evidence_id: string; reason: string }>;
    };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return { ok: false as const, reason: "Could not parse the proposal. Please try again." };
    }

    const batchId = crypto.randomUUID();
    const rowsToInsert = (parsed.proposed_timeline ?? [])
      .filter((p) => p.draft_incident?.description)
      .map((p) => {
        const draft = DraftIncidentSchema.safeParse(p.draft_incident);
        if (!draft.success) return null;
        return {
          user_id: userId,
          batch_id: batchId,
          sort_key: p.sort_key ?? draft.data.date ?? null,
          date_certainty:
            p.date_certainty === "confirmed" ||
            p.date_certainty === "approximate" ||
            p.date_certainty === "unknown"
              ? p.date_certainty
              : "unknown",
          draft: draft.data,
          source_evidence_ids: p.source_evidence_ids ?? [],
          source_summary: p.source_summary ?? null,
          confidence_notes: p.confidence_notes ?? [],
          status: "pending",
          model: "google/gemini-2.5-pro",
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rowsToInsert.length === 0) {
      return {
        ok: true as const,
        proposed_timeline: [],
        unmatched_items: parsed.unmatched_items ?? [],
        generated_at: new Date().toISOString(),
        message: "No draft entries could be formed from the current materials.",
      };
    }

    // Inserts are service-role only (RLS denies authenticated INSERT on purpose).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("proposed_incidents")
      .insert(rowsToInsert)
      .select(
        "id, batch_id, sort_key, date_certainty, draft, source_evidence_ids, source_summary, confidence_notes, status, created_at",
      );

    if (insertError) throw new Error(insertError.message);

    return {
      ok: true as const,
      batch_id: batchId,
      proposed_timeline: inserted ?? [],
      unmatched_items: parsed.unmatched_items ?? [],
      generated_at: new Date().toISOString(),
    };
  });

/** List pending proposals for the current user. */
export const listProposedIncidents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("proposed_incidents")
      .select(
        "id, batch_id, sort_key, date_certainty, draft, source_evidence_ids, source_summary, confidence_notes, status, created_at",
      )
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("sort_key", { ascending: true, nullsFirst: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

/** Accept a proposal (optionally with survivor edits) → real incident + link evidence. */
export const acceptProposedIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        proposal_id: z.string().uuid(),
        edits: DraftIncidentSchema.partial().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: proposal, error } = await supabase
      .from("proposed_incidents")
      .select("*")
      .eq("id", data.proposal_id)
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();
    if (error || !proposal) throw new Error("Proposal not found or already reviewed.");

    const base = (proposal.draft ?? {}) as DraftIncident;
    const finalDraft = { ...base, ...(data.edits ?? {}) };
    if (!finalDraft.description?.trim()) {
      throw new Error("A description is required to accept this entry.");
    }

    const datePrecision =
      proposal.date_certainty === "confirmed"
        ? "exact"
        : proposal.date_certainty === "approximate"
          ? "approximate"
          : "unknown";

    const { data: incident, error: incError } = await supabase
      .from("incidents")
      .insert({
        user_id: userId,
        date: finalDraft.date ?? null,
        time: finalDraft.time ?? null,
        location: finalDraft.location ?? null,
        description: finalDraft.description,
        abuse_types: finalDraft.abuse_types ?? [],
        witnesses: finalDraft.witnesses ?? null,
        emotional_impact: finalDraft.emotional_impact ?? null,
        date_precision: datePrecision,
        source: "ai_proposed",
      })
      .select("id")
      .single();
    if (incError || !incident) throw new Error(incError?.message ?? "Could not create incident.");

    // Link source evidence when the IDs refer to evidence rows
    const sourceIds = (proposal.source_evidence_ids ?? []) as string[];
    if (sourceIds.length > 0) {
      const { error: linkError } = await supabase.from("incident_evidence_links").upsert(
        sourceIds.map((evidenceId) => ({
          incident_id: incident.id,
          evidence_id: evidenceId,
          user_id: userId,
          source: "ai_proposed_survivor_confirmed",
        })),
        { onConflict: "incident_id,evidence_id" },
      );
      if (linkError) throw new Error(linkError.message);

      // Compatibility for existing exports and professional views. Never
      // overwrite an earlier primary link; the junction table above is the
      // complete many-to-many record.
      await supabase
        .from("evidence")
        .update({
          linked_incident_id: incident.id,
          review_status: "confirmed",
        })
        .eq("user_id", userId)
        .is("linked_incident_id", null)
        .in("id", sourceIds);
    }

    await supabase
      .from("proposed_incidents")
      .update({
        status: data.edits ? "edited" : "accepted",
        created_incident_id: incident.id,
        draft: finalDraft,
        updated_at: new Date().toISOString(),
      })
      .eq("id", proposal.id)
      .eq("user_id", userId);

    return { ok: true as const, incident_id: incident.id };
  });

/** Deny a proposal — it will not be auto-reproposed. */
export const denyProposedIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ proposal_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("proposed_incidents")
      .update({ status: "denied", updated_at: new Date().toISOString() })
      .eq("id", data.proposal_id)
      .eq("user_id", userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
