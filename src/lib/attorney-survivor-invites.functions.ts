import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ---------- attorney → survivor invites ---------- */

export const createSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      survivor_email: z.string().email().max(255),
      survivor_name: z.string().trim().max(120).optional().nullable(),
      personal_note: z.string().trim().max(2000).optional().nullable(),
      expires_days: z.number().int().min(1).max(365).default(30),
    }).parse(input),
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
    z.object({
      rows: z.array(z.object({
        // Keep this outer schema permissive so bad rows can be reported in the
        // per-row results instead of failing the whole batch before processing.
        survivor_email: z.string(),
        survivor_name: z.string().optional().nullable(),
        personal_note: z.string().optional().nullable(),
      })).min(1).max(100),
      expires_days: z.number().int().min(1).max(365).default(30),
    }).parse(input),
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
        results.push({
          index: i,
          ok: false,
          email: rawEmail,
          error: parsed.error.issues[0]?.message ?? "Invalid row",
        });
        continue;
      }
      const row = parsed.data;
      if (seenEmails.has(row.survivor_email)) {
        results.push({
          index: i,
          ok: false,
          email: row.survivor_email,
          error: "Duplicate email in this batch",
        });
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
          error: String(error.message).toLowerCase().includes("duplicate")
            ? "Already invited"
            : error.message,
        });
      } else {
        results.push({
          index: i,
          ok: true,
          email: inserted.survivor_email,
          invite_token: inserted.invite_token,
          id: inserted.id,
        });
      }
    }

    return {
      results,
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
    };
  });

export const listSurvivorInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("attorney_survivor_invites")
      .select("id,survivor_email,survivor_name,personal_note,invite_token,status,expires_at,accepted_at,created_at")
      .eq("attorney_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const now = Date.now();
    const invites = (data ?? []).map((i) => ({
      ...i,
      effective_status:
        i.status === "pending" && i.expires_at && new Date(i.expires_at).getTime() < now
          ? ("expired" as const)
          : (i.status as "pending" | "accepted" | "revoked" | "expired"),
    }));
    return { invites };
  });

export const revokeSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("attorney_survivor_invites")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("attorney_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resendSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      expires_days: z.number().int().min(1).max(365).default(30),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expires = new Date(Date.now() + data.expires_days * 86400000).toISOString();
    const { error } = await supabaseAdmin
      .from("attorney_survivor_invites")
      .update({ status: "pending", expires_at: expires })
      .eq("id", data.id)
      .eq("attorney_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- survivor side: peek + accept ---------- */

export const peekSurvivorInvite = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("attorney_survivor_invites")
      .select("id,survivor_email,survivor_name,personal_note,attorney_user_id,status,expires_at")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) return { status: "not-found" as const };
    if (inv.status !== "pending") return { status: inv.status as "accepted" | "revoked" };
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return { status: "expired" as const };
    const { data: prof } = await supabaseAdmin
      .from("attorney_profiles")
      .select("full_name,firm_name")
      .eq("user_id", inv.attorney_user_id)
      .maybeSingle();
    return {
      status: "ok" as const,
      invite: {
        id: inv.id,
        survivor_email: inv.survivor_email,
        survivor_name: inv.survivor_name,
        personal_note: inv.personal_note,
        attorney_name: prof?.full_name ?? null,
        firm_name: prof?.firm_name ?? null,
      },
    };
  });

export const acceptSurvivorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      token: z.string().min(8).max(128),
      scope: z.object({
        include_all_incidents: z.boolean(),
        include_all_evidence: z.boolean(),
        include_patterns: z.boolean(),
        scope_incidents: z.array(z.string().uuid()).max(2000).optional().default([]),
        scope_evidence: z.array(z.string().uuid()).max(2000).optional().default([]),
      }).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("attorney_survivor_invites")
      .select("*")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Invite not found");
    if (inv.status !== "pending") throw new Error("Invite no longer valid");
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) throw new Error("Invite expired");

    const jwtEmail = (context.claims as { email?: string } | undefined)?.email?.toLowerCase();
    if (!jwtEmail || jwtEmail !== String(inv.survivor_email).toLowerCase()) {
      throw new Error("This invite was sent to a different email address.");
    }

    // Apply survivor-chosen share scope, defaulting to "share everything" when
    // the survivor didn't opt into the granular flow.
    const scope = data.scope ?? {
      include_all_incidents: true,
      include_all_evidence: true,
      include_patterns: true,
      scope_incidents: [],
      scope_evidence: [],
    };
    if (!scope.include_all_incidents && (scope.scope_incidents ?? []).length) {
      const { data: ownedIncidents } = await supabaseAdmin
        .from("incidents")
        .select("id")
        .eq("user_id", context.userId)
        .in("id", scope.scope_incidents ?? []);
      if ((ownedIncidents ?? []).length !== (scope.scope_incidents ?? []).length) {
        throw new Error("One or more selected incidents couldn't be shared.");
      }
    }
    if (!scope.include_all_evidence && (scope.scope_evidence ?? []).length) {
      const { data: ownedEvidence } = await supabaseAdmin
        .from("evidence")
        .select("id")
        .eq("user_id", context.userId)
        .in("id", scope.scope_evidence ?? []);
      if ((ownedEvidence ?? []).length !== (scope.scope_evidence ?? []).length) {
        throw new Error("One or more selected evidence files couldn't be shared.");
      }
    }
    const { error: linkErr } = await supabaseAdmin
      .from("attorney_client_links")
      .insert({
        attorney_user_id: inv.attorney_user_id,
        client_user_id: context.userId,
        include_all_incidents: scope.include_all_incidents,
        include_all_evidence: scope.include_all_evidence,
        include_patterns: scope.include_patterns,
        scope_incidents: scope.include_all_incidents ? [] : (scope.scope_incidents ?? []),
        scope_evidence: scope.include_all_evidence ? [] : (scope.scope_evidence ?? []),
        status: "active",
      });
    if (linkErr && !String(linkErr.message).includes("duplicate")) throw new Error(linkErr.message);

    await supabaseAdmin
      .from("attorney_survivor_invites")
      .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: context.userId })
      .eq("id", inv.id);

    return { ok: true };
  });