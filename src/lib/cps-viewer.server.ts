/**
 * What an approved worker can read: only the exact items a survivor picked, re-checked on every
 * open. If she later marks an item private, deletes it, or her attorney marks a file privileged,
 * it drops out here at once (the grant can only narrow). Every item shown is logged first; if the
 * log cannot be written, nothing is shown. Read-only: there is no download here.
 */
import {
  assertApprovedCpsWorker,
  buildCpsScope,
  isLiveCpsLink,
  logCpsViews,
  CPS_LINK_COLUMNS,
  type CpsLink,
} from "@/lib/cps-access.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type CaseSummary = { linkId: string; email: string | null; caseRef: string | null; expiresAt: string };

export async function listCpsCases(db: Db, workerId: string): Promise<CaseSummary[]> {
  await assertApprovedCpsWorker(db, workerId);
  const { data: links, error } = await db
    .from("cps_client_links")
    .select(CPS_LINK_COLUMNS + ",invitation_id")
    .eq("worker_user_id", workerId)
    .eq("status", "active")
    .is("revoked_at", null);
  if (error) throw new Error("Could not load your cases.");
  const live = ((links ?? []) as Array<CpsLink & { invitation_id: string | null }>).filter(isLiveCpsLink);
  const ids = live.map((l) => l.invitation_id).filter((x): x is string => !!x);
  const { data: invs } = ids.length
    ? await db.from("cps_invitations").select("id,survivor_email").in("id", ids)
    : { data: [] };
  const email = new Map(((invs ?? []) as Array<{ id: string; survivor_email: string }>).map((i) => [i.id, i.survivor_email]));
  return live.map((l) => ({
    linkId: l.id,
    email: (l.invitation_id && email.get(l.invitation_id)) || null,
    caseRef: l.case_ref ?? null,
    expiresAt: l.expires_at,
  }));
}

export type SharedIncident = { id: string; date: string | null; description: string | null; abuseTypes: string[] };
export type SharedFile = { id: string; title: string; date: string | null; fileType: string };
export type CaseView = {
  caseRef: string | null;
  expiresAt: string;
  watermark: string;
  incidents: SharedIncident[];
  files: SharedFile[];
  /** Plain statement shown on screen: previews of the files themselves are not part of this version. */
  note: string;
};

export async function openCpsCase(db: Db, workerId: string, linkId: string, now = Date.now()): Promise<CaseView> {
  await assertApprovedCpsWorker(db, workerId);
  const { data: link } = await db
    .from("cps_client_links")
    .select(CPS_LINK_COLUMNS)
    .eq("id", linkId)
    .eq("worker_user_id", workerId)
    .maybeSingle();
  if (!isLiveCpsLink(link)) throw new Error("No active access");
  const l = link as CpsLink;
  // Re-apply today's rules to the picks. She may have changed her mind since.
  const { scope } = await buildCpsScope(db, l.client_user_id, {
    incidents: Array.isArray(l.scope_incidents) ? l.scope_incidents : [],
    evidence: Array.isArray(l.scope_evidence) ? l.scope_evidence : [],
  });
  const incidents = scope.incidents.length
    ? (
        await db
          .from("incidents")
          .select("id,date,description,abuse_types")
          .eq("user_id", l.client_user_id)
          .in("id", scope.incidents)
          .is("deleted_at", null)
      ).data ?? []
    : [];
  const files = scope.evidence.length
    ? (
        await db
          .from("evidence")
          .select("id,title,date,file_type")
          .eq("user_id", l.client_user_id)
          .in("id", scope.evidence)
          .is("deleted_at", null)
      ).data ?? []
    : [];
  await logCpsViews(db, l, [
    { kind: "packet", id: null },
    ...incidents.map((r: { id: string }) => ({ kind: "incident" as const, id: r.id })),
    ...files.map((r: { id: string }) => ({ kind: "evidence" as const, id: r.id })),
  ]);
  const { data: app } = await db
    .from("cps_access_applications")
    .select("full_name,agency_name")
    .eq("user_id", workerId)
    .maybeSingle();
  return {
    caseRef: l.case_ref ?? null,
    expiresAt: l.expires_at,
    watermark: `${app?.full_name ?? "Viewer"} · ${app?.agency_name ?? ""} · ${new Date(now).toISOString()}`,
    incidents: (incidents as Array<{ id: string; date: string | null; description: string | null; abuse_types: string[] | null }>).map((r) => ({
      id: r.id,
      date: r.date,
      description: r.description,
      abuseTypes: r.abuse_types ?? [],
    })),
    files: (files as Array<{ id: string; title: string; date: string | null; file_type: string }>).map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date,
      fileType: r.file_type,
    })),
    note: "File names and dates are shown. File previews are not part of this version.",
  };
}
