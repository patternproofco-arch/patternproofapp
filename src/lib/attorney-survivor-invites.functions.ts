import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ---------- attorney → survivor invites ---------- */

export const createSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        survivor_email: z.string().email().max(255),
        survivor_name: z.string().trim().max(120).optional().nullable(),
        personal_note: z.string().trim().max(2000).optional().nullable(),
        expires_days: z.number().int().min(1).max(365).default(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expires = new Date(Date.now() + data.expires_days * 86400000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("attorney_survivor_invites")
      .insert({
        attorney_user_id: context.userId,
        survivor_email: data.survivor_email.toLowerCase(),
        survivor_name: data.survivor_name ?? null,
        personal_note: data.personal_note ?? null,
        expires_at: expires,
      })
      .select("id,invite_token,expires_at,survivor_email,status,created_at")
      .single();
    if (error) throw new Error(error.message);
    return { invite: row };
  });

/**
 * Bulk version of createSurvivorInvite. Validates each row independently and
 * returns a per-row outcome so the UI can show which rows succeeded or failed
 * without blocking the valid ones. Capped at 100 rows per batch.
 */
export const createSurvivorInvitesBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        rows: z
          .array(
            z.object({
              survivor_email: z.string(),
              survivor_name: z.string().optional().nullable(),
              personal_note: z.string().optional().nullable(),
            }),
          )
          .min(1)
          .max(100),
        expires_days: z.number().int().min(1).max(365).default(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expires = new Date(Date.now() + data.expires_days * 86400000).toISOString();
    type Outcome =
      | { index: number; ok: true; email: string; invite_token: string; id: string }
      | { index: number; ok: false; email: string; error: string };
    const results: Outcome[] = [];
    const rowSchema = z.object({
      survivor_email: z.string().trim().toLowerCase().email().max(255),
      survivor_name: z.string().trim().max(120).optional().nullable(),
      personal_note: z.string().trim().max(2000).optional().nullable(),
    });
    const seenEmails = new Set<string>();
    for (let i = 0; i < data.rows.length; i++) {
      const raw = data.rows[i];
      const rawEmail = String(raw.survivor_email ?? "").trim();
      const parsed = rowSchema.safeParse({
        survivor_email: rawEmail,
        survivor_name: raw.survivor_name ?? null,
        personal_note: raw.personal_note ?? null,
      });
      if (!parsed.success) {
        results.push({ index: i, ok: false, email: rawEmail, error: parsed.error.issues[0]?.message ?? "Invalid row" });
        continue;
      }
      const row = parsed.data;
      if (seenEmails.has(row.survivor_email)) {
        results.push({ index: i, ok: false, email: row.survivor_email, error: "Duplicate email in this batch" });
        continue;
      }
      seenEmails.add(row.survivor_email);
      const { data: inserted, error } = await supabaseAdmin
        .from("attorney_survivor_invites")
        .insert({
          attorney_user_id: context.userId,
          survivor_email: row.survivor_email,
          survivor_name: row.survivor_name ?? null,
          personal_note: row.personal_note ?? null,
          expires_at: expires,
        })
        .select("id,invite_token,survivor_email")
        .single();
      if (error) {
        results.push({
          index: i,
          ok: false,
          email: row.survivor_email,
          error: String(error.message).toLowerCase().includes("duplicate") ? "Already invited" : error.message,
        });
      } else {
        results.push({ index: i, ok: true, email: inserted.survivor_email, invite_token: inserted.invite_token, id: inserted.id });
      }
    }
    return { results, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
  });
