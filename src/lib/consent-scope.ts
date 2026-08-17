/**
 * Consent-grant enforcement — single source of truth, pure and testable.
 *
 * Every advocate-facing read of a survivor record must pass through
 * `evaluateGrant` and then the filters below. Nothing here reaches the
 * database, so the rules can be tested exhaustively.
 *
 * Rules that never bend:
 *  - a referral, a link, or an org relationship is not consent;
 *  - an expired, revoked or not-yet-effective grant returns nothing;
 *  - sealed evidence is dropped before any other rule is applied;
 *  - download URLs exist only when the grant says download_allowed.
 */

export interface GrantScope {
  date_start: string | null;
  date_end: string | null;
  /** Incident tag filter. Empty = no topic restriction. */
  topics: string[];
  /** Evidence file-type filter. Empty = no source restriction. */
  source_types: string[];
  /** Explicit allowlists. null = "everything else in scope". */
  incident_ids: string[] | null;
  evidence_ids: string[] | null;
  include_incidents: boolean;
  include_evidence: boolean;
}

export interface GrantLike {
  id?: string;
  survivor_user_id: string;
  recipient_user_id: string;
  status: string;
  effective_at: string;
  expires_at: string | null;
  download_allowed: boolean;
  scope: GrantScope;
}

export type DenyReason =
  | "revoked"
  | "expired"
  | "not_yet_effective"
  | "wrong_recipient"
  | "not_active";

export type GrantEvaluation =
  | { ok: true; grant: GrantLike }
  | { ok: false; reason: DenyReason };

export const DENY_MESSAGE: Record<DenyReason, string> = {
  revoked: "This access was withdrawn. It no longer opens anything.",
  expired: "This access has reached its end date.",
  not_yet_effective: "This access hasn't started yet.",
  wrong_recipient: "This access was granted to a different account.",
  not_active: "This access isn't in force.",
};

export function emptyScope(): GrantScope {
  return {
    date_start: null,
    date_end: null,
    topics: [],
    source_types: [],
    incident_ids: null,
    evidence_ids: null,
    include_incidents: true,
    include_evidence: true,
  };
}

/** Tolerant parse of a jsonb scope column. Unknown shapes fall back to safe defaults. */
export function parseScope(raw: unknown): GrantScope {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const idArr = (v: unknown): string[] | null =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
  const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
  const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);
  return {
    date_start: str(o["date_start"]),
    date_end: str(o["date_end"]),
    topics: strArr(o["topics"]),
    source_types: strArr(o["source_types"]),
    incident_ids: idArr(o["incident_ids"]),
    evidence_ids: idArr(o["evidence_ids"]),
    include_incidents: bool(o["include_incidents"], true),
    include_evidence: bool(o["include_evidence"], true),
  };
}

/** Backend gate. `recipientId` is the caller — never trust a client-supplied one. */
export function evaluateGrant(
  grant: GrantLike | null | undefined,
  recipientId: string,
  now: Date = new Date(),
): GrantEvaluation {
  if (!grant) return { ok: false, reason: "not_active" };
  if (grant.recipient_user_id !== recipientId) return { ok: false, reason: "wrong_recipient" };
  if (grant.status === "revoked") return { ok: false, reason: "revoked" };
  if (grant.status === "expired") return { ok: false, reason: "expired" };
  if (grant.status !== "active") return { ok: false, reason: "not_active" };
  const t = now.getTime();
  if (new Date(grant.effective_at).getTime() > t) return { ok: false, reason: "not_yet_effective" };
  if (grant.expires_at && new Date(grant.expires_at).getTime() <= t) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, grant };
}

type Rec = Record<string, unknown>;

const dateOf = (r: Rec): string | null => (typeof r["date"] === "string" ? (r["date"] as string) : null);

function inWindow(r: Rec, scope: GrantScope): boolean {
  if (!scope.date_start && !scope.date_end) return true;
  const d = dateOf(r);
  if (!d) return false;
  if (scope.date_start && d < scope.date_start) return false;
  if (scope.date_end && d > scope.date_end) return false;
  return true;
}

/** True when this evidence row is sealed by the survivor. */
export function isSealed(r: Rec): boolean {
  return r["is_sealed"] === true;
}

export function filterIncidentsForGrant<T extends Rec>(rows: T[], scope: GrantScope): T[] {
  if (!scope.include_incidents) return [];
  return rows.filter((r) => {
    if (scope.incident_ids && !scope.incident_ids.includes(String(r["id"]))) return false;
    if (!inWindow(r, scope)) return false;
    if (scope.topics.length) {
      const tags = Array.isArray(r["abuse_types"]) ? (r["abuse_types"] as unknown[]).map(String) : [];
      if (!tags.some((t) => scope.topics.includes(t))) return false;
    }
    return true;
  });
}

export function filterEvidenceForGrant<T extends Rec>(rows: T[], scope: GrantScope): T[] {
  if (!scope.include_evidence) return [];
  return rows.filter((r) => {
    // Sealed is a hard block, checked before anything else can let a row through.
    if (isSealed(r)) return false;
    if (scope.evidence_ids && !scope.evidence_ids.includes(String(r["id"]))) return false;
    if (!inWindow(r, scope)) return false;
    if (scope.source_types.length) {
      const ft = typeof r["file_type"] === "string" ? (r["file_type"] as string) : null;
      if (!ft || !scope.source_types.includes(ft)) return false;
    }
    return true;
  });
}

/** A download is only ever possible for an in-scope, unsealed item under a live grant. */
export function canDownloadItem(
  grant: GrantLike,
  evidenceRow: Rec | null,
  recipientId: string,
  now: Date = new Date(),
): boolean {
  if (!evidenceRow) return false;
  if (!grant.download_allowed) return false;
  if (!evaluateGrant(grant, recipientId, now).ok) return false;
  if (isSealed(evidenceRow)) return false;
  return filterEvidenceForGrant([evidenceRow], grant.scope).length === 1;
}

/** Plain-language scope line shown to both sides. No legal conclusions. */
export function describeScope(
  scope: GrantScope,
  downloadAllowed: boolean,
  expiresAt: string | null,
): string {
  const parts: string[] = [];
  const kinds = [
    scope.include_incidents ? "journal entries" : null,
    scope.include_evidence ? "evidence descriptions" : null,
  ].filter(Boolean) as string[];
  parts.push(kinds.length ? kinds.join(" and ") : "nothing yet");

  if (scope.incident_ids || scope.evidence_ids) {
    const n = (scope.incident_ids?.length ?? 0) + (scope.evidence_ids?.length ?? 0);
    parts.push(`limited to ${n} item${n === 1 ? "" : "s"} chosen one by one`);
  }
  if (scope.date_start || scope.date_end) {
    parts.push(
      `dated ${scope.date_start ?? "any time"} to ${scope.date_end ?? "now"}`,
    );
  }
  if (scope.topics.length) parts.push(`tagged ${scope.topics.join(", ")}`);
  if (scope.source_types.length) parts.push(`file types: ${scope.source_types.join(", ")}`);
  parts.push(downloadAllowed ? "files may be downloaded" : "no files, no downloads");
  parts.push(
    expiresAt ? `ends ${new Date(expiresAt).toLocaleDateString()}` : "no end date set",
  );
  return parts.join(" · ");
}
