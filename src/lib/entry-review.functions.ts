import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAttorneyEntitled } from "@/lib/payments.functions";
import type { Queue } from "@/lib/entry-review.server";

/** Attorney review queue. Thin wrappers: every rule lives in entry-review.server.ts. */
export type { Queue };

const clientId = z.string().uuid();
const itemKey = z.string().regex(/^(incident|evidence|request):[\w-]{1,64}$/);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function admin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Same subscription gate as the case file itself. */
async function entitled(attorneyId: string, client: string) {
  const ent = await isAttorneyEntitled(attorneyId, client);
  if (!ent.entitled) throw new Error("An active attorney subscription is required.");
}

export const getReviewQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ clientId }).parse(i))
  .handler(async ({ data, context }): Promise<Queue> => {
    await entitled(context.userId, data.clientId);
    return (await import("@/lib/entry-review.server")).getQueue(await admin(), context.userId, data.clientId);
  });

export const setEntryReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        clientId,
        itemKey,
        status: z.enum(["new", "needs_clarification", "reviewed"]),
        note: z.string().max(5000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await entitled(context.userId, data.clientId);
    await (await import("@/lib/entry-review.server")).setReview(await admin(), context.userId, data);
    return { ok: true as const };
  });

export const askAboutEntryQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ clientId, itemKey, question: z.string().trim().min(1).max(1000) }).parse(i))
  .handler(async ({ data, context }) => {
    await entitled(context.userId, data.clientId);
    return (await import("@/lib/entry-review.server")).askAboutEntry(await admin(), context.userId, data);
  });
