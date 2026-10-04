/**
 * Chronology + declaration workspace — server logic (admin client passed in so the
 * real rules run in tests).
 *
 * Rules:
 *  - everything starts from assertCaseAccess: an active, in-scope link. Item ids and
 *    content never come from the browser;
 *  - only the columns the chronology needs are read (no storage paths, no hashes of
 *    files beyond the change marker input);
 *  - shared items are read in batches and pages, and any failed read throws;
 *  - creating a new exhibit package version is limited to the owning attorney and
 *    attorney/associate collaborators;
 *  - a draft is its author's alone; the survivor's records are never written to.
 */

import { assertCaseAccess, type AttorneyLink } from "@/lib/attorney-access.server";
import { selectAllPages, selectInChunks } from "@/lib/in-chunks.server";
import {
  analyzeDraft,
  buildChronology,
  itemRefs,
  sanitizeDeclaration,
  EMPTY_DECLARATION,
  type ChronologyRow,
  type DeclarationContent,
  type DraftAnalysis,
} from "@/lib/chronology";
import {
  diffAgainstPackage,
  planNextPackage,
  withdrawnExhibits,
  type ExhibitPackage,
  type PackageDiff,
} from "@/lib/exhibit-numbering";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;
type Row = Record<string, unknown>;

const INCIDENT_COLUMNS =
  "id,title,date,date_precision,date_range_start,date_range_end,anchor_label,time,location,description,witnesses,is_draft,source,confirmed_at,created_at";
const EVIDENCE_COLUMNS =
  "id,title,date,date_precision,date_range_start,date_range_end,description,transcript,extracted_text,transcript_verified_at,extraction_verified_at,sha256,event_at,created_at,linked_incident_id,parent_evidence_id,derivative_kind,review_status";

export const PACKAGE_CONFLICT =
  "Someone on your team just created a newer exhibit package. Reload to see it, then try again.";
export const DRAFT_CONFLICT =
  "This draft was changed somewhere else. Reload to see the latest, then try again.";

export async function loadSharedItems(admin: Admin, link: AttorneyLink, clientId: string) {
  const incidents = link.include_all_incidents
    ? await selectAllPages<Row>(
        (a, b) =>
          admin
            .from("incidents")
            .select(INCIDENT_COLUMNS)
            .eq("user_id", clientId)
            .is("deleted_at", null)
            .order("id", { ascending: true })
            .range(a, b),
        { what: "shared incident" },
      )
    : await selectInChunks<Row>(
        link.scope_incidents ?? [],
        (chunk) =>
          admin
            .from("incidents")
            .select(INCIDENT_COLUMNS)
            .eq("user_id", clientId)
            .in("id", chunk)
            .is("deleted_at", null),
        { what: "shared incident" },
      );
  const evidence = link.include_all_evidence
    ? await selectAllPages<Row>(
        (a, b) =>
          admin
            .from("evidence")
            .select(EVIDENCE_COLUMNS)
            .eq("user_id", clientId)
            .is("deleted_at", null)
            .neq("review_status", "suggested")
            .order("id", { ascending: true })
            .range(a, b),
        { what: "shared file" },
      )
    : await selectInChunks<Row>(
        link.scope_evidence ?? [],
        (chunk) =>
          admin
            .from("evidence")
            .select(EVIDENCE_COLUMNS)
            .eq("user_id", clientId)
            .in("id", chunk)
            .is("deleted_at", null)
            .neq("review_status", "suggested"),
        { what: "shared file" },
      );
  const { data: requests, error } = await admin
    .from("attorney_document_requests")
    .select("id,title,status,submitted_at,response_note")
    .eq("link_id", link.id)
    .eq("client_user_id", clientId)
    .eq("status", "submitted");
  if (error) throw new Error("We couldn't load the answered requests. Nothing was left out silently, so please try again.");

  return {
    // Same rules as the case file, applied again here so a mistake in a query can't widen them:
    // unconfirmed machine-drafted entries and unconfirmed suggested files are never shown.
    incidents: incidents.filter((i) => !(i.source === "ai_extracted" && !i.confirmed_at)),
    evidence: evidence.filter((e) => e.review_status !== "suggested"),
    requests: (requests ?? []) as Row[],
  };
}

async function latestPackage(admin: Admin, linkId: string): Promise<{
  pkg: ExhibitPackage | null;
  createdAt: string | null;
}> {
  const { data, error } = await admin
    .from("attorney_exhibit_packages")
    .select("version,entries,created_at")
    .eq("link_id", linkId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("We couldn't load the exhibit numbers. Try again in a moment.");
  if (!data) return { pkg: null, createdAt: null };
  return {
    pkg: { version: data.version as number, entries: (data.entries ?? []) as ExhibitPackage["entries"] },
    createdAt: (data.created_at as string) ?? null,
  };
}

type DraftRecord = {
  id: string;
  content: Partial<DeclarationContent>;
  attorney_notes: string;
  version: number;
  updated_at: string;
};

async function loadDraft(admin: Admin, linkId: string, userId: string): Promise<DraftRecord | null> {
  const { data, error } = await admin
    .from("attorney_declaration_drafts")
    .select("id,content,attorney_notes,version,updated_at")
    .eq("link_id", linkId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("We couldn't load your draft. Try again in a moment.");
  return (data as DraftRecord | null) ?? null;
}

function normalizeContent(c: Partial<DeclarationContent> | null | undefined): DeclarationContent {
  return {
    ...EMPTY_DECLARATION,
    ...(c ?? {}),
    included: c?.included ?? [],
    declined: c?.declined ?? [],
    overrides: c?.overrides ?? {},
    reviewed: c?.reviewed ?? {},
    added: c?.added ?? [],
    packageVersion: c?.packageVersion ?? null,
  };
}

export type Workspace = {
  linkId: string;
  rows: ChronologyRow[];
  package: {
    version: number;
    createdAt: string | null;
    diff: PackageDiff;
    withdrawn: Array<{ key: string; number: number }>;
  } | null;
  /** What a new package version would change. Present with or without a package. */
  nextPackageDiff: PackageDiff;
  canCreatePackage: boolean;
  draft: {
    content: DeclarationContent;
    notes: string;
    version: number;
    updatedAt: string | null;
  };
  analysis: DraftAnalysis;
};

export async function getWorkspace(admin: Admin, userId: string, clientId: string): Promise<Workspace> {
  const { link, role, collabRole } = await assertCaseAccess(admin, userId, clientId);
  const items = await loadSharedItems(admin, link, clientId);
  const refs = itemRefs(items.incidents, items.evidence, items.requests);
  const { pkg, createdAt } = await latestPackage(admin, link.id);
  const rows = buildChronology(items.incidents, items.evidence, items.requests, pkg);
  const rec = await loadDraft(admin, link.id, userId);
  const content = normalizeContent(rec?.content);
  const diff = diffAgainstPackage(refs, pkg);
  return {
    linkId: link.id,
    rows,
    package: pkg
      ? { version: pkg.version, createdAt, diff, withdrawn: withdrawnExhibits(refs, pkg) }
      : null,
    nextPackageDiff: diff,
    canCreatePackage: role === "owner" || collabRole === "attorney" || collabRole === "associate",
    draft: {
      content,
      notes: rec?.attorney_notes ?? "",
      version: rec?.version ?? 0,
      updatedAt: rec?.updated_at ?? null,
    },
    analysis: analyzeDraft(content, rows, pkg),
  };
}

export async function createPackageVersion(admin: Admin, userId: string, clientId: string): Promise<Workspace> {
  const { link, role, collabRole } = await assertCaseAccess(admin, userId, clientId);
  if (!(role === "owner" || collabRole === "attorney" || collabRole === "associate")) {
    throw new Error("Only the attorney on this matter can set exhibit numbers.");
  }
  const items = await loadSharedItems(admin, link, clientId);
  const refs = itemRefs(items.incidents, items.evidence, items.requests);
  if (!refs.length) throw new Error("Nothing is shared yet, so there is nothing to number.");
  const { pkg } = await latestPackage(admin, link.id);
  const plan = planNextPackage(refs, pkg);
  const { error } = await admin.from("attorney_exhibit_packages").insert({
    link_id: link.id,
    client_user_id: clientId,
    version: plan.version,
    entries: plan.entries,
    created_by: userId,
  });
  if (error) {
    // The (link_id, version) unique key means two people can't both make the same version.
    throw new Error(/duplicate|unique/i.test(error.message) ? PACKAGE_CONFLICT : "We couldn't save the exhibit numbers. Try again in a moment.");
  }
  try {
    await admin.rpc("record_audit_event", {
      p_user_id: clientId,
      p_event_type: "case.exhibit_package_created_by_professional",
      p_subject_kind: "case",
      p_actor_kind: "attorney",
      p_actor_id: userId,
      p_meta: { link_id: link.id, version: plan.version, added: plan.diff.added.length },
    });
  } catch {
    /* audit is best-effort */
  }
  return getWorkspace(admin, userId, clientId);
}

export type SaveInput = {
  clientId: string;
  expectedVersion: number;
  content: unknown;
  notes: string;
  /** Keys whose current text the attorney has now looked at and accepts. */
  acknowledge: string[];
  /** Move the draft onto the newest exhibit package. */
  adoptLatestPackage?: boolean;
};

export async function saveDraft(admin: Admin, userId: string, input: SaveInput): Promise<Workspace> {
  const { link } = await assertCaseAccess(admin, userId, input.clientId);
  const items = await loadSharedItems(admin, link, input.clientId);
  const { pkg } = await latestPackage(admin, link.id);
  const rows = buildChronology(items.incidents, items.evidence, items.requests, pkg);
  const marker = new Map(rows.map((r) => [r.key, r.marker]));

  const rec = await loadDraft(admin, link.id, userId);
  if ((rec?.version ?? 0) !== input.expectedVersion) throw new Error(DRAFT_CONFLICT);

  const prev = normalizeContent(rec?.content);
  const clean = sanitizeDeclaration(input.content);
  const ack = new Set(input.acknowledge);
  const previouslyIncluded = new Set(prev.included);

  // The server, not the browser, records what was reviewed. An item newly included
  // counts as reviewed now; an existing one only if the attorney accepted its changes.
  const reviewed: Record<string, string> = {};
  for (const key of clean.included) {
    const current = marker.get(key);
    const was = prev.reviewed[key];
    if (current && (!previouslyIncluded.has(key) || ack.has(key))) reviewed[key] = current;
    else if (was) reviewed[key] = was;
  }
  // Editing a paragraph is itself a review of the text the attorney was looking at.
  for (const key of Object.keys(clean.overrides)) {
    if (prev.overrides[key] !== clean.overrides[key] && marker.get(key)) reviewed[key] = marker.get(key)!;
  }

  const content: DeclarationContent = {
    ...clean,
    reviewed,
    packageVersion:
      input.adoptLatestPackage || prev.packageVersion === null ? (pkg?.version ?? null) : prev.packageVersion,
  };
  const notes = input.notes.slice(0, 20_000);
  const now = new Date().toISOString();

  if (!rec) {
    const { error } = await admin.from("attorney_declaration_drafts").insert({
      link_id: link.id,
      user_id: userId,
      content,
      attorney_notes: notes,
      version: 1,
    });
    if (error) {
      throw new Error(/duplicate|unique/i.test(error.message) ? DRAFT_CONFLICT : "We couldn't save your draft. Your changes are still on this page. Try again.");
    }
  } else {
    const { data, error } = await admin
      .from("attorney_declaration_drafts")
      .update({ content, attorney_notes: notes, version: rec.version + 1, updated_at: now })
      .eq("id", rec.id)
      .eq("user_id", userId)
      .eq("version", rec.version)
      .select("id")
      .maybeSingle();
    if (error) throw new Error("We couldn't save your draft. Your changes are still on this page. Try again.");
    if (!data) throw new Error(DRAFT_CONFLICT);
  }
  return getWorkspace(admin, userId, input.clientId);
}

/** Provenance: the professional copied the chronology or draft out of PatternProof. */
export async function logExport(
  admin: Admin,
  userId: string,
  clientId: string,
  kind: "chronology" | "declaration_draft",
): Promise<void> {
  const { link } = await assertCaseAccess(admin, userId, clientId);
  try {
    await admin.rpc("record_audit_event", {
      p_user_id: clientId,
      p_event_type:
        kind === "chronology" ? "case.chronology_copied_by_professional" : "case.declaration_draft_copied_by_professional",
      p_subject_kind: "case",
      p_actor_kind: "attorney",
      p_actor_id: userId,
      p_meta: { link_id: link.id },
    });
  } catch {
    /* audit is best-effort */
  }
}
