/**
 * Server-only helpers for the record-request / consent-grant workflow.
 * Never imported by client code — the *.server.ts name blocks it.
 */
import { parseScope, type GrantLike } from "@/lib/consent-scope";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Advocate-only gate. Throws for every other role, including survivors and attorneys. */
export async function advocateClient(userId: string): Promise<Db> {
  const db = await admin();
  const { data: role } = await db
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "advocate").maybeSingle();
  if (!role) throw new Error("This area is for partner organizations.");
  return db;
}

/** Append-only trail. Ids and statuses only — never record content. */
export async function audit(
  db: Db,
  userId: string,
  eventType: string,
  subjectKind: string,
  subjectId: string | null,
  actorKind: string,
  actorId: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await db.from("audit_events").insert({
    user_id: userId,
    event_type: eventType,
    subject_kind: subjectKind,
    subject_id: subjectId,
    actor_kind: actorKind,
    actor_id: actorId,
    meta: meta ?? null,
  });
}

/** Neutral wording only — no record content, no sensitive framing in previews. */
export async function notify(
  db: Db,
  userId: string,
  kind: string,
  title: string,
  body: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.from("notifications").insert({
    user_id: userId, kind, title, body, metadata: metadata ?? null,
  });
}

/** Flip a lapsed grant to "expired" so the stored status matches reality. */
export async function settleExpiry(db: Db, row: Db): Promise<Db> {
  if (row?.status === "active" && row.expires_at && new Date(row.expires_at) <= new Date()) {
    await db.from("consent_grants").update({ status: "expired" }).eq("id", row.id);
    return { ...row, status: "expired" };
  }
  return row;
}

export function toGrant(row: Db): GrantLike {
  return {
    id: row.id,
    survivor_user_id: row.survivor_user_id,
    recipient_user_id: row.recipient_user_id,
    status: row.status,
    effective_at: row.effective_at,
    expires_at: row.expires_at,
    download_allowed: row.download_allowed,
    scope: parseScope(row.scope),
  };
}
