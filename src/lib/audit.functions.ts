import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const logAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        action_type: z.string().min(1).max(80),
        record_reference: z.string().max(200).optional(),
        actor: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ts = new Date().toISOString();
    const actor = data.actor ?? "survivor";
    const ref = data.record_reference ?? "";

    const { data: prev } = await supabase
      .from("audit_log")
      .select("entry_hash")
      .eq("user_id", userId)
      .order("timestamp_utc", { ascending: false })
      .limit(1)
      .maybeSingle();

    const prevHash = prev?.entry_hash ?? "";
    const payload = `${ts}|${data.action_type}|${actor}|${ref}|${prevHash}`;
    const entryHash = createHash("sha256").update(payload).digest("hex");

    const { error } = await supabase.from("audit_log").insert({
      user_id: userId,
      action_type: data.action_type,
      actor,
      record_reference: ref || null,
      timestamp_utc: ts,
      entry_hash: entryHash,
    });
    if (error) console.error("audit_log insert failed", error);
    return { ok: true };
  });
