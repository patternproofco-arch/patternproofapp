import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAttorneyEntitled } from "@/lib/payments.functions";
import type { JobView, TransferPreview } from "@/lib/clio-transfer.server";

/**
 * Send numbered exhibits to the linked Clio matter, one document per call, so a large
 * binder survives timeouts and a partial failure can be resumed. All rules live in
 * clio-transfer.server.ts.
 */

export type { JobView, TransferPreview };

const linkId = z.string().uuid();
const jobId = z.string().uuid();

// The transfer tables are newer than the generated database types, so this client is untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function admin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function gate(userId: string, link: string) {
  const { assertClioAvailable } = await import("@/lib/clio.server");
  assertClioAvailable();
  const { resolveCallerRole } = await import("@/lib/conflict-check.server");
  const role = await resolveCallerRole(userId);
  if (role !== "attorney" && role !== "collaborator") throw new Error("This area is for attorney accounts.");
  const { data } = await (await admin())
    .from("attorney_client_links")
    .select("client_user_id")
    .eq("id", link)
    .eq("attorney_user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("That case file isn't active for your account.");
  const ent = await isAttorneyEntitled(userId, data.client_user_id as string);
  if (!ent.entitled) throw new Error("An active attorney subscription is required.");
}

async function gateJob(userId: string, job: string) {
  const { data } = await (await admin())
    .from("clio_transfer_jobs")
    .select("link_id")
    .eq("id", job)
    .eq("attorney_user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("That transfer wasn't found.");
  await gate(userId, data.link_id as string);
}

export const previewClioTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ linkId, includeZip: z.boolean() }).parse(i))
  .handler(async ({ data, context }): Promise<TransferPreview> => {
    await gate(context.userId, data.linkId);
    const m = await import("@/lib/clio-transfer.server");
    return m.previewTransfer(await admin(), context.userId, data);
  });

export const startClioTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ linkId, includeZip: z.boolean() }).parse(i))
  .handler(async ({ data, context }): Promise<JobView> => {
    await gate(context.userId, data.linkId);
    const m = await import("@/lib/clio-transfer.server");
    return m.startTransfer(await admin(), context.userId, data);
  });

export const stepClioTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ jobId }).parse(i))
  .handler(async ({ data, context }): Promise<JobView> => {
    await gateJob(context.userId, data.jobId);
    const m = await import("@/lib/clio-transfer.server");
    const { realTransferDeps } = await import("@/lib/clio-transfer.deps.server");
    return m.runStep(await admin(), realTransferDeps(), context.userId, data.jobId);
  });

export const getClioTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ jobId }).parse(i))
  .handler(async ({ data, context }): Promise<JobView> => {
    await gateJob(context.userId, data.jobId);
    const m = await import("@/lib/clio-transfer.server");
    return m.getJob(await admin(), { now: () => new Date() }, context.userId, data.jobId);
  });

export const retryClioTransferItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ jobId, itemId: z.string().uuid(), confirmNotInClio: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await gateJob(context.userId, data.jobId);
    const m = await import("@/lib/clio-transfer.server");
    await m.retryItem(await admin(), context.userId, data);
    return { ok: true as const };
  });

export const resumeClioTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ jobId }).parse(i))
  .handler(async ({ data, context }) => {
    await gateJob(context.userId, data.jobId);
    const m = await import("@/lib/clio-transfer.server");
    await m.resumeJob(await admin(), context.userId, data.jobId);
    return { ok: true as const };
  });
