import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FOUNDER_INBOX = "patternproofco@gmail.com";
const SITE = "https://pattern-proof.tech";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function assertAdmin(supabase: Db, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("This page is for PatternProof staff.");
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

async function alertFounder(subject: string, lines: string[], key: string) {
  try {
    const { sendRenderedEmail } = await import("@/lib/email/managed-send.server");
    await sendRenderedEmail({
      to: FOUNDER_INBOX,
      from: "patternproofapp <noreply@pattern-proof.tech>",
      subject,
      html: `<div style="font-family:Georgia,serif">${lines.map((l) => `<p>${esc(l)}</p>`).join("")}</div>`,
      text: lines.join("\n"),
      label: "attorney-application",
      idempotencyKey: key,
    });
  } catch {
    /* never block the applicant */
  }
}

const applySchema = z.object({
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(1).max(120),
  firm_name: z.string().trim().max(200).optional().nullable(),
  bar_number: z.string().trim().max(60).optional().nullable(),
  jurisdiction: z.string().trim().max(120).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

/** Public: an attorney asks for access. Nothing is granted until the founder approves. */
export const submitAttorneyApplication = createServerFn({ method: "POST" })
  .inputValidator((i) => applySchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await supabaseAdmin
      .from("attorney_applications")
      .select("id", { count: "exact", head: true })
      .ilike("email", data.email)
      .gte("created_at", since);
    if ((count ?? 0) >= 3) return { ok: true as const };
    const { data: row, error } = await supabaseAdmin
      .from("attorney_applications")
      .insert({ ...data, email: data.email.toLowerCase() })
      .select("id")
      .single();
    if (error) throw new Error("We couldn't send that. Try again in a moment.");
    await alertFounder(
      "New attorney access request",
      [
        `Name: ${data.full_name}`,
        `Email: ${data.email}`,
        `Firm: ${data.firm_name || "—"}`,
        `Bar / jurisdiction: ${data.bar_number || "—"} / ${data.jurisdiction || "—"}`,
        `Review it at ${SITE}/admin`,
      ],
      `attorney-application-${row.id}`,
    );
    return { ok: true as const };
  });

/** Grant the attorney role to an approved email and send them a sign-in invitation. */
async function grantAttorney(admin: Db, email: string): Promise<string> {
  let userId: string | undefined;
  const { data: inv, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${SITE}/lawyer-signup`,
  });
  if (!error && inv?.user) userId = inv.user.id;
  if (!userId) {
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      userId = data?.users.find((u: { email?: string }) => u.email?.toLowerCase() === email)?.id;
      if (!data || data.users.length < 1000) break;
    }
  }
  if (!userId) throw new Error("We couldn't create that attorney's account. Try again in a moment.");
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
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: app } = await supabaseAdmin
      .from("attorney_applications")
      .select("id,email,status")
      .eq("id", data.id)
      .maybeSingle();
    if (!app || app.status !== "pending_review") throw new Error("That request was already handled.");
    const invited = data.decision === "approved" ? await grantAttorney(supabaseAdmin, app.email) : null;
    await supabaseAdmin
      .from("attorney_applications")
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        invited_user_id: invited,
      })
      .eq("id", data.id);
    return { ok: true as const };
  });

/** Founder invites an attorney directly — no referral link needed. */
export const inviteAttorneyDirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ email: z.string().trim().email().max(255), full_name: z.string().trim().min(1).max(120) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const invited = await grantAttorney(supabaseAdmin, email);
    await supabaseAdmin.from("attorney_applications").insert({
      email,
      full_name: data.full_name,
      source: "founder_invite",
      status: "approved",
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
      invited_user_id: invited,
    });
    return { ok: true as const };
  });

export interface FounderOverview {
  support: { id: string; name: string | null; reply_email: string; category: string; message: string; status: string; created_at: string }[];
  applications: { id: string; email: string; full_name: string; firm_name: string | null; bar_number: string | null; jurisdiction: string | null; source: string; status: string; created_at: string }[];
  signups: { email: string; created_at: string; confirmed: boolean; roles: string[] }[];
}

/** Admin-only: recent help requests, attorney requests and new accounts. No survivor content. */
export const getFounderOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FounderOverview> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [support, apps, usersRes] = await Promise.all([
      supabaseAdmin
        .from("support_requests")
        .select("id,name,reply_email,category,message,status,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("attorney_applications")
        .select("id,email,full_name,firm_name,bar_number,jurisdiction,source,status,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    const users = (usersRes.data?.users ?? [])
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 50);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id,role")
      .in("user_id", users.map((u) => u.id));
    return {
      support: support.data ?? [],
      applications: apps.data ?? [],
      signups: users.map((u) => ({
        email: u.email ?? "",
        created_at: u.created_at,
        confirmed: !!u.email_confirmed_at,
        roles: (roles ?? []).filter((r) => r.user_id === u.id).map((r) => String(r.role)),
      })),
    };
  });
