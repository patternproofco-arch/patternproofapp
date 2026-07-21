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
  abuser_tactics?: Array<{
    tactic: string;
    description: string;
    examples_count: number;
    why_it_matters: string;
    example_dates?: string[];
  }>;
  main_pattern_label?: string;
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
  forecast_30_day?: {
    summary: string;
    window_start: string;
    window_end: string;
    rationale: string;
  };
  risk_indicators?: string[];
  what_to_document_next?: string[];
  attorney_summary?: string;
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
      description: "Specific, recurring behavioral tactics the other party is using against the survivor (e.g. DARVO, gaslighting, love-bombing, isolation, financial control, monitoring, intimidation, silent treatment, triangulation, moving the goalposts). Only include tactics with clear evidence in the records.",
      items: {
        type: "object",
        properties: {
          tactic: { type: "string", description: "Short label for the tactic (e.g. 'DARVO', 'Gaslighting')." },
          description: { type: "string", description: "One-sentence plain-language description of how this tactic is showing up in this survivor's record." },
          examples_count: { type: "integer", description: "Approximate number of incidents where this tactic appears." },
          why_it_matters: { type: "string", description: "One sentence on why this pattern is worth tracking — for the survivor's own understanding, not legal advice." },
          example_dates: { type: "array", items: { type: "string" }, description: "Up to 3 dates (YYYY-MM-DD) of incidents that best illustrate the tactic." },
        },
        required: ["tactic", "description", "examples_count", "why_it_matters"],
      },
    },
    main_pattern_label: { type: "string", description: "Short label for the primary detected pattern (e.g. 'Escalation After Boundary-Setting')." },
    confidence_level: { type: "string", enum: ["Low", "Moderate", "Strong"], description: "Low if <5 corroborating incidents, Moderate if 5-10, Strong if 10+." },
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
    forecast_30_day: {
      type: "object",
      properties: {
        summary: { type: "string" },
        window_start: { type: "string", description: "ISO date (YYYY-MM-DD)." },
        window_end: { type: "string", description: "ISO date (YYYY-MM-DD)." },
        rationale: { type: "string" },
      },
      required: ["summary", "window_start", "window_end", "rationale"],
    },
    risk_indicators: { type: "array", items: { type: "string" } },
    what_to_document_next: { type: "array", items: { type: "string" } },
    attorney_summary: { type: "string", description: "Professional, neutral, evidence-based restatement suitable for legal review. Reference specific dates and frequencies. Do not editorialize." },
  },
  required: ["pattern_summary", "escalation_arc", "frequency_trends", "abuse_type_breakdown", "severity_trajectory", "gaps", "suggested_followups", "abuser_tactics", "main_pattern_label", "confidence_level", "secondary_patterns", "what_pattern_may_show", "evidence_list", "pattern_timeline_text", "common_triggers", "escalation_before", "escalation_during", "escalation_after", "forecast_30_day", "risk_indicators", "what_to_document_next", "attorney_summary"],
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
      supabase.from("incidents").select("date,time,location,description,abuse_types,witnesses,emotional_impact,severity_level,source,confirmed_at").eq("user_id", userId).is("deleted_at", null).order("date", { ascending: true }),
      supabase.from("communications").select("date,channel,direction,from_party,content,harassment_flag").eq("user_id", userId).order("date", { ascending: true }),
      supabase.from("escalation_flags").select("flag_type,severity_tier,details,created_at").eq("user_id", userId).is("dismissed_at", null),
      supabase.from("pattern_analyses").select("id,analysis,incident_count_at_time,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
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
        return { ok: true as const, analysis: cached.analysis as unknown as PatternAnalysisResult, cached: true };
      }
    }

    const summary = {
      incident_count: incidents.length,
      date_range: { first: incidents[0]?.date, last: incidents[incidents.length - 1]?.date },
      incidents: incidents.map((i) => ({
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
          { role: "system", content: "You are a pattern analyst for a domestic-abuse documentation app. You read the survivor's own records and identify trends, escalation, gaps in documentation, and useful next steps. You are NOT a lawyer, therapist, or diagnostician. You never label the other party, never diagnose, never rate the legal strength of the case. You speak in the survivor's voice — calm, factual, plain language. You always call the survivor 'you' or 'the user'. Always return your analysis via the record_pattern_analysis tool.\n\nIn addition to your existing analysis, you must now also generate:\n- main_pattern_label: a short label for the primary detected pattern (e.g. 'Escalation After Boundary-Setting', 'Custody Exchange Conflict Cycle', 'Post-Silence Explosive Contact').\n- confidence_level: 'Low' if fewer than 5 corroborating incidents, 'Moderate' if 5-10, 'Strong' if 10+.\n- secondary_patterns: any additional cycles you detect beyond the main one.\n- what_pattern_may_show: 2-3 sentences in calm, plain language explaining what this behavioral pattern may indicate. Do NOT diagnose. Do NOT use the words narcissist, sociopath, or abuser unless those words appear in the survivor's own notes. Focus on behavior, timing, and impact only.\n- evidence_list: a structured list of the most significant supporting incidents with date, description, and category.\n- pattern_timeline_text: a simple left-to-right text representation of the repeating cycle using arrows.\n- common_triggers: list of what typically precedes escalation.\n- escalation_before / escalation_during / escalation_after: describe the three phases.\n- forecast_30_day: based on the detected interval between past escalations, calculate window_start and window_end as ISO dates from today (" + new Date().toISOString().slice(0,10) + "). Write a summary paragraph using language like 'Based on the documented pattern so far… the next likely escalation window may occur between [date] and [date]. This is not a guarantee, but a risk-pattern projection based on past behavior.'\n- risk_indicators: specific behaviors the survivor should watch for and document next.\n- what_to_document_next: a checklist of evidence types to capture going forward.\n- attorney_summary: restate the full pattern in professional, neutral, evidence-based language suitable for legal review. Reference specific dates and frequencies. Use language like 'The documented evidence suggests a recurring escalation cycle...' Do not editorialize.\n\nLanguage rules: Never use the words narcissist, sociopath, or abuser unless the survivor wrote them. Never state predictions as certainties. Always hedge with 'may', 'based on documented evidence', 'if this pattern continues'. Survivor-facing sections: warm, calm, validating. Attorney sections: neutral, professional, evidence-based." },
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

    await supabase.from("pattern_analyses").insert({
      user_id: userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      analysis: parsed as any,
      incident_count_at_time: incidents.length,
      model_used: "google/gemini-2.5-pro",
    });

    // Push summary into the most recent case row, if one exists.
    const { data: caseRows } = await supabase
      .from("cases").select("id").eq("user_id", userId)
      .order("updated_at", { ascending: false }).limit(1);
    if (caseRows && caseRows[0]) {
      await supabase.from("cases")
        .update({ pattern_summary: parsed.pattern_summary })
        .eq("id", caseRows[0].id);
    }

    return { ok: true as const, analysis: parsed, cached: false };
  });

export const getLatestPatternAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("pattern_analyses")
      .select("analysis, incident_count_at_time, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return { found: false as const };
    return { found: true as const, analysis: data.analysis as unknown as PatternAnalysisResult, incidentCountAtTime: data.incident_count_at_time, createdAt: data.created_at };
  });