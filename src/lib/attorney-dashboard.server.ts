/**
 * Attorney home-screen aggregation (server-only).
 *
 * Read-only counts over the client links the caller can already see:
 * their own links, links they collaborate on, links granted to them, and —
 * from Phase 3 — links belonging to colleagues in the same firm workspace.
 * No new access is created here; nothing is written.
 */

export interface AttorneyHome {
  profile: { full_name: string | null; firm_name: string | null } | null;
  cases: {
    active: number;
    new_this_month: number;
    new_last_month: number;
    /** Active-case total at the end of each of the last 6 months, oldest first. */
    monthly: number[];
  };
  counts: {
    new_submissions: number;
    evidence_to_review: number;
    clients_with_patterns: number;
    open_document_requests: number;
    unread_messages: number;
  };
  activity: Array<{
    id: string;
    kind: "evidence" | "pattern" | "export" | "request";
    title: string;
    subtitle: string | null;
    timestamp: string;
  }>;
}

const SUBMISSION_WINDOW_DAYS = 14;

function monthKey(d: Date) {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

const shortId = (id: string) => `Client ${id.slice(0, 8)}`;

/** Every active client link the caller may read, de-duplicated. */
async function visibleLinks(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { firmPeerIds } = await import("@/lib/workspace.server");
  const cols = "id,client_user_id,created_at,attorney_user_id";

  const peers = (await firmPeerIds(userId)).filter((id) => id !== userId);

  const [owner, collab, grants, firm] = await Promise.all([
    supabaseAdmin.from("attorney_client_links").select(cols).eq("attorney_user_id", userId).eq("status", "active"),
    supabaseAdmin.from("case_collaborators").select("link_id").eq("collaborator_user_id", userId).eq("status", "active"),
    supabaseAdmin.from("case_grants").select("client_link_id").eq("attorney_user_id", userId).is("revoked_at", null),
    peers.length
      ? supabaseAdmin.from("attorney_client_links").select(cols).in("attorney_user_id", peers).eq("status", "active")
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const sharedIds = Array.from(new Set([
    ...((collab.data ?? []) as Array<{ link_id: string }>).map((r) => r.link_id),
    ...((grants.data ?? []) as Array<{ client_link_id: string }>).map((r) => r.client_link_id),
  ]));
  let shared: Array<Record<string, unknown>> = [];
  if (sharedIds.length) {
    const { data } = await supabaseAdmin
      .from("attorney_client_links").select(cols).in("id", sharedIds).eq("status", "active");
    shared = data ?? [];
  }

  const map = new Map<string, { id: string; client_user_id: string; created_at: string }>();
  for (const row of [...(owner.data ?? []), ...shared, ...(firm.data ?? [])] as Array<{
    id: string; client_user_id: string; created_at: string;
  }>) map.set(row.id, { id: row.id, client_user_id: row.client_user_id, created_at: row.created_at });
  return Array.from(map.values());
}

export async function loadAttorneyHome(userId: string): Promise<AttorneyHome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: profile }, links] = await Promise.all([
    supabaseAdmin.from("attorney_profiles").select("full_name,firm_name").eq("user_id", userId).maybeSingle(),
    visibleLinks(userId),
  ]);

  const clientIds = Array.from(new Set(links.map((l) => l.client_user_id)));
  const linkIds = links.map((l) => l.id);

  // Active-case total at the end of each of the last 6 months.
  const now = new Date();
  const thisKey = monthKey(now);
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const key = thisKey - (5 - i);
    return links.filter((l) => monthKey(new Date(l.created_at)) <= key).length;
  });
  const newThisMonth = links.filter((l) => monthKey(new Date(l.created_at)) === thisKey).length;
  const newLastMonth = links.filter((l) => monthKey(new Date(l.created_at)) === thisKey - 1).length;

  const since = new Date(Date.now() - SUBMISSION_WINDOW_DAYS * 86400000).toISOString();
  const empty = { data: [] as Array<Record<string, unknown>>, count: 0 };

  const [recentEvidence, allEvidence, reviews, patterns, exports_, requests, unread] = await Promise.all([
    clientIds.length
      ? supabaseAdmin.from("evidence").select("id,user_id,title,created_at")
          .in("user_id", clientIds).is("deleted_at", null).eq("is_sealed", false)
          .neq("review_status", "suggested").gte("created_at", since)
          .order("created_at", { ascending: false }).limit(50)
      : Promise.resolve(empty),
    clientIds.length
      ? supabaseAdmin.from("evidence").select("id")
          .in("user_id", clientIds).is("deleted_at", null).eq("is_sealed", false)
          .neq("review_status", "suggested").limit(2000)
      : Promise.resolve(empty),
    supabaseAdmin.from("attorney_evidence_reviews").select("evidence_id").eq("attorney_user_id", userId).limit(2000),
    clientIds.length
      ? supabaseAdmin.from("pattern_analyses").select("id,user_id,created_at")
          .in("user_id", clientIds).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve(empty),
    supabaseAdmin.from("clio_document_exports").select("id,document_name,created_at,status")
      .eq("attorney_user_id", userId).order("created_at", { ascending: false }).limit(10),
    linkIds.length
      ? supabaseAdmin.from("attorney_document_requests").select("id,link_id,title,status,created_at")
          .in("link_id", linkIds).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve(empty),
    linkIds.length
      ? supabaseAdmin.from("attorney_messages").select("id", { count: "exact", head: true })
          .in("link_id", linkIds).is("read_at", null).neq("sender_user_id", userId)
      : Promise.resolve({ count: 0 }),
  ]);

  const reviewed = new Set(((reviews.data ?? []) as Array<{ evidence_id: string }>).map((r) => r.evidence_id));
  const evidenceToReview = ((allEvidence.data ?? []) as Array<{ id: string }>).filter((e) => !reviewed.has(e.id)).length;

  const patternRows = (patterns.data ?? []) as Array<{ id: string; user_id: string; created_at: string }>;
  const evidenceRows = (recentEvidence.data ?? []) as Array<{ id: string; user_id: string; title: string | null; created_at: string }>;
  const exportRows = (exports_.data ?? []) as Array<{ id: string; document_name: string; created_at: string; status: string }>;
  const requestRows = (requests.data ?? []) as Array<{ id: string; link_id: string; title: string; status: string; created_at: string }>;
  const linkClient = new Map(links.map((l) => [l.id, l.client_user_id]));

  const activity: AttorneyHome["activity"] = [
    ...evidenceRows.map((e) => ({
      id: `ev-${e.id}`, kind: "evidence" as const,
      title: "New evidence submitted",
      subtitle: `${shortId(e.user_id)}${e.title ? ` · ${e.title}` : ""}`,
      timestamp: e.created_at,
    })),
    ...patternRows.map((p) => ({
      id: `pa-${p.id}`, kind: "pattern" as const,
      title: "Recurrence summary updated",
      subtitle: shortId(p.user_id),
      timestamp: p.created_at,
    })),
    ...exportRows.map((x) => ({
      id: `ex-${x.id}`, kind: "export" as const,
      title: "Document sent to Clio",
      subtitle: `${x.document_name} · ${x.status}`,
      timestamp: x.created_at,
    })),
    ...requestRows.map((r) => ({
      id: `dr-${r.id}`, kind: "request" as const,
      title: "Document request",
      subtitle: `${r.title} · ${r.status}${linkClient.get(r.link_id) ? ` · ${shortId(linkClient.get(r.link_id)!)}` : ""}`,
      timestamp: r.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  return {
    profile: profile
      ? { full_name: (profile as { full_name: string | null }).full_name, firm_name: (profile as { firm_name: string | null }).firm_name }
      : null,
    cases: { active: links.length, new_this_month: newThisMonth, new_last_month: newLastMonth, monthly },
    counts: {
      new_submissions: evidenceRows.length,
      evidence_to_review: evidenceToReview,
      clients_with_patterns: new Set(patternRows.map((p) => p.user_id)).size,
      open_document_requests: requestRows.filter((r) => r.status === "open").length,
      unread_messages: (unread as { count: number | null }).count ?? 0,
    },
    activity,
  };
}
