/**
 * What a survivor-side invite acceptance (attorney or advocate) actually shares.
 *
 * ONE function decides it, and both the preview ("your attorney will see N entries")
 * and the real acceptance call it, so the two can never disagree.
 *
 * Two inputs are kept apart on purpose:
 *  - survivorChoice: what SHE selected on the accept screen, in this request.
 *  - invitePrefill: any ids the professional put on the invite. Never authorizing:
 *    a prefilled id that she kept private (or is still deciding about) stays out.
 *
 * Rules:
 *  - "Share all" (include_all_*) takes only items explicitly marked OK to share (NULL is
 *    not OK, fail closed). It ignores every per-item id for that kind, so a
 *    private id can never ride along with "Share all".
 *  - Her own per-item picks authorize those owned, non-deleted items for this invite only,
 *    even if marked Keep private, but only where the screen offers that
 *    (authorizeSurvivorPicks). Otherwise private / undecided picks stay out.
 *  - Nothing outside what she owns and hasn't deleted is ever included.
 */
import { snapshotShareScope, type ExcludedItem } from "@/lib/grant-snapshot.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type SurvivorAcceptChoice = {
  include_all_incidents?: boolean;
  include_all_evidence?: boolean;
  include_patterns?: boolean;
  scope_incidents?: string[] | null;
  scope_evidence?: string[] | null;
};

export type InvitePrefill = {
  scope_incidents?: string[] | null;
  scope_evidence?: string[] | null;
};

export type ResolvedAcceptScope = {
  scope_incidents: string[];
  scope_evidence: string[];
  include_patterns: boolean;
  excluded: ExcludedItem[];
};

function uniq(ids: string[]) {
  return Array.from(new Set(ids));
}

function asIds(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x) : [];
}

/**
 * Ids a professional placed on an invite row, if the row carries any. Today neither
 * invite table has scope columns, so this is normally empty; it exists so that if one
 * is ever added, those ids flow through the non-authorizing path, not as her picks.
 */
export function prefillFromInviteRow(
  row: Record<string, unknown> | null | undefined,
): InvitePrefill {
  return {
    scope_incidents: asIds(row?.scope_incidents),
    scope_evidence: asIds(row?.scope_evidence),
  };
}

export async function resolveInviteAcceptScope(
  admin: Admin,
  survivorId: string,
  input: {
    survivorChoice: SurvivorAcceptChoice;
    invitePrefill?: InvitePrefill;
    /** True only where the accept screen lets her pick a private item "for this invite". */
    authorizeSurvivorPicks: boolean;
  },
): Promise<ResolvedAcceptScope> {
  const choice = input.survivorChoice;
  const allInc = choice.include_all_incidents === true;
  const allEv = choice.include_all_evidence === true;
  const prefill = input.invitePrefill ?? {};

  // 1) Share-all (readiness-filtered) plus prefill ids (readiness-filtered). Never authorizing.
  const broad = await snapshotShareScope(
    admin,
    survivorId,
    {
      include_all_incidents: allInc,
      include_all_evidence: allEv,
      scope_incidents: allInc ? [] : asIds(prefill.scope_incidents),
      scope_evidence: allEv ? [] : asIds(prefill.scope_evidence),
    },
    { authorizeExplicitPicks: false },
  );

  // 2) Her own per-item picks, for kinds where she did NOT choose "Share all".
  const pickInc = allInc ? [] : asIds(choice.scope_incidents);
  const pickEv = allEv ? [] : asIds(choice.scope_evidence);
  let picks = {
    scope_incidents: [] as string[],
    scope_evidence: [] as string[],
    excluded: [] as ExcludedItem[],
  };
  if (pickInc.length || pickEv.length) {
    picks = await snapshotShareScope(
      admin,
      survivorId,
      {
        include_all_incidents: false,
        include_all_evidence: false,
        scope_incidents: pickInc,
        scope_evidence: pickEv,
      },
      { authorizeExplicitPicks: input.authorizeSurvivorPicks },
    );
  }

  const scope_incidents = uniq([...broad.scope_incidents, ...picks.scope_incidents]);
  const scope_evidence = uniq([...broad.scope_evidence, ...picks.scope_evidence]);
  const shared = new Set([
    ...scope_incidents.map((id) => `incident:${id}`),
    ...scope_evidence.map((id) => `file:${id}`),
  ]);
  // A prefill id she also picked herself is not "excluded"; drop duplicates by key.
  const seen = new Set<string>();
  const excluded = [...broad.excluded, ...picks.excluded].filter((x) => {
    const key = `${x.kind}:${x.id}`;
    if (shared.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    scope_incidents,
    scope_evidence,
    include_patterns: choice.include_patterns === true,
    excluded,
  };
}

/** True when she asked for entries or files at all (Share all or any pick). */
export function requestedItems(choice: SurvivorAcceptChoice): boolean {
  return Boolean(
    choice.include_all_incidents ||
    choice.include_all_evidence ||
    asIds(choice.scope_incidents).length ||
    asIds(choice.scope_evidence).length,
  );
}

/**
 * Refuse to accept an invite that would share nothing she asked for. Runs before any
 * link is written or the invite is marked accepted, so she can pick again.
 */
export function assertAcceptWouldShare(
  choice: SurvivorAcceptChoice,
  resolved: ResolvedAcceptScope,
  /** What she can do instead, in this screen's words. */
  hint = "Choose again.",
) {
  const items = resolved.scope_incidents.length + resolved.scope_evidence.length;
  if (items > 0) return;
  if (requestedItems(choice)) {
    throw new Error(
      `None of what you chose can be shared: those items are kept private, still being decided, or no longer available. Nothing was shared yet. ${hint}`,
    );
  }
  if (!resolved.include_patterns) {
    throw new Error("Choose at least one thing to share before accepting.");
  }
}
