import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ------------------------- shared helpers ------------------------- */

async function assertAttorney(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "attorney")
    .maybeSingle();
  if (!data) throw new Error("Attorney role required");
}

async function assertLink(attorneyId: string, clientId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("attorney_client_links")
    .select("id,status,include_all_incidents,include_all_evidence,include_patterns,scope_incidents,scope_evidence")
    .eq("attorney_user_id", attorneyId)
    .eq("client_user_id", clientId)
    .maybeSingle();
  if (!data || data.status !== "active") throw new Error("No active access");
  return data;
}

/* ------------------------- role + profile ------------------------- */

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role as string);
    let role: "attorney" | "survivor" = "survivor";
    if (roles.includes("attorney")) role = "attorney";
    return { role, roles };
  });

export const upsertAttorneyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      full_name: z.string().trim().min(1).max(120),
      firm_name: z.string().trim().max(200).optional().nullable(),
      bar_number: z.string().trim().max(60).optional().nullable(),
      jurisdiction: z.string().trim().max(120).optional().nullable(),
      email: z.string().email().max(255),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: context.userId, role: "attorney" },
      { onConflict: "user_id,role" },
    );
    const { error } = await supabaseAdmin
      .from("attorney_profiles")
      .upsert({ user_id: context.userId, ...data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAttorneyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("attorney_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { profile: data };
  });

/* ------------------------- client list ------------------------- */

export const listMyClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAttorney(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: links } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id,client_user_id,created_at,status")
      .eq("attorney_user_id", context.userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    const clients = await Promise.all(
      (links ?? []).map(async (l) => {
        const [inc, ev, pat, esc, msg, doc] = await Promise.all([
          supabaseAdmin.from("incidents").select("id,date,severity_level", { count: "exact" }).eq("user_id", l.client_user_id),
          supabaseAdmin.from("evidence").select("id", { count: "exact", head: true }).eq("user_id", l.client_user_id),
          supabaseAdmin.from("pattern_analyses").select("analysis,created_at").eq("user_id", l.client_user_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabaseAdmin.from("escalation_flags").select("severity_tier", { count: "exact" }).eq("user_id", l.client_user_id).is("dismissed_at", null),
          supabaseAdmin.from("attorney_messages").select("id", { count: "exact", head: true }).eq("link_id", l.id).is("read_at", null).neq("sender_user_id", context.userId),
          supabaseAdmin.from("attorney_document_requests").select("id", { count: "exact", head: true }).eq("link_id", l.id).eq("status", "open"),
        ]);

        const incidents = inc.data ?? [];
        const lastIncident = incidents.reduce<string | null>((acc, r) => (!acc || r.date > acc ? r.date : acc), null);
        const earliestIncident = incidents.reduce<string | null>((acc, r) => (!acc || r.date < acc ? r.date : acc), null);
        const avgSeverity = incidents.length
          ? incidents.reduce((s, r) => s + (r.severity_level ?? 0), 0) / incidents.length
          : 0;

        const flagsHigh = (esc.data ?? []).filter((f) => (f.severity_tier ?? 0) >= 3).length;
        const riskLevel: "low" | "moderate" | "elevated" | "high" =
          flagsHigh >= 2 || avgSeverity >= 4 ? "high"
          : flagsHigh >= 1 || avgSeverity >= 3 ? "elevated"
          : incidents.length >= 5 ? "moderate"
          : "low";

        return {
          link_id: l.id,
          client_user_id: l.client_user_id,
          linked_at: l.created_at,
          incident_count: inc.count ?? 0,
          evidence_count: ev.count ?? 0,
          escalation_flag_count: esc.count ?? 0,
          unread_messages: msg.count ?? 0,
          open_doc_requests: doc.count ?? 0,
          last_incident_date: lastIncident,
          earliest_incident_date: earliestIncident,
          avg_severity: avgSeverity,
          risk_level: riskLevel,
          has_pattern_analysis: !!pat.data,
          pattern_updated_at: pat.data?.created_at ?? null,
        };
      }),
    );
    return { clients };
  });

/* ------------------------- single-client case ------------------------- */

type AnyJson = Record<string, unknown>;

export const getClientCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAttorney(context.userId);
    const link = await assertLink(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [incQ, evQ, patQ, escQ, voiceQ, comsQ, legalQ, caseQ] = await Promise.all([
      link.include_all_incidents
        ? supabaseAdmin.from("incidents").select("*").eq("user_id", data.clientId).order("date", { ascending: true })
        : supabaseAdmin.from("incidents").select("*").eq("user_id", data.clientId).in("id", link.scope_incidents ?? []).order("date", { ascending: true }),
      link.include_all_evidence
        ? supabaseAdmin.from("evidence").select("*").eq("user_id", data.clientId).order("date", { ascending: true })
        : supabaseAdmin.from("evidence").select("*").eq("user_id", data.clientId).in("id", link.scope_evidence ?? []).order("date", { ascending: true }),
      link.include_patterns
        ? supabaseAdmin.from("pattern_analyses").select("*").eq("user_id", data.clientId).order("created_at", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin.from("escalation_flags").select("*").eq("user_id", data.clientId).order("created_at", { ascending: false }),
      supabaseAdmin.from("voice_notes").select("id,title,date,transcript,duration_seconds").eq("user_id", data.clientId).order("date", { ascending: false }),
      supabaseAdmin.from("communications").select("id,date,time,direction,channel,from_party,content,harassment_flag,linked_incident_id").eq("user_id", data.clientId).order("date", { ascending: false }),
      supabaseAdmin.from("legal_documents").select("id,title,document_type,effective_date,expiration_date,case_number,court_name").eq("user_id", data.clientId).order("effective_date", { ascending: false }),
      supabaseAdmin.from("cases").select("*").eq("user_id", data.clientId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const incidents = incQ.data ?? [];
    const evidence = evQ.data ?? [];
    const flags = escQ.data ?? [];
    const pattern = (patQ.data ?? null) as { analysis: AnyJson; created_at: string } | null;

    /* ---- categorize ---- */
    const CATEGORY_MAP: Record<string, RegExp> = {
      "Financial control": /financial|money|bank|wage|account|withhold|debit/i,
      "Isolation": /isolat|cut off|forbid|prevent contact|alienat/i,
      "Threats": /threat|kill|harm|intimidat|warning/i,
      "Physical violence": /hit|punch|slap|push|kick|grab|strangl|chok|assault|hair/i,
      "Stalking": /follow|track|surveil|stalk|monitor|gps|location/i,
      "Litigation abuse": /court|file|motion|attorney|subpoena|litigat|petition|hearing/i,
      "Coercive control": /control|demand|rule|punish|silent treat|gaslight|manipulat/i,
      "Digital monitoring": /phone|messages|spy|app|password|email|social|account/i,
    };
    const categoryCounts: Record<string, number> = {};
    const categoryEvidence: Record<string, string[]> = {};
    for (const i of incidents) {
      const text = `${i.description ?? ""} ${(i.abuse_types ?? []).join(" ")}`.toLowerCase();
      for (const [cat, rx] of Object.entries(CATEGORY_MAP)) {
        if (rx.test(text)) {
          categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
          categoryEvidence[cat] = (categoryEvidence[cat] ?? []).concat(i.id);
        }
      }
    }

    /* ---- coercive control checklist (Stark framework) ---- */
    const checklist = [
      { item: "Isolation from family / friends / support systems", key: "Isolation" },
      { item: "Microregulation of daily life (rules, routines, surveillance)", key: "Coercive control" },
      { item: "Financial deprivation or control", key: "Financial control" },
      { item: "Threats and intimidation", key: "Threats" },
      { item: "Physical violence or assault", key: "Physical violence" },
      { item: "Stalking / surveillance behaviors", key: "Stalking" },
      { item: "Use of legal system as a tactic", key: "Litigation abuse" },
      { item: "Digital monitoring / device control", key: "Digital monitoring" },
    ].map((row) => ({
      ...row,
      documented: (categoryCounts[row.key] ?? 0) > 0,
      count: categoryCounts[row.key] ?? 0,
      incident_ids: categoryEvidence[row.key] ?? [],
    }));

    /* ---- evidence gaps ---- */
    const incidentsWithEvidence = new Set(evidence.map((e) => e.linked_incident_id).filter(Boolean));
    const incidentsWithoutEvidence = incidents.filter((i) => !incidentsWithEvidence.has(i.id));
    const gaps: Array<{ kind: string; detail: string }> = [];
    if (incidentsWithoutEvidence.length > 0) {
      gaps.push({
        kind: "Unsupported incidents",
        detail: `${incidentsWithoutEvidence.length} incident${incidentsWithoutEvidence.length === 1 ? "" : "s"} have no linked evidence file.`,
      });
    }
    for (const row of checklist) {
      if (row.count === 0) {
        gaps.push({ kind: "Missing category", detail: `No documented incidents for: ${row.item}` });
      }
    }
    if ((flags.length ?? 0) === 0 && incidents.length >= 5) {
      gaps.push({ kind: "No escalation flags", detail: "Five+ incidents documented but no escalation flag set. Review high-risk events." });
    }
    const incidentsWithoutSeverity = incidents.filter((i) => i.severity_level == null).length;
    if (incidentsWithoutSeverity > 0) {
      gaps.push({ kind: "Severity unrated", detail: `${incidentsWithoutSeverity} incidents are missing a severity rating.` });
    }

    /* ---- risk score ---- */
    const flagsHigh = flags.filter((f) => (f.severity_tier ?? 0) >= 3 && !f.dismissed_at).length;
    const avgSeverity = incidents.length
      ? incidents.reduce((s, i) => s + (i.severity_level ?? 0), 0) / incidents.length
      : 0;
    const last30 = incidents.filter((i) => {
      const d = new Date(i.date);
      return Date.now() - d.getTime() < 30 * 24 * 60 * 60 * 1000;
    }).length;
    const risk_level: "low" | "moderate" | "elevated" | "high" =
      flagsHigh >= 2 || avgSeverity >= 4 || last30 >= 4 ? "high"
      : flagsHigh >= 1 || avgSeverity >= 3 || last30 >= 2 ? "elevated"
      : incidents.length >= 5 ? "moderate"
      : "low";

    /* ---- escalation timeline buckets ---- */
    const byMonth: Record<string, { count: number; severity: number }> = {};
    for (const i of incidents) {
      const k = i.date?.slice(0, 7) ?? "unknown";
      if (!byMonth[k]) byMonth[k] = { count: 0, severity: 0 };
      byMonth[k].count += 1;
      byMonth[k].severity += i.severity_level ?? 0;
    }
    const timeline = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, count: v.count, avg_severity: v.count ? v.severity / v.count : 0 }));

    return {
      case: caseQ.data ?? null,
      incidents,
      evidence,
      flags,
      voice_notes: voiceQ.data ?? [],
      communications: comsQ.data ?? [],
      legal_documents: legalQ.data ?? [],
      pattern_analysis: pattern,
      categories: Object.entries(categoryCounts).map(([type, count]) => ({ type, count })),
      checklist,
      gaps,
      risk_level,
      avg_severity: avgSeverity,
      last_30_days: last30,
      timeline,
    };
  });

/* ------------------------- deposition prep (AI) ------------------------- */

export const generateDepositionPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAttorney(context.userId);
    await assertLink(context.userId, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: incidents }, { data: evidence }, { data: pattern }] = await Promise.all([
      supabaseAdmin.from("incidents").select("id,date,description,abuse_types,severity_level,witnesses").eq("user_id", data.clientId).order("date"),
      supabaseAdmin.from("evidence").select("id,title,date,file_type,linked_incident_id").eq("user_id", data.clientId),
      supabaseAdmin.from("pattern_analyses").select("analysis").eq("user_id", data.clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (!incidents || incidents.length < 3) {
      return { ok: false as const, reason: "not-enough-data" as const };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false as const, reason: "no-key" as const };

    const prompt = `You are a litigation strategist preparing a domestic-violence / coercive-control case for deposition. Read the survivor's documented incidents and produce a JSON object with these fields:

- chronology_strengths: string[]  — the 3-6 strongest chronological anchors (specific dated patterns that survive cross-examination).
- weak_spots: { issue: string; risk: string; suggested_fix: string }[]  — places opposing counsel will attack (gaps, inconsistencies, lone witnesses, undated screenshots, etc.).
- credibility_gaps: { gap: string; address_before_testimony: string }[]  — internal inconsistencies the client should be prepared to address.
- prep_questions: string[]  — 8-12 direct examination questions, ordered, that surface the pattern.
- cross_warnings: string[]  — questions opposing counsel is likely to ask; brief recommended framing.

Be forensic, legal-register, not therapeutic. Return ONLY the JSON object.

INCIDENTS (${incidents.length}):
${incidents.map((i, idx) => `${idx + 1}. ${i.date} — severity ${i.severity_level ?? "n/a"} — ${(i.abuse_types ?? []).join(", ")} — witnesses: ${i.witnesses ?? "none"} — ${i.description}`).join("\n")}

EVIDENCE (${(evidence ?? []).length}): ${(evidence ?? []).map((e) => `${e.date} ${e.file_type} "${e.title}" → incident ${e.linked_incident_id ?? "(unlinked)"}`).join("; ")}

EXISTING PATTERN ANALYSIS: ${pattern?.analysis ? JSON.stringify(pattern.analysis).slice(0, 2000) : "none"}
`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) return { ok: false as const, reason: "rate-limit" as const };
    if (resp.status === 402) return { ok: false as const, reason: "credits" as const };
    if (!resp.ok) return { ok: false as const, reason: "error" as const };
    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: AnyJson;
    try { parsed = JSON.parse(content); } catch { return { ok: false as const, reason: "parse" as const }; }
    return { ok: true as const, prep: parsed };
  });

/* ------------------------- messages + doc requests ------------------------- */

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      link_id: z.string().uuid(),
      content: z.string().trim().min(1).max(5000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("attorney_client_links")
      .select("attorney_user_id,client_user_id,status")
      .eq("id", data.link_id)
      .maybeSingle();
    if (!link || link.status !== "active") throw new Error("No active link");
    if (link.attorney_user_id !== context.userId && link.client_user_id !== context.userId) {
      throw new Error("Not a participant");
    }
    const sender_role = link.attorney_user_id === context.userId ? "attorney" : "survivor";
    const { error } = await supabaseAdmin.from("attorney_messages").insert({
      link_id: data.link_id,
      sender_user_id: context.userId,
      sender_role,
      content: data.content,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ link_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("attorney_client_links")
      .select("attorney_user_id,client_user_id")
      .eq("id", data.link_id)
      .maybeSingle();
    if (!link) throw new Error("Link not found");
    if (link.attorney_user_id !== context.userId && link.client_user_id !== context.userId) {
      throw new Error("Not a participant");
    }
    const { data: messages } = await supabaseAdmin
      .from("attorney_messages")
      .select("*")
      .eq("link_id", data.link_id)
      .order("created_at", { ascending: true });
    return { messages: messages ?? [] };
  });

export const createDocRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      clientId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      details: z.string().trim().max(2000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAttorney(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id,status")
      .eq("attorney_user_id", context.userId)
      .eq("client_user_id", data.clientId)
      .maybeSingle();
    if (!link || link.status !== "active") throw new Error("No active link");
    const { error } = await supabaseAdmin.from("attorney_document_requests").insert({
      link_id: link.id,
      attorney_user_id: context.userId,
      client_user_id: data.clientId,
      title: data.title,
      details: data.details ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listDocRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ link_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("attorney_client_links")
      .select("attorney_user_id,client_user_id")
      .eq("id", data.link_id)
      .maybeSingle();
    if (!link) throw new Error("Link not found");
    if (link.attorney_user_id !== context.userId && link.client_user_id !== context.userId) {
      throw new Error("Not a participant");
    }
    const { data: requests } = await supabaseAdmin
      .from("attorney_document_requests")
      .select("*")
      .eq("link_id", data.link_id)
      .order("created_at", { ascending: false });
    return { requests: requests ?? [] };
  });

/* ------------------------- time logging ------------------------- */

export const logTime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      clientId: z.string().uuid(),
      page_path: z.string().max(200).optional(),
      duration_seconds: z.number().int().min(1).max(60 * 60 * 4),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAttorney(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id")
      .eq("attorney_user_id", context.userId)
      .eq("client_user_id", data.clientId)
      .maybeSingle();
    const now = new Date();
    const started = new Date(now.getTime() - data.duration_seconds * 1000);
    await supabaseAdmin.from("attorney_time_logs").insert({
      attorney_user_id: context.userId,
      client_user_id: data.clientId,
      link_id: link?.id ?? null,
      page_path: data.page_path ?? null,
      started_at: started.toISOString(),
      ended_at: now.toISOString(),
      duration_seconds: data.duration_seconds,
    });
    return { ok: true };
  });

export const getTimeSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAttorney(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: logs } = await supabaseAdmin
      .from("attorney_time_logs")
      .select("duration_seconds,started_at,page_path")
      .eq("attorney_user_id", context.userId)
      .eq("client_user_id", data.clientId)
      .order("started_at", { ascending: false });
    const total_seconds = (logs ?? []).reduce((s, r) => s + (r.duration_seconds ?? 0), 0);
    return { logs: logs ?? [], total_seconds };
  });