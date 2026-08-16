import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Typed confirmation the survivor must enter, exactly. */
export const DELETE_CONFIRMATION_PHRASE = "DELETE MY ACCOUNT";

/**
 * Child-first delete order. Rows are removed before the auth user so nothing
 * survives a partially-cascading foreign key. Any table missing from the
 * database is skipped; any real failure is reported rather than swallowed, so
 * we never claim a deletion completed when it did not.
 */
const OWNED_TABLES: Array<{ table: string; columns: string[] }> = [
  { table: "thread_message_corrections", columns: ["user_id"] },
  { table: "thread_messages", columns: ["user_id"] },
  { table: "thread_source_documents", columns: ["user_id"] },
  { table: "message_threads", columns: ["user_id"] },
  { table: "attorney_incident_notes", columns: ["client_user_id", "attorney_user_id"] },
  { table: "attorney_evidence_reviews", columns: ["client_user_id", "attorney_user_id"] },
  { table: "attorney_missing_evidence_checklist", columns: ["client_user_id", "attorney_user_id"] },
  { table: "attorney_document_requests", columns: ["client_user_id", "attorney_user_id"] },
  { table: "attorney_time_logs", columns: ["client_user_id", "attorney_user_id"] },
  { table: "time_entries", columns: ["attorney_user_id"] },
  { table: "case_grants", columns: ["attorney_user_id"] },
  { table: "attorney_client_links", columns: ["client_user_id", "attorney_user_id"] },
  { table: "attorney_invitations", columns: ["client_user_id"] },
  { table: "attorney_survivor_invites", columns: ["attorney_user_id"] },
  { table: "attorney_access", columns: ["user_id"] },
  { table: "advocate_client_links", columns: ["client_user_id", "advocate_user_id"] },
  { table: "advocate_invitations", columns: ["client_user_id"] },
  { table: "evidence_classification_suggestions", columns: ["user_id"] },
  { table: "evidence_families", columns: ["user_id"] },
  { table: "import_batches", columns: ["user_id"] },
  { table: "intake_batches", columns: ["user_id"] },
  { table: "escalation_flags", columns: ["user_id"] },
  { table: "pattern_analyses", columns: ["user_id"] },
  { table: "communications", columns: ["user_id"] },
  { table: "recordings", columns: ["user_id"] },
  { table: "voice_notes", columns: ["user_id"] },
  { table: "legal_documents", columns: ["user_id"] },
  { table: "opra_requests", columns: ["user_id"] },
  { table: "court_dates", columns: ["user_id"] },
  { table: "evidence", columns: ["user_id"] },
  { table: "incidents", columns: ["user_id"] },
  { table: "cases", columns: ["user_id"] },
  { table: "agent_messages", columns: ["user_id"] },
  { table: "agent_threads", columns: ["user_id"] },
  { table: "clio_matter_links", columns: ["linked_by"] },
  { table: "clio_connections", columns: ["user_id"] },
  { table: "clio_oauth_states", columns: ["user_id"] },
  { table: "notifications", columns: ["user_id"] },
  { table: "entitlements", columns: ["user_id"] },
  { table: "subscriptions", columns: ["user_id"] },
  { table: "user_referrals", columns: ["user_id"] },
  { table: "user_roles", columns: ["user_id"] },
  { table: "feedback_submissions", columns: ["user_id"] },
  { table: "support_requests", columns: ["user_id"] },
  { table: "audit_events", columns: ["user_id"] },
  { table: "audit_log", columns: ["user_id"] },
  { table: "email_relay_attempts", columns: ["user_id"] },
  { table: "advocate_profiles", columns: ["user_id"] },
  { table: "attorney_profiles", columns: ["user_id"] },
];

const PRIVATE_BUCKETS = [
  "evidence-files",
  "voice-notes",
  "conversation-recordings",
  "message-exports",
  "exports",
];

/** Postgres codes meaning "this table/column simply isn't here" — safe to skip. */
const MISSING_RELATION = new Set(["42P01", "42703", "PGRST205", "PGRST204"]);

/**
 * Permanently deletes the calling user's account.
 *
 * Requires an authenticated session (the user id comes from the verified
 * bearer token, never from client input) and an exact typed confirmation.
 * Storage objects are removed first, then owned rows child-first, then the
 * auth user (which also revokes every session). If any step fails the function
 * returns ok:false with the failures — it never reports a complete deletion it
 * did not perform.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirmation: string }) =>
    z.object({ confirmation: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.confirmation.trim() !== DELETE_CONFIRMATION_PHRASE) {
      return { ok: false as const, reason: "confirmation-mismatch" as const, failures: [] as string[] };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const failures: string[] = [];

    // 1. Private storage objects owned by this user (all files are stored
    //    under a "<userId>/" prefix).
    for (const bucket of PRIVATE_BUCKETS) {
      try {
        const paths: string[] = [];
        const walk = async (prefix: string, depth: number) => {
          if (depth > 4) return;
          const { data: entries, error } = await supabaseAdmin.storage
            .from(bucket)
            .list(prefix, { limit: 1000 });
          if (error) throw error;
          for (const entry of entries ?? []) {
            const full = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.id) paths.push(full);
            else await walk(full, depth + 1);
          }
        };
        await walk(userId, 0);
        for (let i = 0; i < paths.length; i += 100) {
          const { error } = await supabaseAdmin.storage.from(bucket).remove(paths.slice(i, i + 100));
          if (error) throw error;
        }
      } catch (e) {
        failures.push(`storage:${bucket}: ${(e as Error).message}`);
      }
    }

    // 2. Owned database rows, child-first.
    for (const { table, columns } of OWNED_TABLES) {
      for (const column of columns) {
        const { error } = await (supabaseAdmin as unknown as {
          from: (t: string) => {
            delete: () => { eq: (c: string, v: string) => Promise<{ error: { code?: string; message: string } | null }> };
          };
        })
          .from(table)
          .delete()
          .eq(column, userId);
        if (error && !MISSING_RELATION.has(error.code ?? "")) {
          failures.push(`${table}.${column}: ${error.message}`);
        }
      }
    }

    // 3. Delete the auth user itself. This also revokes every active session
    //    and refresh token for the account.
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) failures.push(`auth.user: ${delErr.message}`);

    if (failures.length > 0) {
      return { ok: false as const, reason: "partial" as const, failures };
    }
    return { ok: true as const, failures: [] as string[] };
  });
