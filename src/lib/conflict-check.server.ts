import { isPossibleNameOverlap, normalizeName } from "@/lib/name-match";

export type ConflictMatch = {
  case_ref: string;
  case_name: string | null;
  other_party: string | null;
  match_type: "exact" | "fuzzy";
  matched_on: "other_party" | "case_name";
};

export function caseRefFor(clientUserId: string): string {
  return `PP-${clientUserId.slice(0, 4).toUpperCase()}`;
}

/** Callers must have an attorney/collaborator role. Mirrors getMyRole. */
export async function resolveCallerRole(userId: string): Promise<"attorney" | "collaborator" | "survivor"> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: rolesData }, { count: collabCount }, { count: grantCount }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin
      .from("case_collaborators")
      .select("id", { count: "exact", head: true })
      .eq("collaborator_user_id", userId)
      .eq("status", "active"),
    supabaseAdmin
      .from("case_grants")
      .select("id", { count: "exact", head: true })
      .eq("attorney_user_id", userId)
      .is("revoked_at", null),
  ]);
  const roles = (rolesData ?? []).map((r) => r.role as string);
  if (roles.includes("attorney")) return "attorney";
  if ((collabCount ?? 0) > 0 || (grantCount ?? 0) > 0) return "collaborator";
  return "survivor";
}

/**
 * Every client_user_id the caller can currently reach: owned active links,
 * plus links reached through active collaborations or non-revoked case grants.
 * Same resolution path as assertLinkAccess in time-entries.functions.ts.
 */
export async function accessibleClientIds(userId: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: owned }, { data: collabs }, { data: grants }] = await Promise.all([
    supabaseAdmin
      .from("attorney_client_links")
      .select("client_user_id")
      .eq("attorney_user_id", userId)
      .eq("status", "active"),
    supabaseAdmin.from("case_collaborators").select("link_id").eq("collaborator_user_id", userId).eq("status", "active"),
    supabaseAdmin.from("case_grants").select("client_link_id").eq("attorney_user_id", userId).is("revoked_at", null),
  ]);
  const ids = new Set<string>((owned ?? []).map((r) => r.client_user_id));
  const linkIds = [
    ...(collabs ?? []).map((r) => r.link_id),
    ...(grants ?? []).map((r) => r.client_link_id),
  ].filter(Boolean) as string[];
  if (linkIds.length) {
    const { data: links } = await supabaseAdmin
      .from("attorney_client_links")
      .select("client_user_id")
      .in("id", linkIds)
      .eq("status", "active");
    for (const l of links ?? []) ids.add(l.client_user_id);
  }
  return [...ids];
}

export async function findConflicts(userId: string, opposingPartyName: string): Promise<ConflictMatch[]> {
  const clientIds = await accessibleClientIds(userId);
  if (!clientIds.length) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin
    .from("cases")
    .select("id,user_id,case_name,other_party")
    .in("user_id", clientIds);
  if (error) throw new Error(error.message);

  const query = normalizeName(opposingPartyName);
  const matches: ConflictMatch[] = [];
  for (const c of rows ?? []) {
    const other = c.other_party ?? "";
    const name = c.case_name ?? "";
    let matchedOn: ConflictMatch["matched_on"] | null = null;
    if (other && isPossibleNameOverlap(opposingPartyName, other)) matchedOn = "other_party";
    else if (name && isPossibleNameOverlap(opposingPartyName, name)) matchedOn = "case_name";
    if (!matchedOn) continue;
    const compared = matchedOn === "other_party" ? other : name;
    matches.push({
      case_ref: caseRefFor(c.user_id),
      case_name: c.case_name,
      other_party: c.other_party,
      match_type: normalizeName(compared) === query ? "exact" : "fuzzy",
      matched_on: matchedOn,
    });
  }
  return matches.sort((a, b) => (a.match_type === b.match_type ? 0 : a.match_type === "exact" ? -1 : 1));
}
