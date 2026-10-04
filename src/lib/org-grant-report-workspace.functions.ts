import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ApproveResult, DraftView } from "@/lib/grant-report-workspace.server";

/**
 * Grant report workspace: draft → approve → export → staff-recorded receipt.
 * Thin wrappers. Every rule (owner/admin only, own org only, edits void approval,
 * submitted needs a receipt) lives in grant-report-workspace.server.ts.
 */

export type { ApproveResult, DraftView };

const day = z.string().date();
const id = z.string().uuid();

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listGrantReportDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listDrafts } = await import("@/lib/grant-report-workspace.server");
    return listDrafts(await admin(), context.userId);
  });

export const createGrantReportDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ templateId: z.string().min(1).max(80), from: day, to: day }).parse(i),
  )
  .handler(async ({ data, context }): Promise<DraftView> => {
    const { createDraft } = await import("@/lib/grant-report-workspace.server");
    return createDraft(await admin(), context.userId, data);
  });

export const getGrantReportDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id }).parse(i))
  .handler(async ({ data, context }): Promise<DraftView> => {
    const { getDraft } = await import("@/lib/grant-report-workspace.server");
    return getDraft(await admin(), context.userId, data.id);
  });

export const saveGrantReportDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id,
        expectedVersion: z.number().int().min(1),
        entries: z.record(z.string().max(80), z.unknown()),
        smallCountReviewed: z.array(z.string().max(80)).max(100),
        refreshNumbers: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<DraftView> => {
    const { saveDraft } = await import("@/lib/grant-report-workspace.server");
    return saveDraft(await admin(), context.userId, data);
  });

export const approveGrantReportDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id }).parse(i))
  .handler(async ({ data, context }): Promise<ApproveResult> => {
    const { approveDraft } = await import("@/lib/grant-report-workspace.server");
    return approveDraft(await admin(), context.userId, data.id);
  });

export const recordGrantReportExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id }).parse(i))
  .handler(async ({ data, context }): Promise<DraftView> => {
    const { recordExport } = await import("@/lib/grant-report-workspace.server");
    return recordExport(await admin(), context.userId, data.id);
  });

export const recordGrantReportReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id,
        destination: z.string().min(1).max(200),
        receivedOn: day,
        reference: z.string().max(200).nullish(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<DraftView> => {
    const { recordReceipt } = await import("@/lib/grant-report-workspace.server");
    return recordReceipt(await admin(), context.userId, data);
  });
