import { supabase } from "@/integrations/supabase/client";

/**
 * Thin client helper for app emails. Posts to the internal send route with the
 * current user's session token. Returns false instead of throwing so a failed
 * send never blocks the survivor's flow.
 */
export async function sendTransactionalEmail(input: {
  templateName: string;
  recipientEmail: string;
  idempotencyKey?: string;
  templateData?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return false;
    const res = await fetch("/lovable/email/transactional/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { success?: boolean };
    return body.success !== false;
  } catch {
    return false;
  }
}