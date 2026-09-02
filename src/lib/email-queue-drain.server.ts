import { sendLovableEmail } from "@lovable.dev/email-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_RETRIES = 5;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_SEND_DELAY_MS = 200;
const DEFAULT_AUTH_TTL_MINUTES = 15;
const DEFAULT_TRANSACTIONAL_TTL_MINUTES = 60;

// Check if an error is a rate-limit (429) response.
function isRateLimited(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    return (error as { status: number }).status === 429;
  }
  return error instanceof Error && error.message.includes("429");
}

// Check if an error is a forbidden (403) response. Retrying won't help.
function isForbidden(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    return (error as { status: number }).status === 403;
  }
  return error instanceof Error && error.message.includes("403");
}

// Extract Retry-After seconds from a structured EmailAPIError, or default to 60s.
function getRetryAfterSeconds(error: unknown): number {
  if (error && typeof error === "object" && "retryAfterSeconds" in error) {
    return (error as { retryAfterSeconds: number | null }).retryAfterSeconds ?? 60;
  }
  return 60;
}

async function moveToDlq(
  supabase: SupabaseClient<any, any>,
  queue: string,
  msg: { msg_id: number; message: Record<string, unknown> },
  reason: string,
): Promise<void> {
  const payload = msg.message;
  await supabase.from("email_send_log").insert({
    message_id: payload.message_id,
    template_name: (payload.label || queue) as string,
    recipient_email: payload.to,
    status: "dlq",
    error_message: reason,
  });
  const { error } = await supabase.rpc("move_to_dlq", {
    source_queue: queue,
    dlq_name: `${queue}_dlq`,
    message_id: msg.msg_id,
    payload,
  });
  if (error) {
    console.error("Failed to move message to DLQ", { queue, msg_id: msg.msg_id, reason, error });
  }
}

/**
 * Drain up to a batch of pending emails from the auth_emails and
 * transactional_emails queues, sending each via the Lovable email API.
 *
 * Called synchronously right after every enqueue (send.ts, auth/webhook.ts,
 * team-invitations.server.ts) so email delivers immediately rather than
 * waiting on an external scheduler — there is no cron trigger wired up to
 * call this any other way. process.ts exposes the same logic over HTTP as a
 * manually-triggerable retry path for anything left behind by a failed send.
 */
export async function drainEmailQueues(
  supabase: SupabaseClient<any, any>,
  apiKey: string,
  sendUrl?: string,
): Promise<{ processed: number; skipped?: string; stopped?: string }> {
  // 1. Check rate-limit cooldown and read queue config
  const { data: state } = await supabase
    .from("email_send_state")
    .select(
      "retry_after_until, batch_size, send_delay_ms, auth_email_ttl_minutes, transactional_email_ttl_minutes",
    )
    .single();

  if (state?.retry_after_until && new Date(state.retry_after_until) > new Date()) {
    return { processed: 0, skipped: "rate_limited" };
  }

  const batchSize = state?.batch_size ?? DEFAULT_BATCH_SIZE;
  const sendDelayMs = state?.send_delay_ms ?? DEFAULT_SEND_DELAY_MS;
  const ttlMinutes: Record<string, number> = {
    auth_emails: state?.auth_email_ttl_minutes ?? DEFAULT_AUTH_TTL_MINUTES,
    transactional_emails:
      state?.transactional_email_ttl_minutes ?? DEFAULT_TRANSACTIONAL_TTL_MINUTES,
  };

  let totalProcessed = 0;

  // 2. Process auth_emails first (priority), then transactional_emails
  for (const queue of ["auth_emails", "transactional_emails"]) {
    const { data: messages, error: readError } = await supabase.rpc("read_email_batch", {
      queue_name: queue,
      batch_size: batchSize,
      vt: 30,
    });

    if (readError) {
      console.error("Failed to read email batch", { queue, error: readError });
      continue;
    }

    if (!messages?.length) continue;

    // Retry budget is based on real send failures, not pgmq read_ct.
    const messageIds = Array.from(
      new Set(
        messages
          .map((msg: any) =>
            msg?.message?.message_id && typeof msg.message.message_id === "string"
              ? msg.message.message_id
              : null,
          )
          .filter((id: string | null): id is string => Boolean(id)),
      ),
    );
    const failedAttemptsByMessageId = new Map<string, number>();
    if (messageIds.length > 0) {
      const { data: failedRows, error: failedRowsError } = await supabase
        .from("email_send_log")
        .select("message_id")
        .in("message_id", messageIds)
        .eq("status", "failed");

      if (failedRowsError) {
        console.error("Failed to load failed-attempt counters", {
          queue,
          error: failedRowsError,
        });
      } else {
        for (const row of failedRows ?? []) {
          const messageId = row?.message_id;
          if (typeof messageId !== "string" || !messageId) continue;
          failedAttemptsByMessageId.set(
            messageId,
            (failedAttemptsByMessageId.get(messageId) ?? 0) + 1,
          );
        }
      }
    }

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const payload = msg.message;
      const failedAttempts =
        payload?.message_id && typeof payload.message_id === "string"
          ? (failedAttemptsByMessageId.get(payload.message_id) ?? 0)
          : (msg.read_ct ?? 0);

      // Drop expired messages (TTL exceeded).
      const queuedAt = payload.queued_at ?? msg.enqueued_at;
      if (queuedAt) {
        const ageMs = Date.now() - new Date(queuedAt).getTime();
        const maxAgeMs = ttlMinutes[queue] * 60 * 1000;
        if (ageMs > maxAgeMs) {
          console.warn("Email expired (TTL exceeded)", {
            queue,
            msg_id: msg.msg_id,
            queued_at: queuedAt,
            ttl_minutes: ttlMinutes[queue],
          });
          await moveToDlq(supabase, queue, msg, `TTL exceeded (${ttlMinutes[queue]} minutes)`);
          continue;
        }
      }

      // Move to DLQ if max failed send attempts reached.
      if (failedAttempts >= MAX_RETRIES) {
        await moveToDlq(
          supabase,
          queue,
          msg,
          `Max retries (${MAX_RETRIES}) exceeded (attempted ${failedAttempts} times)`,
        );
        continue;
      }

      // Guard: skip if another worker already sent this message (VT expired race)
      if (payload.message_id) {
        const { data: alreadySent } = await supabase
          .from("email_send_log")
          .select("id")
          .eq("message_id", payload.message_id)
          .eq("status", "sent")
          .maybeSingle();

        if (alreadySent) {
          console.warn("Skipping duplicate send (already sent)", {
            queue,
            msg_id: msg.msg_id,
            message_id: payload.message_id,
          });
          const { error: dupDelError } = await supabase.rpc("delete_email", {
            queue_name: queue,
            message_id: msg.msg_id,
          });
          if (dupDelError) {
            console.error("Failed to delete duplicate message from queue", {
              queue,
              msg_id: msg.msg_id,
              error: dupDelError,
            });
          }
          continue;
        }
      }

      try {
        await sendLovableEmail(
          {
            run_id: payload.run_id,
            to: payload.to,
            from: payload.from,
            sender_domain: payload.sender_domain,
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
            purpose: payload.purpose,
            label: payload.label,
            idempotency_key: payload.idempotency_key,
            unsubscribe_token: payload.unsubscribe_token,
            message_id: payload.message_id,
          },
          { apiKey, sendUrl },
        );

        await supabase.from("email_send_log").insert({
          message_id: payload.message_id,
          template_name: payload.label || queue,
          recipient_email: payload.to,
          status: "sent",
        });

        const { error: delError } = await supabase.rpc("delete_email", {
          queue_name: queue,
          message_id: msg.msg_id,
        });
        if (delError) {
          console.error("Failed to delete sent message from queue", {
            queue,
            msg_id: msg.msg_id,
            error: delError,
          });
        }
        totalProcessed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("Email send failed", {
          queue,
          msg_id: msg.msg_id,
          read_ct: msg.read_ct,
          failed_attempts: failedAttempts,
          error: errorMsg,
        });

        if (isRateLimited(error)) {
          await supabase.from("email_send_log").insert({
            message_id: payload.message_id,
            template_name: payload.label || queue,
            recipient_email: payload.to,
            status: "failed",
            error_message: errorMsg.slice(0, 1000),
          });

          const retryAfterSecs = getRetryAfterSeconds(error);
          await supabase
            .from("email_send_state")
            .update({
              retry_after_until: new Date(Date.now() + retryAfterSecs * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", 1);

          // Stop processing — remaining messages stay in queue (VT expires, retried next cycle)
          return { processed: totalProcessed, stopped: "rate_limited" };
        }

        // 403s are permanent configuration or authorization failures for this
        // message, so move straight to DLQ and stop processing the rest of the batch.
        if (isForbidden(error)) {
          await moveToDlq(supabase, queue, msg, errorMsg.slice(0, 1000));
          return { processed: totalProcessed, stopped: "forbidden" };
        }

        await supabase.from("email_send_log").insert({
          message_id: payload.message_id,
          template_name: payload.label || queue,
          recipient_email: payload.to,
          status: "failed",
          error_message: errorMsg.slice(0, 1000),
        });
        if (payload?.message_id && typeof payload.message_id === "string") {
          failedAttemptsByMessageId.set(payload.message_id, failedAttempts + 1);
        }

        // Non-429 errors: message stays invisible until VT expires, then retried
      }

      // Small delay between sends to smooth bursts
      if (i < messages.length - 1) {
        await new Promise((r) => setTimeout(r, sendDelayMs));
      }
    }
  }

  return { processed: totalProcessed };
}
