import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAttorneyEntitled } from "@/lib/payments.functions";
import type { Workspace } from "@/lib/chronology-workspace.server";

/**
 * Factual chronology, stable exhibit numbers and the unsigned declaration draft.
 * Thin wrappers: access, scope and every rule live in chronology-workspace.server.ts.
 */

export type { Workspace };

const clientId = z.string().uuid();

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Same subscription gate as the case file itself. */
async function entitled(attorneyId: string, client: string) {
  const ent = await isAttorneyEntitled(attorneyId, client);
  if (!ent.entitled) throw new Error("An active attorney subscription is required.");
}

export const getChronologyWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ clientId }).parse(i))
  .handler(async ({ data, context }): Promise<Workspace> => {
    await entitled(context.userId, data.clientId);
    const m = await import("@/lib/chronology-workspace.server");
    return m.getWorkspace(await admin(), context.userId, data.clientId);
  });

export const createExhibitPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ clientId }).parse(i))
  .handler(async ({ data, context }): Promise<Workspace> => {
    await entitled(context.userId, data.clientId);
    const m = await import("@/lib/chronology-workspace.server");
    return m.createPackageVersion(await admin(), context.userId, data.clientId);
  });

export const saveDeclarationDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        clientId,
        expectedVersion: z.number().int().min(0),
        content: z.unknown(),
        notes: z.string().max(20_000),
        acknowledge: z.array(z.string().max(100)).max(5000),
        adoptLatestPackage: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<Workspace> => {
    await entitled(context.userId, data.clientId);
    const m = await import("@/lib/chronology-workspace.server");
    return m.saveDraft(await admin(), context.userId, data);
  });

export const logChronologyExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ clientId, kind: z.enum(["chronology", "declaration_draft"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await entitled(context.userId, data.clientId);
    const m = await import("@/lib/chronology-workspace.server");
    await m.logExport(await admin(), context.userId, data.clientId, data.kind);
    return { ok: true as const };
  });
