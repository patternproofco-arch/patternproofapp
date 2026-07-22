import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface DashboardStats {
  incident_count: number;
  unconfirmed_ai_count: number;
  evidence_count: number;
  uncertain_date_count: number;
  has_pattern_analysis: boolean;
  voice_note_count: number;
  has_case: boolean;
  upcoming_court_dates: number;
  ever_had_court_date: boolean;
  last_activity: "evidence" | "timeline" | "patterns" | "journal" | null;
  unreviewed_severity_indicator_count: number;
}

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardStats> => {
    const { supabase, userId } = context;
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = now.toISOString();

    const [
      incidentsConfirmed,
      unconfirmedAi,
      evidence,
      uncertainDates,
      patternRow,
      voiceNotes,
      caseRow,
      upcomingCourt,
      anyCourt,
      lastIncident,
      lastEvidence,
      lastPattern,
    ] = await Promise.all([
      supabase.from("incidents").select("id", { count: "exact", head: true })
        .eq("user_id", userId).is("deleted_at", null)
        .or("source.neq.ai_extracted,confirmed_at.not.is.null"),
      supabase.from("incidents").select("id", { count: "exact", head: true })
        .eq("user_id", userId).is("deleted_at", null)
        .eq("source", "ai_extracted").is("confirmed_at", null),
      supabase.from("evidence").select("id", { count: "exact", head: true })
        .eq("user_id", userId).is("deleted_at", null),
      supabase.from("incidents").select("id", { count: "exact", head: true })
        .eq("user_id", userId).is("deleted_at", null)
        .neq("date_precision", "exact"),
      supabase.from("pattern_analyses").select("id").eq("user_id", userId).limit(1).maybeSingle(),
      supabase.from("voice_notes").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("cases").select("id").eq("user_id", userId).limit(1).maybeSingle(),
      supabase.from("court_dates").select("id", { count: "exact", head: true })
        .eq("user_id", userId).gte("hearing_at", nowIso).lte("hearing_at", in30),
      supabase.from("court_dates").select("id").eq("user_id", userId).limit(1).maybeSingle(),
      supabase.from("incidents").select("updated_at").eq("user_id", userId).is("deleted_at", null)
        .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("evidence").select("created_at").eq("user_id", userId).is("deleted_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("pattern_analyses").select("created_at").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const { data: latestAnalysis } = await supabase
      .from("pattern_analyses")
      .select("analysis, reviewed_status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let unreviewed_severity_indicator_count = 0;
    const indicators = (latestAnalysis?.analysis as { severity_indicators?: unknown[] } | null)
      ?.severity_indicators;
    const reviewedStatus = (latestAnalysis?.reviewed_status ?? {}) as Record<string, { status?: string }>;
    if (Array.isArray(indicators)) {
      unreviewed_severity_indicator_count = indicators.reduce((count, _item, index) => {
        const entry = reviewedStatus[`sev:${index}`];
        return !entry || entry.status === "unsure" ? count + 1 : count;
      }, 0);
    }

    // Determine last-used surface (roughly)
    const times: Array<{ key: DashboardStats["last_activity"]; t: number }> = [];
    const push = (key: DashboardStats["last_activity"], v?: string | null) => {
      if (v) times.push({ key, t: new Date(v).getTime() });
    };
    push("journal", (lastIncident.data as { updated_at?: string } | null)?.updated_at);
    push("evidence", (lastEvidence.data as { created_at?: string } | null)?.created_at);
    push("patterns", (lastPattern.data as { created_at?: string } | null)?.created_at);
    times.sort((a, b) => b.t - a.t);
    const last_activity = times[0]?.key ?? null;

    return {
      incident_count: incidentsConfirmed.count ?? 0,
      unconfirmed_ai_count: unconfirmedAi.count ?? 0,
      evidence_count: evidence.count ?? 0,
      uncertain_date_count: uncertainDates.count ?? 0,
      has_pattern_analysis: !!patternRow.data,
      voice_note_count: voiceNotes.count ?? 0,
      has_case: !!caseRow.data,
      upcoming_court_dates: upcomingCourt.count ?? 0,
      ever_had_court_date: !!anyCourt.data,
      last_activity,
      unreviewed_severity_indicator_count,
    };
  });