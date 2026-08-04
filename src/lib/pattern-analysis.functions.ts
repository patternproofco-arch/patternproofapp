import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PatternAnalysisResult {
  pattern_summary: string;
  escalation_arc: string;
  frequency_trends: Array<{ period: string; count: number; note?: string }>;
  abuse_type_breakdown: Array<{ type: string; count: number; percent: number }>;
  severity_trajectory: "decreasing" | "stable" | "increasing" | "volatile" | "unknown";
  gaps: Array<{ gap: string; suggestion: string }>;
  suggested_followups: string[];
  // NOTE: the JSON key stays `abuser_tactics` for compatibility with pattern
  // analyses already stored in the database and with the `tactic:i` review
  // keys survivors have already set. Its meaning is survivor-reported
  // recurring behaviour, never an assertion about the other party.
  abuser_tactics?: Array<{
    tactic: string;
    description: string;
    examples_count: number;
    why_it_matters: string;
    example_dates?: string[];
  }>;
  main_pattern_label?: string;
  /** Plain count of incidents in the record that support the primary pattern. */
  corroborating_incident_count?: number;
  /** @deprecated Legacy evidentiary-sounding label on pre-existing rows. No longer generated or displayed. */
  confidence_level?: "Low" | "Moderate" | "Strong";
  secondary_patterns?: string[];
  what_pattern_may_show?: string;
  evidence_list?: Array<{
    date: string;
    description: string;
    category: "threat" | "accusation" | "silence" | "charm" | "financial" | "custody" | "stalking" | "post-incident" | "other";
  }>;
  pattern_timeline_text?: string;
  common_triggers?: string[];
  escalation_before?: string;
  escalation_during?: string;
  escalation_after?: string;
  what_to_document_next?: string[];
  attorney_summary?: string;
  severity_indicators?: Array<{
    label: string;
    note: string;
    source_incident_ids: string[];
  }>;
  generated_at: string;
}

const TOOL_SCHEMA = {
  type: "object",
  properties: {
    pattern_summary: { type: "string", description: "2-4 sentence plain-language summary of the overall pattern, suitable to drop into a court packet. First-person about the survivor's experience, factual, no legal conclusions." },
    escalation_arc: { type: "string", description: "Brief narrative describing whether and how severity has shifted over time. Use phrases like 'increased frequency in spring', not statistics." },
    frequency_trends: { type: "array", items: { type: "object", properties: { period: { type: "string" }, count: { type: "integer" }, note: { type: "string" } }, required: ["period", "count"] } },
    abuse_type_breakdown: { type: "array", items: { type: "object", properties: { type: { type: "string" }, count: { type: "integer" }, percent: { type: "number" } }, required: ["type", "count", "percent"] } },
    severity_trajectory: { type: "string", enum: ["decreasing", "stable", "increasing", "volatile", "unknown"] },
    gaps: { type: "array", items: { type: "object", properties: { gap: { type: "string", description: "What's missing or unclear in the record" }, suggestion: { type: "string", description: "Gentle, specific suggestion of what to add" } }, required: ["gap", "suggestion"] } },
    suggested_followups: { type: "array", items: { type: "string" }, description: "Concrete next documentation steps in the user's voice" },
    abuser_tactics: {
      type: "array",
      description: "Recurring behaviours the survivor has reported across their own entries, grouped and counted. These are the survivor's reports read back to them — never an assertion that the other party did something, and never a finding that any behaviour amounts to abuse. Only group behaviours that actually appear more than once in the records provided. Do not infer, extrapolate, or add behaviours the records do not describe.",
      items: {
        type: "object",
        properties: {
          tactic: { type: "string", description: "Short plain-language label for the reported behaviour, drawn from what the survivor described (e.g. 'Contact after being asked to stop', 'Disputed account of a prior conversation'). Do not use clinical or diagnostic terms such as DARVO, gaslighting, or narcissistic abuse unless the survivor used that exact word in their own entries." },
          description: { type: "string", description: "One sentence describing what the survivor reported, attributed to them: 'You reported ...' / 'Your entries describe ...'. Never phrase it as an established fact about the other party." },
          examples_count: { type: "integer", description: "Number of the survivor's own entries that describe this behaviour." },
          why_it_matters: { type: "string", description: "One sentence on why this may be worth continuing to document — for the survivor's own understanding. Not legal advice, not a conclusion that it is significant." },
          example_dates: { type: "array", items: { type: "string" }, description: "Up to 3 dates (YYYY-MM-DD) of entries that describe it." },
        },
        required: ["tactic", "description", "examples_count", "why_it_matters"],
      },
    },
    main_pattern_label: { type: "string", description: "Short label for the primary detected pattern (e.g. 'Escalation After Boundary-Setting')." },
    corroborating_incident_count: { type: "integer", description: "Plain count of incidents in the provided records that describe the primary pattern. A count only — do not interpret it, rate it, or convert it into a strength or confidence judgement." },
    secondary_patterns: { type: "array", items: { type: "string" } },
    what_pattern_may_show: { type: "string", description: "2-3 sentences in calm plain language explaining what this behavioral pattern may indicate. Do NOT diagnose. Do NOT use the words narcissist, sociopath, or abuser unless those words appear in the survivor's own notes." },
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
    pattern_timeline_text: { type: "string", description: "Left-to-right text representation of the cycle using arrows, e.g. 'Calm → Boundary Set → Accusation → Threat → Silence → Charm → Calm → Repeat'." },
    common_triggers: { type: "array", items: { type: "string" } },
    escalation_before: { type: "string" },
    escalation_during: { type: "string" },
    escalation_after: { type: "string" },
    what_to_document_next: { type: "array", items: { type: "string" } },
    attorney_summary: { type: "string", description: "Professional, neutral, evidence-based restatement suitable for legal review. Reference specific dates and frequencies. Do not editorialize." },
    severity_indicators: {
      type: "array",
      description: "Documented behaviors already present in the survivor's confirmed incidents that commonly co-occur with safety escalation (e.g. threats involving weapons, strangulation/choking, threats to kill). Descriptive only — never a prediction, tier, score, or clinical assessment. Every item MUST cite at least one source incident id it is drawn from.",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Short factual label of the documented behavior (e.g. 'Non-fatal strangulation described', 'Verbal threat to kill', 'Threat involving a weapon'). Do not use words like 'risk', 'tier', 'high', 'detected'." },
          note: { type: "string", description: "One calm sentence describing what the record shows, hedged. Include the phrase 'documented in your records, not a prediction or clinical assessment' or an equivalent hedge." },
          source_incident_ids: { type: "array", items: { type: "string" }, minItems: 1, description: "Incident id(s) from the input list this item is drawn from. Required — no item without a source citation." },
        },
        required: ["label", "note", "source_incident_ids"],
      },
    },
  },
  required: ["pattern_summary", "escalation_arc", "frequency_trends", "abuse_type_breakdown", "severity_trajectory", "gaps", "suggested_followups", "abuser_tactics", "main_pattern_label", "corroborating_incident_count", "secondary_patterns", "what_pattern_may_show", "evidence_list", "pattern_timeline_text", "common_triggers", "escalation_before", "escalation_during", "escalation_after", "what_to_document_next", "attorney_summary", "severity_indicators"],
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
          { role: "system", content: "You are a pattern analyst for a domestic-abuse documentation app. You read the survivor's own records and identify trends, escalation, gaps in documentation, and useful next steps. You are NOT a lawyer, therapist, or diagnostician. You never label the other party, never diagnose, never rate the legal strength of the case. You never predict or forecast future incidents. You describe what the documented record shows, not what may happen next. You speak in the survivor's voice — calm, factual, plain language. You always call the survivor 'you' or 'the user'. Always return your analysis via the record_pattern_analysis tool.\n\nIn addition to your existing analysis, you must now also generate:\n- main_pattern_label: a short label for the primary detected pattern (e.g. 'Escalation After Boundary-Setting', 'Custody Exchange Conflict Cycle', 'Post-Silence Explosive Contact').\n- confidence_level: 'Low' if fewer than 5 corroborating incidents, 'Moderate' if 5-10, 'Strong' if 10+.\n- secondary_patterns: any additional cycles you detect beyond the main one.\n- what_pattern_may_show: 2-3 sentences in calm, plain language explaining what this behavioral pattern may indicate. Do NOT diagnose. Do NOT use the words narcissist, sociopath, or abuser unless those words appear in the survivor's own notes. Focus on behavior, timing, and impact only.\n- evidence_list: a structured list of the most significant supporting incidents with date, description, and category.\n- pattern_timeline_text: a simple left-to-right text representation of the repeating cycle using arrows.\n- common_triggers: list of what typically precedes escalation in the documented record.\n- escalation_before / escalation_during / escalation_after: describe the three phases as they appear in the record.\n- what_to_document_next: a checklist of evidence types to capture going forward. This is descriptive guidance about documentation gaps, not a prediction of future behavior.\n- attorney_summary: restate the full pattern in professional, neutral, evidence-based language suitable for legal review. Reference specific dates and frequencies. Use language like 'The documented evidence suggests a recurring escalation cycle...' Do not editorialize.\n- severity_indicators: documented behaviors already present in the survivor's confirmed incidents that commonly co-occur with safety escalation (for example threats involving weapons, strangulation or choking described, threats to kill). STRICT RULES for severity_indicators:\n  * Draw ONLY from the confirmed incidents in the records provided in this request. If a behavior is not documented in these incidents, do not include it. Do not invent or infer beyond what is written.\n  * Every item MUST cite the specific incident id(s) it is drawn from in source_incident_ids, using the exact id strings from the input. An item with no source citation is invalid — omit it entirely.\n  * Use short, factual labels: 'Non-fatal strangulation described', 'Verbal threat to kill', 'Threat involving a weapon'. Never use the words 'risk', 'risk level', 'high risk', 'tier', 'score', 'probability', 'detected', or 'likely'. Descriptive labeling only.\n  * The note field is one calm sentence describing what the record shows, always hedged, and must make clear this is 'documented in your records, not a prediction or clinical assessment'.\n  * Do NOT assign a tier, score, or probability. Do NOT rank items. Do NOT say 'research shows' or cite any named clinical framework, checklist, or methodology.\n  * If no such behaviors appear in the confirmed incidents, return an empty array. An empty array is the correct answer when the record does not contain these behaviors.\n\nLanguage rules: Never use the words narcissist, sociopath, or abuser unless the survivor wrote them. Never state predictions as certainties. Never forecast dates, windows, or timelines for future incidents. Always hedge with 'may', 'based on documented evidence', 'if this pattern continues'. Survivor-facing sections: warm, calm, validating. Attorney sections: neutral, professional, evidence-based." },
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

    // Enforce citation invariant server-side: strip any severity_indicators
    // item that lacks a source_incident_id or cites an id not in the input.
    if (Array.isArray(parsed.severity_indicators)) {
      const validIds = new Set(incidents.map((i) => i.id));
      parsed.severity_indicators = parsed.severity_indicators
        .map((s) => ({
          label: String(s.label ?? "").trim(),
          note: String(s.note ?? "").trim(),
          source_incident_ids: (s.source_incident_ids ?? []).filter((id) => validIds.has(id)),
        }))
        .filter((s) => s.label && s.note && s.source_incident_ids.length > 0);
    }

    // Seed reviewed_status for every severity indicator with "unsure" default.
    const seededStatus: Record<string, ClaimReviewState> = {};
    (parsed.severity_indicators ?? []).forEach((_s, i) => {
      seededStatus[`sev:${i}`] = { status: "unsure" };
    });
    if (parsed.main_pattern_label) seededStatus["main_pattern"] = { status: "unsure" };
    if (parsed.what_pattern_may_show) seededStatus["interpretation"] = { status: "unsure" };
    if (parsed.attorney_summary) seededStatus["attorney_summary"] = { status: "unsure" };
    (parsed.abuser_tactics ?? []).forEach((_t, i) => {
      seededStatus[`tactic:${i}`] = { status: "unsure" };
    });

    const insertRes = await supabase.from("pattern_analyses").insert({
      user_id: userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      analysis: parsed as any,
      incident_count_at_time: incidents.length,
      model_used: "google/gemini-2.5-pro",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reviewed_status: seededStatus as any,
    }).select("id").single();

    // Push summary into the most recent case row, if one exists.
    const { data: caseRows } = await supabase
      .from("cases").select("id").eq("user_id", userId)
      .order("updated_at", { ascending: false }).limit(1);
    if (caseRows && caseRows[0]) {
      await supabase.from("cases")
        .update({ pattern_summary: parsed.pattern_summary })
        .eq("id", caseRows[0].id);
    }

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