import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PatternAnalysisResult {
  frequency_trends: Array<{ period: string; count: number; note?: string }>;
  abuse_type_breakdown: Array<{ type: string; count: number; percent: number }>;
  gaps: Array<{ gap: string; suggestion: string }>;
  suggested_followups: string[];
  /**
   * REMOVED (never diagnose rule): `abuser_tactics`, `main_pattern_label`,
   * `secondary_patterns` and `what_pattern_may_show` are no longer generated,
   * typed, displayed or exported. Older jsonb rows may still contain them;
   * nothing in the app reads them.
   *
   * REMOVED (frequency-only rule): the interpretive narrative fields
   * `pattern_summary`, `escalation_arc`, `severity_trajectory`,
   * `pattern_timeline_text`, `common_triggers`, `escalation_before`,
   * `escalation_during` and `escalation_after` are likewise no longer
   * generated, typed, rendered or exported. Legacy rows may carry them; the
   * export whitelist drops them.
   */
  /** Plain count of incidents in the record that support the primary pattern. */
  corroborating_incident_count?: number;
  /** @deprecated Legacy evidentiary-sounding label on pre-existing rows. No longer generated or displayed. */
  confidence_level?: "Low" | "Moderate" | "Strong";
  evidence_list?: Array<{
    date: string;
    description: string;
    category: "threat" | "accusation" | "silence" | "charm" | "financial" | "custody" | "stalking" | "post-incident" | "other";
  }>;
  what_to_document_next?: string[];
  attorney_summary?: string;
  /**
   * @deprecated RETIRED. The "documented severity indicators" / escalation
   * feature is no longer generated, displayed, counted or exported. Legacy
   * jsonb rows may still carry this key; nothing in the app reads it.
   */
  severity_indicators?: never;
  generated_at: string;
}

const TOOL_SCHEMA = {
  type: "object",
  properties: {
    frequency_trends: { type: "array", items: { type: "object", properties: { period: { type: "string" }, count: { type: "integer" }, note: { type: "string" } }, required: ["period", "count"] } },
    abuse_type_breakdown: { type: "array", items: { type: "object", properties: { type: { type: "string" }, count: { type: "integer" }, percent: { type: "number" } }, required: ["type", "count", "percent"] } },
    gaps: { type: "array", items: { type: "object", properties: { gap: { type: "string", description: "What's missing or unclear in the record" }, suggestion: { type: "string", description: "Gentle, specific suggestion of what to add" } }, required: ["gap", "suggestion"] } },
    suggested_followups: { type: "array", items: { type: "string" }, description: "Concrete next documentation steps in the user's voice" },
    corroborating_incident_count: { type: "integer", description: "Plain count of incidents in the provided records that describe the primary pattern. A count only — do not interpret it, rate it, or convert it into a strength or confidence judgement." },
    evidence_list: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          description: { type: "string" },
          category: { type: "string", enum: ["threat", "accusation", "silence", "charm", "financial", "custody", "stalking", "post-incident", "other"] },
        },
        required: ["date", "description", "category"],
      },
    },
    what_to_document_next: { type: "array", items: { type: "string" } },
    attorney_summary: { type: "string", description: "Neutral restatement of frequency only, suitable for professional review. State counts, date ranges and dates drawn from the records provided (e.g. 'The records contain 14 entries between 3 March and 2 August 2026; 6 fall on custody-exchange dates.'). Do NOT characterise the record as a cycle, escalation, pattern of abuse, or any named dynamic. Do NOT interpret, diagnose, rate, or draw conclusions. Counts, dates and the survivor's own wording only." },
  },
  required: ["frequency_trends", "abuse_type_breakdown", "gaps", "suggested_followups", "corroborating_incident_count", "evidence_list", "what_to_document_next", "attorney_summary"],
  additionalProperties: false,
};

export const analyzePatterns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ force: z.boolean().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false as const, reason: "missing-key" };

    const [incidentsRes, commsRes, flagsRes, cachedRes] = await Promise.all([
      supabase.from("incidents").select("id,date,time,location,description,abuse_types,witnesses,emotional_impact,severity_level,source,confirmed_at").eq("user_id", userId).is("deleted_at", null).order("date", { ascending: true }),
      supabase.from("communications").select("date,channel,direction,from_party,content,harassment_flag").eq("user_id", userId).order("date", { ascending: true }),
      supabase.from("escalation_flags").select("flag_type,severity_tier,details,created_at").eq("user_id", userId).is("dismissed_at", null),
      supabase.from("pattern_analyses").select("id,analysis,incident_count_at_time,created_at,reviewed_status").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
    ]);

    const rawIncidents = incidentsRes.data ?? [];
    // Exclude unconfirmed AI-extracted drafts from pattern conclusions.
    const incidents = rawIncidents.filter(
      (i) => !(i.source === "ai_extracted" && !i.confirmed_at),
    );
    if (incidents.length < 2) {
      return { ok: false as const, reason: "not-enough-data", incidentCount: incidents.length };
    }

    const cached = cachedRes.data?.[0];
    // Reuse cache if recent (< 24h) and no significant change in count, unless forced.
    if (!data.force && cached) {
      const ageHours = (Date.now() - new Date(cached.created_at).getTime()) / 36e5;
      const countDelta = incidents.length - (cached.incident_count_at_time ?? 0);
      if (ageHours < 24 && countDelta < 3) {
        return { ok: true as const, id: cached.id, analysis: cached.analysis as unknown as PatternAnalysisResult, reviewed_status: (cached.reviewed_status ?? {}) as Record<string, ClaimReviewState>, cached: true };
      }
    }

    const summary = {
      incident_count: incidents.length,
      date_range: { first: incidents[0]?.date, last: incidents[incidents.length - 1]?.date },
      incidents: incidents.map((i) => ({
        id: i.id,
        date: i.date,
        time: i.time,
        location: i.location,
        types: i.abuse_types,
        severity: i.severity_level,
        description: typeof i.description === "string" ? i.description.slice(0, 600) : "",
        emotional_impact: i.emotional_impact,
        witnesses: i.witnesses,
      })),
      communications_count: (commsRes.data ?? []).length,
      harassment_flagged_count: (commsRes.data ?? []).filter((c) => c.harassment_flag).length,
      escalation_flags: flagsRes.data ?? [],
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: "You are a documentation analyst for a records app. You read the survivor's own records and report FREQUENCY AND RECURRENCE ONLY: dates, counts, date ranges, the survivor's own abuse-type tags, gaps in documentation, and source-linked examples. You are NOT a lawyer, therapist, or diagnostician. You never label the other party, never diagnose, never state a legal or clinical conclusion, never rate the legal strength of the case, and never assert that any described behaviour occurred or amounts to abuse. You never infer or describe cycles, phases, triggers, escalation, trajectories, or any named dynamic — even if the records appear to show one. You never predict or forecast future incidents and never use continuation framing such as 'if this continues'. Everything you produce is a restatement of what the survivor themselves reported, attributed to them. You speak plainly and calmly and always call the survivor 'you'. Always return your analysis via the record_pattern_analysis tool.\n\nField rules:\n- frequency_trends: counts per period taken directly from the record dates. Counts and periods only.\n- abuse_type_breakdown: counts and percentages of the survivor's OWN abuse_types tags. Never invent a category the survivor did not tag.\n- gaps: purely missing-documentation observations (e.g. 'no time recorded on four entries'), never interpretation of behaviour.\n- suggested_followups / what_to_document_next: concrete documentation steps. Descriptive guidance about documentation gaps, not a prediction of future behaviour.\n- corroborating_incident_count: a plain integer count of entries in the provided records. It is a count and nothing more. Do NOT convert it into a confidence, strength, severity, or evidentiary rating, and do NOT characterise it as low, moderate, strong, weak, or sufficient.\n- evidence_list: the most significant entries with date, description, and category, drawn verbatim from the records.\n- attorney_summary: a neutral restatement of FREQUENCY ONLY, suitable for professional review. State counts, dates and date ranges taken from the records provided (e.g. 'The records contain 14 entries dated between 3 March and 2 August 2026, 6 of which fall on custody-exchange dates.'). Do NOT characterise the record as a cycle, an escalation, a pattern of abuse, or any named dynamic. Do NOT interpret, diagnose, rate, or draw any conclusion. Counts, dates, and the survivor's own wording only.\n- severity_indicators: documented behaviors already present in the survivor's confirmed incidents that commonly co-occur with safety escalation (for example threats involving weapons, strangulation or choking described, threats to kill). STRICT RULES for severity_indicators:\n  * Draw ONLY from the confirmed incidents in the records provided in this request. If a behavior is not documented in these incidents, do not include it. Do not invent or infer beyond what is written.\n  * Every item MUST cite the specific incident id(s) it is drawn from in source_incident_ids, using the exact id strings from the input. An item with no source citation is invalid — omit it entirely.\n  * Use short, factual labels: 'Non-fatal strangulation described', 'Verbal threat to kill', 'Threat involving a weapon'. Never use the words 'risk', 'risk level', 'high risk', 'tier', 'score', 'probability', 'detected', or 'likely'. Descriptive labeling only.\n  * The note field is one calm sentence describing what the record shows, always hedged, and must make clear this is 'documented in your records, not a prediction or clinical assessment'.\n  * Do NOT assign a tier, score, or probability. Do NOT rank items. Do NOT say 'research shows' or cite any named clinical framework, checklist, or methodology.\n  * If no such behaviors appear in the confirmed incidents, return an empty array. An empty array is the correct answer when the record does not contain these behaviors.\n\nLanguage rules: Never use the words narcissist, sociopath, or abuser unless the survivor wrote them. Never state predictions as certainties. Never forecast dates, windows, or timelines for future incidents. Hedge with 'may' and 'based on documented evidence'. Keep all wording calm, factual, and plain." },
          { role: "user", content: `Today is ${new Date().toISOString().slice(0,10)}. Analyze the following records and call record_pattern_analysis with your findings:\n\n${JSON.stringify(summary)}` },
        ],
        tools: [{ type: "function", function: { name: "record_pattern_analysis", description: "Record the pattern analysis", parameters: TOOL_SCHEMA } }],
        tool_choice: { type: "function", function: { name: "record_pattern_analysis" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return { ok: false as const, reason: "rate-limit" };
      if (res.status === 402) return { ok: false as const, reason: "credits" };
      return { ok: false as const, reason: "ai-failed" };
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }> };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { ok: false as const, reason: "no-tool-call" };

    let parsed: PatternAnalysisResult;
    try {
      parsed = { ...JSON.parse(args), generated_at: new Date().toISOString() };
    } catch {
      return { ok: false as const, reason: "parse-failed" };
    }

    // The severity-indicator / escalation feature is retired: drop the key if
    // an older model response still returns it, so nothing can be stored,
    // rendered or exported.
    delete (parsed as unknown as Record<string, unknown>)["severity_indicators"];

    // Seed reviewed_status. Every AI narrative that can reach an export starts
    // "unsure" and must be explicitly confirmed or edited by the survivor.
    const seededStatus: Record<string, ClaimReviewState> = {};
    if (parsed.attorney_summary) seededStatus["attorney_summary"] = { status: "unsure" };

    const insertRes = await supabase.from("pattern_analyses").insert({
      user_id: userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      analysis: parsed as any,
      incident_count_at_time: incidents.length,
      model_used: "google/gemini-2.5-pro",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reviewed_status: seededStatus as any,
    }).select("id").single();

    return { ok: true as const, id: insertRes.data?.id ?? null, analysis: parsed, reviewed_status: seededStatus, cached: false };
  });

export const getLatestPatternAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("pattern_analyses")
      .select("id, analysis, incident_count_at_time, created_at, reviewed_status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return { found: false as const };
    return {
      found: true as const,
      id: data.id,
      analysis: data.analysis as unknown as PatternAnalysisResult,
      reviewed_status: (data.reviewed_status ?? {}) as Record<string, ClaimReviewState>,
      incidentCountAtTime: data.incident_count_at_time,
      createdAt: data.created_at,
    };
  });

/* Per-claim review state for pattern-analysis items (severity_indicators today,
   extendable to other claim keys later). Keyed as "<kind>:<index>", e.g. "sev:0". */
export type ClaimReviewState = {
  status: "unsure" | "confirmed" | "rejected" | "edited";
  edited_note?: string;
  updated_at?: string;
};

export const setPatternClaimStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      analysis_id: z.string().uuid(),
      claim_key: z.string().min(1).max(64),
      status: z.enum(["unsure", "confirmed", "rejected", "edited"]),
      edited_note: z.string().max(2000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: readErr } = await supabase
      .from("pattern_analyses")
      .select("reviewed_status")
      .eq("id", data.analysis_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr || !row) return { ok: false as const };
    const current = (row.reviewed_status ?? {}) as Record<string, ClaimReviewState>;
    current[data.claim_key] = {
      status: data.status,
      edited_note: data.status === "edited" ? data.edited_note : undefined,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("pattern_analyses")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ reviewed_status: current as any })
      .eq("id", data.analysis_id)
      .eq("user_id", userId);
    if (error) return { ok: false as const };
    return { ok: true as const, reviewed_status: current };
  });