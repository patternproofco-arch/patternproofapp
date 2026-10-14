import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/*
 * Founder dashboard (/admin) for the attorney requests collected by the
 * earlier public Lovable form (table public.attorney_applications).
 *
 * Merged from the Lovable branch with these changes:
 *  - Every function is signed-in only and checks the admin role on the server
 *    with the service-role client. The browser never decides who is staff.
 *  - The public, unauthenticated submit endpoint was removed. New attorney
 *    requests use main's reviewed /attorney-apply flow
 *    (founder-operations.functions.ts, attorney_access_applications).
 *  - An approval here grants no client access by itself. The invitation sends
 *    the attorney to /attorney-apply, where main's bar-number review
 *    (private.attorney_is_approved) still has to pass before RLS opens anything.
 *  - Nothing here logs emails or names. Errors carry ids or codes only.
 */

const SITE = "https://pattern-proof.tech";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Server-side admin check. Throws for anyone without the admin role. */
export async function assertFounderAdmin(userId: string): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as Db)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("This page is for PatternProof staff.");
  return supabaseAdmin;
}

/** Grant the attorney role to an approved email and send a sign-in invitation. */
async function grantAttorney(admin: Db, email: string): Promise<string> {
  let userId: string | undefined;
  const { data: inv, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${SITE}/attorney-apply`,
  });
  if (!error && inv?.user) userId = inv.user.id;
  if (!userId) {
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      userId = data?.users.find((u: { email?: string }) => u.email?.toLowerCase() === email)?.id;
      if (!data || data.users.length < 1000) break;
    }
  }
  if (!userId)
    throw new Error("We couldn't create that attorney's account. Try again in a moment.");
  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "attorney" }, { onConflict: "user_id,role" });
  if (roleErr) throw new Error("We couldn't save that approval. Try again in a moment.");
  const { notifyNewSignup } = await import("@/lib/signup-notify.server");
  await notifyNewSignup({ userId, role: "attorney" });
  return userId;
}

export const reviewAttorneyApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), decision: z.enum(["approved", "rejected"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertFounderAdmin(context.userId);
    const { data: app } = await admin
      .from("attorney_applications")
      .select("id,email,status")
      .eq("id", data.id)
      .maybeSingle();
    if (!app || app.status !== "pending_review")
      throw new Error("That request was already handled.");
    const invited =
      data.decision === "approved"
        ? await grantAttorney(admin, String(app.email).toLowerCase())
        : null;
    const { error } = await admin
      .from("attorney_applications")
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        invited_user_id: invited,
      })
      .eq("id", data.id);
    if (error) throw new Error("We couldn't save that decision. Try again in a moment.");
    return { ok: true as const };
  });

/** Founder invites an attorney directly. They still complete the bar review. */
export const inviteAttorneyDirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        full_name: z.string().trim().min(1).max(120),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertFounderAdmin(context.userId);
    const email = data.email.toLowerCase();
    const invited = await grantAttorney(admin, email);
    const { error } = await admin.from("attorney_applications").insert({
      email,
      full_name: data.full_name,
      source: "founder_invite",
      status: "approved",
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
      invited_user_id: invited,
    });
    if (error) throw new Error("The invitation went out, but we couldn't record it here.");
    return { ok: true as const };
  });

export interface FounderOverview {
  support: {
    id: string;
    name: string | null;
    reply_email: string;
    category: string;
    message: string;
    status: string;
    created_at: string;
  }[];
  applications: {
    id: string;
    email: string;
    full_name: string;
    firm_name: string | null;
    bar_number: string | null;
    jurisdiction: string | null;
    source: string;
    status: string;
    created_at: string;
  }[];
  signups: { email: string; created_at: string; confirmed: boolean; roles: string[] }[];
}

/** Admin-only: recent help requests, attorney requests and new accounts. No survivor content. */
export const getFounderOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FounderOverview> => {
    const admin = await assertFounderAdmin(context.userId);
    const [support, apps, usersRes] = await Promise.all([
      admin
        .from("support_requests")
        .select("id,name,reply_email,category,message,status,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("attorney_applications")
        .select("id,email,full_name,firm_name,bar_number,jurisdiction,source,status,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    const users = (
      (usersRes.data?.users ?? []) as {
        id: string;
        email?: string;
        created_at: string;
        email_confirmed_at?: string;
      }[]
    )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 50);
    const { data: roles } = await admin
      .from("user_roles")
      .select("user_id,role")
      .in(
        "user_id",
        users.map((u) => u.id),
      );
    return {
      support: support.data ?? [],
      applications: apps.data ?? [],
      signups: users.map((u) => ({
        email: u.email ?? "",
        created_at: u.created_at,
        confirmed: !!u.email_confirmed_at,
        roles: ((roles ?? []) as { user_id: string; role: string }[])
          .filter((r) => r.user_id === u.id)
          .map((r) => String(r.role)),
      })),
    };
  });
