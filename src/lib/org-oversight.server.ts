/**
 * Pure view-building for organization owner/admin oversight.
 *
 * Kept separate from the server function so the privacy rule can be tested
 * directly: organization role never reveals survivor identity or any content.
 * A case label appears only for links where that survivor explicitly switched
 * on organization-level visibility.
 */

export type OversightMember = {
  user_id: string;
  role: string;
  joined_at?: string | null;
};

export type OversightLink = {
  id: string;
  advocate_user_id: string;
  client_user_id: string;
  case_id: string | null;
  status: string;
  created_at: string;
  expires_at?: string | null;
  org_admin_visibility?: boolean | null;
};

export type OversightAdvocate = {
  user_id: string;
  full_name: string | null;
  role: string;
  joined_at: string | null;
  last_activity_at: string | null;
  open_clients: number;
  closed_clients: number;
  clients: Array<{
    link_id: string;
    label: string;
    identified: boolean;
    status: string;
    granted_at: string;
    expires_at: string | null;
  }>;
};

export function visibleCaseIds(links: OversightLink[]): string[] {
  return Array.from(
    new Set(links.filter((l) => l.org_admin_visibility && l.case_id).map((l) => l.case_id!)),
  );
}

export function buildOversightAdvocates(args: {
  members: OversightMember[];
  links: OversightLink[];
  names: Map<string, string | null>;
  caseNames: Map<string, string | null>;
}): OversightAdvocate[] {
  const { members, links, names, caseNames } = args;
  return members.map((m, mi) => {
    const mine = links.filter((l) => l.advocate_user_id === m.user_id);
    const active = mine.filter((l) => l.status === "active");
    const lastActivity = mine
      .map((l) => l.created_at)
      .sort()
      .at(-1);
    return {
      user_id: m.user_id,
      full_name: names.get(m.user_id) ?? null,
      role: m.role,
      joined_at: m.joined_at ?? null,
      last_activity_at: lastActivity ?? null,
      open_clients: active.length,
      closed_clients: mine.length - active.length,
      clients: mine.map((l, i) => {
        const opaque = `Client ${mi + 1}-${i + 1}`;
        return {
          link_id: l.id,
          // Identity/case label ONLY with explicit survivor consent.
          label: l.org_admin_visibility ? (caseNames.get(l.case_id ?? "") ?? opaque) : opaque,
          identified: !!l.org_admin_visibility,
          status: l.status,
          granted_at: l.created_at,
          expires_at: l.expires_at ?? null,
        };
      }),
    };
  });
}
