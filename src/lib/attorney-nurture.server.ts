import { createHash, randomBytes } from "node:crypto";
import { NURTURE_MESSAGES, nextNurtureDate } from "./attorney-nurture";
import { readOfferSettings } from "./attorney-offer.server";
type DB = import("@supabase/supabase-js").SupabaseClient<any>;
const origin = "https://pattern-proof.tech";
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export async function prepareNurtureConfirmation(db: DB, input: { id: string; email: string }) {
  if (!(await readOfferSettings(db)).nurture_enabled || !process.env.MARKETING_POSTAL_ADDRESS)
    return undefined;
  const { data: suppressed, error: suppressionError } = await db
    .from("suppressed_emails")
    .select("email")
    .eq("email", input.email)
    .maybeSingle();
  if (suppressionError || suppressed) return undefined;
  const token = randomBytes(32).toString("hex");
  const { data, error } = await db
    .from("attorney_nurture_enrollments")
    .upsert(
      {
        lead_id: input.id,
        email: input.email,
        consent_at: new Date().toISOString(),
        confirmation_hash: tokenHash(token),
      },
      { onConflict: "email", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error || !data) return undefined;
  return `${origin}/email/attorney-followups?token=${token}`;
}

export async function confirmNurture(db: DB, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token) || !(await readOfferSettings(db)).nurture_enabled) return false;
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("attorney_nurture_enrollments")
    .update({
      confirmed_at: now,
      next_due_at: nextNurtureDate(1, now),
    })
    .eq("confirmation_hash", tokenHash(token))
    .is("confirmed_at", null)
    .is("stopped_at", null)
    .gt("confirmation_expires_at", now)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

/** Called only by the existing authenticated queue processor. No timers in a request. */
export async function enqueueDueAttorneyNurture(db: DB) {
  const settings = await readOfferSettings(db);
  const address = process.env.MARKETING_POSTAL_ADDRESS;
  if (!settings.nurture_enabled || !address) return { queued: 0 };
  const { data: rows, error } = await db.rpc("claim_attorney_nurture_batch");
  if (error) throw new Error("Could not claim follow-up batch");
  let queued = 0;
  for (const row of rows ?? []) {
    const { data: suppressed, error: suppressionError } = await db
      .from("suppressed_emails")
      .select("email")
      .eq("email", row.email)
      .maybeSingle();
    if (suppressionError) continue; // Fail closed; retry after lease expires.
    if (suppressed) {
      await db
        .from("attorney_nurture_enrollments")
        .update({ stopped_at: new Date().toISOString() })
        .eq("id", row.id);
      continue;
    }
    // Stop the sequence once an attorney using this email has an active subscription.
    const { data: profiles, error: profileError } = await db
      .from("attorney_profiles")
      .select("user_id")
      .eq("email", row.email);
    if (profileError) continue;
    if (profiles?.length) {
      const { data: subscriptions, error: subError } = await db
        .from("subscriptions")
        .select("status,current_period_end")
        .in(
          "user_id",
          profiles.map((p: { user_id: string }) => p.user_id),
        )
        .eq("environment", settings.payment_environment)
        .in("status", ["active", "trialing"]);
      if (subError) continue;
      if (
        subscriptions?.some(
          (s: { current_period_end: string | null }) =>
            !s.current_period_end || new Date(s.current_period_end).getTime() > Date.now(),
        )
      ) {
        await db
          .from("attorney_nurture_enrollments")
          .update({ stopped_at: new Date().toISOString() })
          .eq("id", row.id);
        continue;
      }
    }
    const copy = NURTURE_MESSAGES[row.next_step];
    if (!copy) continue;
    const { data: unsub, error: unsubError } = await db
      .from("email_unsubscribe_tokens")
      .select("token,used_at")
      .eq("email", row.email)
      .maybeSingle();
    if (unsubError || !unsub?.token || unsub.used_at) continue;
    const unsubscribeUrl = `${origin}/unsubscribe?token=${unsub.token}`;
    const text = `${copy.body}\n\n${copy.cta}: ${origin}${copy.path}\n\nYou confirmed these four follow-ups after requesting the kit.\nUnsubscribe: ${unsubscribeUrl}\nPatternProof\n${address}`;
    const html = `<h1>${escape(copy.subject)}</h1><p>${escape(copy.body)}</p><p><a href="${origin}${copy.path}">${escape(copy.cta)}</a></p><p>You confirmed these four follow-ups after requesting the kit.</p><p><a href="${unsubscribeUrl}">Unsubscribe</a></p><p>PatternProof<br>${escape(address)}</p>`;
    const key = `attorney-nurture-${row.id}-${row.next_step}`;
    const digest = tokenHash(key);
    const messageId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
    const { error: queueError } = await db.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: row.email,
        from: "PatternProof <noreply@pattern-proof.tech>",
        sender_domain: "notify.pattern-proof.tech",
        subject: copy.subject,
        html,
        text,
        purpose: "marketing",
        label: "attorney-nurture",
        idempotency_key: key,
        unsubscribe_token: unsub.token,
        nurture_id: row.id,
        queued_at: new Date().toISOString(),
      },
    });
    if (queueError) continue;
    const next = row.next_step + 1;
    const { error: updateError } = await db
      .from("attorney_nurture_enrollments")
      .update({
        next_step: next,
        next_due_at: nextNurtureDate(next, row.confirmed_at),
        lease_until: null,
      })
      .eq("id", row.id)
      .eq("next_step", row.next_step);
    if (updateError)
      throw new Error("Could not advance follow-up; stable provider idempotency key retained");
    queued++;
  }
  return { queued };
}
