/**
 * Grant report workspace — server logic (service-role client passed in, so every
 * rule here runs in tests against an in-memory stand-in).
 *
 * Rules enforced here:
 *  - only an org owner/admin, and only for their own org;
 *  - editing an approved/exported draft returns it to draft and clears approval;
 *  - a submitted report is final and cannot be edited;
 *  - 'approved' stores the fingerprint of the exact content and numbers approved;
 *  - 'submitted' only comes from a staff-recorded receipt. There is no code path
 *    here that talks to a funder, so none can claim electronic delivery.
 *  - approved, exported and submitted (submission confirmed by staff) are separate
 *    statuses with separate timestamps; none implies the next;
 *  - the period is read in the report's stored time zone, and "completed" counts
 *    use each follow-up's recorded completion date, never its last-edit date.
 */

import {
  TEMPLATES,
  blockingIssues,
  canTransition,
  contentHash,
  resolveDraft,
  sanitizeEntries,
  validateDraft,
  validateReceipt,
  type Derived,
  type DraftContent,
  type FunderTemplate,
  type Issue,
  type Receipt,
  type ReportStatus,
  type ResolvedRow,
} from "@/lib/grant-report-model";
import {
  deriveGrantMetrics,
  type FollowUpRow,
  type LinkRow,
  type ReferralRow,
} from "@/lib/grant-report-derive";
import { selectAllPages, selectInChunksPaged, ChunkedReadError } from "@/lib/in-chunks.server";
import { DEFAULT_PERIOD_TIMEZONE, isValidTimeZone } from "@/lib/grant-report-period";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type DerivedBlock = { values: Derived; caveats: string[] };

export type DraftRecord = {
  id: string;
  org_id: string;
  template_id: string;
  period_from: string;
  period_to: string;
  period_timezone: string | null;
  content: { entries?: DraftContent["entries"]; small_count_reviewed?: string[] };
  derived: DerivedBlock | Record<string, never>;
  derived_at: string | null;
  status: ReportStatus;
  version: number;
  approved_hash: string | null;
  approved_by: string | null;
  approved_at: string | null;
  exported_at: string | null;
  export_count: number;
  receipt: Receipt | null;
  submitted_at: string | null;
  submitted_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DraftView = {
  id: string;
  org_name: string | null;
  template: Pick<FunderTemplate, "id" | "name" | "description">;
  period_from: string;
  period_to: string;
  period_timezone: string;
  status: ReportStatus;
  version: number;
  rows: ResolvedRow[];
  issues: Issue[];
  caveats: string[];
  entries: DraftContent["entries"];
  small_count_reviewed: string[];
  derived_at: string | null;
  approved_at: string | null;
  approved_hash: string | null;
  exported_at: string | null;
  export_count: number;
  receipt: Receipt | null;
  submitted_at: string | null;
};

const COLUMNS =
  "id,org_id,template_id,period_from,period_to,period_timezone,content,derived,derived_at,status,version,approved_hash,approved_by,approved_at,exported_at,export_count,receipt,submitted_at,submitted_by,created_by,created_at,updated_at";

export const CONFLICT_MESSAGE =
  "This report was changed somewhere else. Reload it to see the latest, then try again.";


export const NOT_SET_UP =
  "Grant reports need a one-time database update that hasn't been applied yet. Ask the PatternProof administrator to apply it. Nothing was lost.";

/** A missing table is a setup problem, not a transient failure. Say which. */
function failure(error: { message?: string; code?: string } | null | undefined, fallback: string): Error {
  const m = `${error?.code ?? ""} ${error?.message ?? ""}`;
  return new Error(/42P01|PGRST205|does not exist|schema cache/i.test(m) ? NOT_SET_UP : fallback);
}

// ---------------------------------------------------------------------------

export async function requireOrgAdmin(admin: Admin, userId: string) {
  const { data: member, error } = await admin
    .from("org_members")
    .select("org_id,role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("We couldn't check your organization. Try again in a moment.");
  if (!member) throw new Error("You are not a verified member of a partner organization.");
  if (member.role !== "owner" && member.role !== "admin") {
    throw new Error("Only an organization owner or administrator can work on grant reports.");
  }
  const { data: org } = await admin
    .from("dv_organizations")
    .select("name")
    .eq("id", member.org_id)
    .maybeSingle();
  return { orgId: member.org_id as string, orgName: (org?.name as string | null) ?? null };
}

function templateFor(id: string): FunderTemplate {
  const t = TEMPLATES[id];
  if (!t) throw new Error("That report template isn't available.");
  return t;
}

const MISSING_COLUMN = /42703|PGRST204|column .*does not exist|could not find .*column/i;

/**
 * Whether org_follow_ups has completed_at yet (added by the
 * 20261006090000 migration). If it doesn't, completions can't be dated, and the
 * completed count is reported as unknown rather than guessed from updated_at.
 * Any other failure throws, like every other read here.
 */
export async function followUpsHaveCompletionDate(admin: Admin, someUserId: string): Promise<boolean> {
  const { error } = await admin
    .from("org_follow_ups")
    .select("id,completed_at")
    .in("org_user_id", [someUserId])
    .order("id", { ascending: true })
    .range(0, 0);
  if (!error) return true;
  const m = `${error.code ?? ""} ${error.message ?? ""}`;
  if (MISSING_COLUMN.test(m) && /completed_at/i.test(m)) return false;
  throw new ChunkedReadError("follow-up", error.message);
}

/**
 * Read the org's records for the period. Every read is chunked and paged and any
 * failure throws: a number is either right or we say we couldn't compute it. It is
 * never quietly low because a long list or page was cut off.
 */
export async function loadDerived(
  admin: Admin,
  orgId: string,
  from: string,
  to: string,
  timeZone: string = DEFAULT_PERIOD_TIMEZONE,
): Promise<DerivedBlock> {
  const members = await selectAllPages<{ user_id: string }>(
    (a, b) =>
      admin
        .from("org_members")
        .select("user_id")
        .eq("org_id", orgId)
        .order("user_id", { ascending: true })
        .range(a, b),
    { what: "team member" },
  );
  const ids = members.map((m) => m.user_id);
  if (!ids.length) throw new Error("Your organization has no members yet.");
  const hasCompletedAt = await followUpsHaveCompletionDate(admin, ids[0]!);
  const followUpColumns = hasCompletedAt
    ? "id,survivor_user_id,status,created_at,updated_at,completed_at"
    : "id,survivor_user_id,status,created_at,updated_at";

  const [links, followUps, referrals] = await Promise.all([
    selectInChunksPaged<LinkRow>(
      ids,
      (chunk, a, b) =>
        admin
          .from("advocate_client_links")
          .select("id,client_user_id,created_at,revoked_at")
          .in("advocate_user_id", chunk)
          .order("id", { ascending: true })
          .range(a, b),
      { what: "sharing record" },
    ),
    selectInChunksPaged<FollowUpRow>(
      ids,
      (chunk, a, b) =>
        admin
          .from("org_follow_ups")
          .select(followUpColumns)
          .in("org_user_id", chunk)
          .order("id", { ascending: true })
          .range(a, b),
      { what: "follow-up" },
    ),
    selectInChunksPaged<ReferralRow>(
      ids,
      (chunk, a, b) =>
        admin
          .from("referral_engagements")
          .select("id,survivor_user_id,created_at")
          .in("org_user_id", chunk)
          .order("id", { ascending: true })
          .range(a, b),
      { what: "referral" },
    ),
  ]);

  const { derived, caveats } = deriveGrantMetrics({
    links,
    followUps,
    referrals,
    from,
    to,
    timeZone,
    completionDates: hasCompletedAt ? "recorded" : "unavailable",
  });
  return { values: derived, caveats };
}

/** Reports made before time zones were stored were read as UTC days. */
function zoneOf(rec: Pick<DraftRecord, "period_timezone">): string {
  return rec.period_timezone && isValidTimeZone(rec.period_timezone) ? rec.period_timezone : DEFAULT_PERIOD_TIMEZONE;
}

function contentOf(rec: DraftRecord): DraftContent {
  return {
    template_id: rec.template_id,
    period_from: rec.period_from,
    period_to: rec.period_to,
    period_timezone: zoneOf(rec),
    entries: rec.content?.entries ?? {},
    small_count_reviewed: rec.content?.small_count_reviewed ?? [],
  };
}

function derivedOf(rec: DraftRecord): DerivedBlock {
  const d = rec.derived as Partial<DerivedBlock> | undefined;
  return { values: d?.values ?? {}, caveats: d?.caveats ?? [] };
}

export function toView(rec: DraftRecord, orgName: string | null): DraftView {
  const template = templateFor(rec.template_id);
  const content = contentOf(rec);
  const derived = derivedOf(rec);
  return {
    id: rec.id,
    org_name: orgName,
    template: { id: template.id, name: template.name, description: template.description },
    period_from: rec.period_from,
    period_to: rec.period_to,
    period_timezone: zoneOf(rec),
    status: rec.status,
    version: rec.version,
    rows: resolveDraft(template, content, derived.values),
    issues: validateDraft(template, content, derived.values),
    caveats: derived.caveats,
    entries: content.entries,
    small_count_reviewed: content.small_count_reviewed,
    derived_at: rec.derived_at,
    approved_at: rec.approved_at,
    approved_hash: rec.approved_hash,
    exported_at: rec.exported_at,
    export_count: rec.export_count,
    receipt: rec.receipt,
    submitted_at: rec.submitted_at,
  };
}

async function loadOwned(admin: Admin, orgId: string, id: string): Promise<DraftRecord> {
  const { data, error } = await admin
    .from("org_grant_report_drafts")
    .select(COLUMNS)
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw failure(error, "We couldn't open that report. Try again in a moment.");
  // Same message for "not yours" and "doesn't exist": no probing other orgs' ids.
  if (!data) throw new Error("That report wasn't found.");
  return data as DraftRecord;
}

async function audit(
  admin: Admin,
  userId: string,
  orgId: string,
  event: string,
  meta: Record<string, unknown>,
) {
  try {
    await admin.rpc("record_audit_event", {
      p_user_id: userId,
      p_event_type: event,
      p_subject_kind: "organization",
      p_subject_id: orgId,
      p_actor_kind: "org_admin",
      p_actor_id: userId,
      p_meta: meta,
    });
  } catch {
    /* audit is best-effort */
  }
}

// ---------------------------------------------------------------------------

export async function listDrafts(admin: Admin, userId: string) {
  const { orgId } = await requireOrgAdmin(admin, userId);
  const { data, error } = await admin
    .from("org_grant_report_drafts")
    .select("id,template_id,period_from,period_to,period_timezone,status,version,updated_at")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });
  if (error) throw failure(error, "We couldn't load your reports. Try again in a moment.");
  return (data ?? []) as Array<{
    id: string;
    template_id: string;
    period_from: string;
    period_to: string;
    period_timezone: string | null;
    status: ReportStatus;
    version: number;
    updated_at: string;
  }>;
}

export async function createDraft(
  admin: Admin,
  userId: string,
  input: { templateId: string; from: string; to: string; timeZone?: string },
): Promise<DraftView> {
  const { orgId, orgName } = await requireOrgAdmin(admin, userId);
  templateFor(input.templateId);
  if (input.from > input.to) throw new Error("The period starts after it ends.");
  const timeZone = input.timeZone ?? DEFAULT_PERIOD_TIMEZONE;
  if (!isValidTimeZone(timeZone)) throw new Error("Choose a valid time zone for the reporting period.");
  const derived = await loadDerived(admin, orgId, input.from, input.to, timeZone);
  const { data, error } = await admin
    .from("org_grant_report_drafts")
    .insert({
      org_id: orgId,
      template_id: input.templateId,
      period_from: input.from,
      period_to: input.to,
      period_timezone: timeZone,
      content: { entries: {}, small_count_reviewed: [] },
      derived,
      derived_at: new Date().toISOString(),
      created_by: userId,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) throw failure(error, "We couldn't start the report. Try again in a moment.");
  return toView(data as DraftRecord, orgName);
}

export async function getDraft(admin: Admin, userId: string, id: string): Promise<DraftView> {
  const { orgId, orgName } = await requireOrgAdmin(admin, userId);
  return toView(await loadOwned(admin, orgId, id), orgName);
}

export async function saveDraft(
  admin: Admin,
  userId: string,
  input: {
    id: string;
    expectedVersion: number;
    entries: Record<string, unknown>;
    smallCountReviewed: string[];
    refreshNumbers?: boolean;
  },
): Promise<DraftView> {
  const { orgId, orgName } = await requireOrgAdmin(admin, userId);
  const rec = await loadOwned(admin, orgId, input.id);
  if (rec.status === "submitted") {
    throw new Error("This report is marked submitted and can't be edited. Start a new draft to change it.");
  }
  if (rec.version !== input.expectedVersion) throw new Error(CONFLICT_MESSAGE);

  const template = templateFor(rec.template_id);
  const entries = sanitizeEntries(template, input.entries);
  const rowIds = new Set(template.rows.map((r) => r.id));
  const reviewed = Array.from(new Set(input.smallCountReviewed.filter((r) => rowIds.has(r)))).sort();

  let derived = derivedOf(rec);
  let derivedAt = rec.derived_at;
  if (input.refreshNumbers) {
    derived = await loadDerived(admin, orgId, rec.period_from, rec.period_to, zoneOf(rec));
    derivedAt = new Date().toISOString();
  }

  const next: DraftContent = {
    template_id: rec.template_id,
    period_from: rec.period_from,
    period_to: rec.period_to,
    period_timezone: zoneOf(rec),
    entries,
    small_count_reviewed: reviewed,
  };
  const before = await contentHash(contentOf(rec), derivedOf(rec).values);
  const after = await contentHash(next, derived.values);
  if (before === after) return toView(rec, orgName);

  // Any change to an approved or exported report voids the approval.
  const { data, error } = await admin
    .from("org_grant_report_drafts")
    .update({
      content: { entries, small_count_reviewed: reviewed },
      derived,
      derived_at: derivedAt,
      status: "draft",
      version: rec.version + 1,
      approved_hash: null,
      approved_by: null,
      approved_at: null,
      exported_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rec.id)
    .eq("org_id", orgId)
    .eq("version", rec.version)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error("We couldn't save your changes. Nothing was lost on this page; try again.");
  if (!data) throw new Error(CONFLICT_MESSAGE);
  return toView(data as DraftRecord, orgName);
}

export type ApproveResult =
  | { ok: true; view: DraftView }
  | { ok: false; issues: Issue[]; view: DraftView };

export async function approveDraft(admin: Admin, userId: string, id: string): Promise<ApproveResult> {
  const { orgId, orgName } = await requireOrgAdmin(admin, userId);
  const rec = await loadOwned(admin, orgId, id);
  if (!canTransition(rec.status, "approved")) {
    throw new Error(
      rec.status === "draft"
        ? "This report can't be approved right now."
        : "This report is already approved. Edit it first if you need to change it.",
    );
  }
  const template = templateFor(rec.template_id);
  // Approve against numbers read right now, so an approved report is never based on stale ones.
  const derived = await loadDerived(admin, orgId, rec.period_from, rec.period_to, zoneOf(rec));
  const content = contentOf(rec);
  const issues = validateDraft(template, content, derived.values);
  const fresh: DraftRecord = { ...rec, derived, derived_at: new Date().toISOString() };
  if (blockingIssues(issues).length) {
    // Keep the fresh numbers on the draft so the screen matches what was checked.
    await admin
      .from("org_grant_report_drafts")
      .update({ derived, derived_at: fresh.derived_at })
      .eq("id", rec.id)
      .eq("org_id", orgId)
      .eq("version", rec.version);
    return { ok: false, issues: blockingIssues(issues), view: toView(fresh, orgName) };
  }
  const hash = await contentHash(content, derived.values);
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("org_grant_report_drafts")
    .update({
      derived,
      derived_at: now,
      status: "approved",
      approved_hash: hash,
      approved_by: userId,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", rec.id)
    .eq("org_id", orgId)
    .eq("version", rec.version)
    .eq("status", "draft")
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error("We couldn't approve the report. Try again in a moment.");
  if (!data) throw new Error(CONFLICT_MESSAGE);
  await audit(admin, userId, orgId, "org_admin.approved_grant_report", {
    report_id: rec.id,
    version: rec.version,
    from: rec.period_from,
    to: rec.period_to,
  });
  return { ok: true, view: toView(data as DraftRecord, orgName) };
}

/**
 * The file itself is built in the browser from this view. What the server records
 * is that an approved version was exported, and only after re-checking that the
 * stored content still matches what was approved.
 */
export async function recordExport(admin: Admin, userId: string, id: string): Promise<DraftView> {
  const { orgId, orgName } = await requireOrgAdmin(admin, userId);
  const rec = await loadOwned(admin, orgId, id);
  if (!canTransition(rec.status, "exported")) {
    throw new Error("Approve the report before exporting it. Drafts can't be exported as final.");
  }
  const hash = await contentHash(contentOf(rec), derivedOf(rec).values);
  if (!rec.approved_hash || hash !== rec.approved_hash) {
    throw new Error("This report no longer matches the version that was approved. Approve it again.");
  }
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("org_grant_report_drafts")
    .update({
      status: "exported",
      exported_at: now,
      export_count: (rec.export_count ?? 0) + 1,
      updated_at: now,
    })
    .eq("id", rec.id)
    .eq("org_id", orgId)
    .eq("version", rec.version)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error("We couldn't record the export. Try again in a moment.");
  if (!data) throw new Error(CONFLICT_MESSAGE);
  await audit(admin, userId, orgId, "org_admin.exported_grant_report", {
    report_id: rec.id,
    version: rec.version,
  });
  return toView(data as DraftRecord, orgName);
}

/** Staff say the funder received it. PatternProof cannot verify that and says so. */
export async function recordReceipt(
  admin: Admin,
  userId: string,
  input: { id: string; destination: string; receivedOn: string; reference?: string | null },
): Promise<DraftView> {
  const { orgId, orgName } = await requireOrgAdmin(admin, userId);
  const rec = await loadOwned(admin, orgId, input.id);
  if (!canTransition(rec.status, "submitted")) {
    throw new Error("Export the approved report before recording that it was submitted.");
  }
  const receipt: Receipt = {
    method: "staff_recorded",
    destination: input.destination.trim().slice(0, 200),
    received_on: input.receivedOn,
    reference: input.reference?.trim().slice(0, 200) || null,
  };
  const problem = validateReceipt(receipt);
  if (problem) throw new Error(problem);
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("org_grant_report_drafts")
    .update({
      status: "submitted",
      receipt,
      submitted_at: now,
      submitted_by: userId,
      updated_at: now,
    })
    .eq("id", rec.id)
    .eq("org_id", orgId)
    .eq("version", rec.version)
    .eq("status", "exported")
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error("We couldn't record the receipt. Try again in a moment.");
  if (!data) throw new Error(CONFLICT_MESSAGE);
  await audit(admin, userId, orgId, "org_admin.recorded_grant_report_receipt", {
    report_id: rec.id,
    version: rec.version,
    destination: receipt.destination,
  });
  return toView(data as DraftRecord, orgName);
}
