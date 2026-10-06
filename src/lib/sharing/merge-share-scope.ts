/**
 * Add vs Replace for a second invitation to someone who already has access.
 * Computed at create/preview time so acceptance can simply install the frozen ids.
 */

export type ShareMergeMode = "add" | "replace";

export function mergeShareScopes(
  mode: ShareMergeMode,
  existing: { incidents: string[]; evidence: string[] },
  next: { incidents: string[]; evidence: string[] },
): { incidents: string[]; evidence: string[]; added: { incidents: string[]; evidence: string[] }; removed: { incidents: string[]; evidence: string[] } } {
  const exInc = new Set(existing.incidents);
  const exEv = new Set(existing.evidence);
  const nextInc = new Set(next.incidents);
  const nextEv = new Set(next.evidence);

  if (mode === "replace") {
    return {
      incidents: [...nextInc],
      evidence: [...nextEv],
      added: {
        incidents: [...nextInc].filter((id) => !exInc.has(id)),
        evidence: [...nextEv].filter((id) => !exEv.has(id)),
      },
      removed: {
        incidents: [...exInc].filter((id) => !nextInc.has(id)),
        evidence: [...exEv].filter((id) => !nextEv.has(id)),
      },
    };
  }

  // add: union — previously shared items stay; newly selected items join
  const incidents = new Set([...exInc, ...nextInc]);
  const evidence = new Set([...exEv, ...nextEv]);
  return {
    incidents: [...incidents],
    evidence: [...evidence],
    added: {
      incidents: [...nextInc].filter((id) => !exInc.has(id)),
      evidence: [...nextEv].filter((id) => !exEv.has(id)),
    },
    removed: { incidents: [], evidence: [] },
  };
}

/** Stable fingerprint of a selection so the UI can invalidate a stale preview. */
export function selectionFingerprint(input: {
  include_all_incidents?: boolean;
  include_all_evidence?: boolean;
  scope_incidents?: string[] | null;
  scope_evidence?: string[] | null;
  case_id?: string | null;
  merge_mode?: ShareMergeMode | null;
  existing_link_id?: string | null;
}): string {
  const sort = (ids: string[] | null | undefined) => [...(ids ?? [])].sort().join(",");
  return [
    input.include_all_incidents ? "1" : "0",
    input.include_all_evidence ? "1" : "0",
    sort(input.scope_incidents),
    sort(input.scope_evidence),
    input.case_id ?? "",
    input.merge_mode ?? "",
    input.existing_link_id ?? "",
  ].join("|");
}
