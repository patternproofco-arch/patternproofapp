import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Court-packet PDF export.
 *
 * The document itself is built in court-packet.server.ts so the real builder
 * can be run in tests. This wrapper only supplies the account's own database
 * client (RLS applies as that account) and hands back a downloadable file.
 *
 * An empty selection is reported as an error instead of a blank download: a
 * packet with nothing in it looked like a broken export.
 */
export const generateCourtPacketPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ case_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ base64: string; filename: string }> => {
    const { buildCasePacket } = await import("@/lib/court-packet.server");
    const packet = await buildCasePacket(context.supabase, {
      caseId: data.case_id,
      userId: context.userId,
    });
    if (packet.counts.exhibits === 0) {
      throw new Error(
        "This case has nothing attached yet. Add at least one record to the case, then build the packet.",
      );
    }
    return {
      base64: Buffer.from(packet.bytes).toString("base64"),
      filename: packet.filename,
    };
  });
