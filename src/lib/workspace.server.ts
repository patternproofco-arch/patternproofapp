/**
 * Workspace membership helpers (server-only).
 *
 * A "workspace" is a law firm (firms + firm_members) or a DV organization
 * (dv_organizations + org_members). Membership widens READ access to the
 * workspace's own client links only — never across firms or organizations.
 */

export type WorkspaceRole = "owner" | "member";

export interface FirmMembership {
  firm_id: string;
  role: WorkspaceRole;
}
export interface OrgMembership {
  org_id: string;
  role: WorkspaceRole;
}

export async function getFirmMembership(userId: string): Promise<FirmMembership | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("firm_members")
    .select("firm_id,role")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? { firm_id: data.firm_id as string, role: data.role as WorkspaceRole } : null;
}

export async function getOrgMembership(userId: string): Promise<OrgMembership | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("org_members")
    .select("org_id,role")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? { org_id: data.org_id as string, role: data.role as WorkspaceRole } : null;
}

/**
 * Every user in the caller's firm workspace, including the caller.
 * Returns [] when the caller belongs to no firm — callers must therefore never
 * treat an empty result as "no filter".
 */
export async function firmPeerIds(userId: string): Promise<string[]> {
  const membership = await getFirmMembership(userId);
  if (!membership) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("firm_members")
    .select("user_id")
    .eq("firm_id", membership.firm_id);
  return (data ?? []).map((r) => r.user_id as string);
}

/** Every user in the caller's DV organization workspace, including the caller. */
export async function orgPeerIds(userId: string): Promise<string[]> {
  const membership = await getOrgMembership(userId);
  if (!membership) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("org_members")
    .select("user_id")
    .eq("org_id", membership.org_id);
  return (data ?? []).map((r) => r.user_id as string);
}

/** True only when both users sit in the same firm workspace. */
export async function inSameFirmWorkspace(a: string, b: string): Promise<boolean> {
  if (a === b) return true;
  const [ma, mb] = await Promise.all([getFirmMembership(a), getFirmMembership(b)]);
  return !!ma && !!mb && ma.firm_id === mb.firm_id;
}

/** True only when both users sit in the same DV organization workspace. */
export async function inSameOrgWorkspace(a: string, b: string): Promise<boolean> {
  if (a === b) return true;
  const [ma, mb] = await Promise.all([getOrgMembership(a), getOrgMembership(b)]);
  return !!ma && !!mb && ma.org_id === mb.org_id;
}

