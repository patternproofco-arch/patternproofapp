import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

interface SharedBundle {
  status: "ok" | "not-found" | "revoked" | "expired";
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

export const fetchSharedBundle = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(100) }).parse(input))
  .handler(async ({ data }): Promise<SharedBundle> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: access } = await supabaseAdmin
      .from("attorney_access")
      .select("*")
      .eq("access_token", data.token)
      .maybeSingle();

    if (!access) return { status: "not-found" };
    if (access.revoked_at) return { status: "revoked" };
    if (access.expires_at && new Date(access.expires_at) < new Date()) return { status: "expired" };

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
        ? supabaseAdmin.from("incidents").select("id,date,time,location,description,abuse_types,witnesses,emotional_impact").eq("user_id", userId).in("id", access.shared_incident_ids).order("date", { ascending: true })
        : Promise.resolve({ data: [] }),
      wantEvidence && access.shared_evidence_ids.length
        ? supabaseAdmin.from("evidence").select("id,title,date,description,file_type,linked_incident_id,file_url").eq("user_id", userId).in("id", access.shared_evidence_ids)
        : Promise.resolve({ data: [] }),
      access.include_escalation
        ? supabaseAdmin.from("escalation_flags").select("id,flag_type,severity_tier,details,created_at").eq("user_id", userId).is("dismissed_at", null).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

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
      incidents: (incR.data ?? []) as SharedBundle["incidents"],
      evidence: evWithUrls,
      escalation_flags: (esR.data ?? []) as SharedBundle["escalation_flags"],
    };
  });