/**
 * Server-only audit trail for Clio integration events.
 *
 * Records connect / disconnect / matter link / matter unlink / export events
 * against the same audit_events table the rest of PatternProof uses. Never
 * records tokens, authorization codes, or survivor record contents — only the
 * shape of the action and non-secret Clio identifiers.
 */
export type ClioAuditEvent =
  | "clio.connected"
  | "clio.disconnected"
  | "clio.revoked_by_provider"
  | "clio.matter_linked"
  | "clio.matter_unlinked";

export async function recordClioAudit(args: {
  /** Whose record the event belongs to (the attorney, unless a client is the subject). */
  userId: string;
  event: ClioAuditEvent;
  actorId: string;
  meta?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("record_audit_event", {
      p_user_id: args.userId,
      p_event_type: args.event,
      p_subject_kind: "clio_connection",
      p_actor_kind: "attorney",
      p_actor_id: args.actorId,
      p_meta: (args.meta ?? {}) as never,
    });
  } catch {
    // An audit write must never break the user-facing operation.
  }
}
