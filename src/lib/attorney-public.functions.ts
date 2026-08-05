import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

interface SharedBundle {
  status: "ok" | "not-found" | "revoked" | "expired" | "rate-limited";
  attorney_name?: string;
  attorney_type?: string;
  access_level?: string;
  case_overview?: {
    other_party: string | null;
    relationship_type: string | null;
    case_types: string[];
    jurisdiction: string | null;
    pattern_summary: string | null;
  } | null;
  incidents?: Array<{ id: string; date: string; time: string | null; location: string | null; description: string; abuse_types: string[]; witnesses: string | null; emotional_impact: string | null }>;
  evidence?: Array<{ id: string; title: string; date: string; description: string | null; file_type: string; linked_incident_id: string | null; signed_url: string | null }>;
  escalation_flags?: Array<{ id: string; flag_type: string; severity_tier: number; details: string | null; created_at: string }>;
}

/** One-way hash so raw tokens / IPs are never stored in the access log. */
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function callerIp(): string | null {
  const h = getRequest()?.headers;
  if (!h) return null;
  const fwd = h.get("cf-connecting-ip") || h.get("x-forwarded-for") || h.get("x-real-ip");
  if (!fwd) return null;
  return fwd.split(",")[0]?.trim() || null;
}

/** Attempts allowed per token, and globally per IP, within the rolling window. */
const TOKEN_LIMIT_PER_HOUR = 10;
const IP_LIMIT_PER_HOUR = 30;
const WINDOW_MS = 60 * 60 * 1000;

export const fetchSharedBundle = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(100) }).parse(input))
  .handler(async ({ data }): Promise<SharedBundle> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tokenHash = await sha256(data.token);
    const ip = callerIp();
    const ipHash = ip ? await sha256(ip) : null;
    const userAgent = getRequest()?.headers?.get("user-agent")?.slice(0, 300) ?? null;
    const since = new Date(Date.now() - WINDOW_MS).toISOString();

    const log = async (outcome: SharedBundle["status"]) => {
      try {
        await supabaseAdmin.from("share_link_access_log").insert({
          token_hash: tokenHash,
          ip_hash: ipHash,
          outcome,
          user_agent: userAgent,
        });
      } catch {
        // Never let logging break a legitimate access.
      }
    };

    // Rolling-window throttle: per token, and globally per IP to slow token guessing.
    const [tokenAttempts, ipAttempts] = await Promise.all([
      supabaseAdmin
        .from("share_link_access_log")
        .select("id", { count: "exact", head: true })
        .eq("token_hash", tokenHash)
        .gte("created_at", since),
      ipHash
        ? supabaseAdmin
            .from("share_link_access_log")
            .select("id", { count: "exact", head: true })
            .eq("ip_hash", ipHash)
            .gte("created_at", since)
        : Promise.resolve({ count: 0 }),
    ]);

    if ((tokenAttempts.count ?? 0) >= TOKEN_LIMIT_PER_HOUR || (ipAttempts.count ?? 0) >= IP_LIMIT_PER_HOUR) {
      await log("rate-limited");
      return { status: "rate-limited" };
    }

    const { data: access } = await supabaseAdmin
      .from("attorney_access")
      .select("*")
      .eq("access_token", data.token)
      .maybeSingle();

    if (!access) { await log("not-found"); return { status: "not-found" }; }
    if (access.revoked_at) { await log("revoked"); return { status: "revoked" }; }
    if (access.expires_at && new Date(access.expires_at) < new Date()) { await log("expired"); return { status: "expired" }; }
    await log("ok");

    await supabaseAdmin
      .from("attorney_access")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("id", access.id);

    const userId = access.user_id;
    const level = access.access_level;

    const wantIncidents = level === "full" || level === "incidents_only" || level === "court_packet_only";
    const wantEvidence = level === "full" || level === "evidence_only" || level === "court_packet_only";

    const [caseR, incR, evR, esR] = await Promise.all([
      level === "full" || level === "court_packet_only"
        ? supabaseAdmin.from("cases").select("other_party,relationship_type,case_types,jurisdiction,pattern_summary").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      wantIncidents && access.shared_incident_ids.length
        ? supabaseAdmin.from("incidents").select("id,date,time,location,description,abuse_types,witnesses,emotional_impact,source,confirmed_at").eq("user_id", userId).in("id", access.shared_incident_ids).is("deleted_at", null).order("date", { ascending: true })
        : Promise.resolve({ data: [] }),
      wantEvidence && access.shared_evidence_ids.length
        ? supabaseAdmin.from("evidence").select("id,title,date,description,file_type,linked_incident_id,file_url").eq("user_id", userId).in("id", access.shared_evidence_ids).is("deleted_at", null)
        : Promise.resolve({ data: [] }),
      access.include_escalation
        ? supabaseAdmin.from("escalation_flags").select("id,flag_type,severity_tier,details,created_at").eq("user_id", userId).is("dismissed_at", null).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    // Exclude unconfirmed AI-extracted drafts from public/shared attorney views.
    const incRows = (incR.data ?? []) as Array<{ id: string; date: string; time: string | null; location: string | null; description: string; abuse_types: string[]; witnesses: string | null; emotional_impact: string | null; source?: string | null; confirmed_at?: string | null }>;
    const filteredIncidents = incRows.filter((i) => !(i.source === "ai_extracted" && !i.confirmed_at));

    const evRows = (evR.data ?? []) as Array<{ id: string; title: string; date: string; description: string | null; file_type: string; linked_incident_id: string | null; file_url: string }>;
    const evWithUrls = await Promise.all(evRows.map(async (e) => {
      const { data: signed } = await supabaseAdmin.storage.from("evidence-files").createSignedUrl(e.file_url, 3600);
      return {
        id: e.id, title: e.title, date: e.date, description: e.description, file_type: e.file_type,
        linked_incident_id: e.linked_incident_id, signed_url: signed?.signedUrl ?? null,
      };
    }));

    return {
      status: "ok",
      attorney_name: access.attorney_name,
      attorney_type: access.attorney_type,
      access_level: access.access_level,
      case_overview: caseR.data ?? null,
      incidents: filteredIncidents.map(({ source, confirmed_at, ...rest }) => { void source; void confirmed_at; return rest; }) as SharedBundle["incidents"],
      evidence: evWithUrls,
      escalation_flags: (esR.data ?? []) as SharedBundle["escalation_flags"],
    };
  });