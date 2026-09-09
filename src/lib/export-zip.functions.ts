import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Builds a comprehensive ZIP export of the account holder's case file:
 *   - manifest.json (export metadata + hashes)
 *   - provenance-and-integrity.md, verify.sh
 *   - narrative.md (plain-text chronology)
 *   - incidents.csv, evidence.csv, communications.csv, voice_notes.csv
 *   - pattern_analysis.json (most recent cached analysis, if any)
 *   - evidence/ (original files + sha256 sidecar), voice-notes/, message-threads/
 *
 * The archive itself is assembled in export-zip.server.ts so it can be built
 * and opened in tests. Here we only upload it to the private `exports` bucket
 * and hand back a link that expires in one hour.
 */
export const generateExportZip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        case_id: z.string().uuid().optional().nullable(),
        include_message_threads: z.boolean().optional(),
      })
      .partial()
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { buildSurvivorExportZip } = await import("@/lib/export-zip.server");

    const built = await buildSurvivorExportZip(supabase, {
      userId,
      caseId: data?.case_id ?? null,
      includeThreads: data?.include_message_threads !== false,
    });
    if (!built.ok) return built;

    const objectPath = `${userId}/${built.fileStem}.zip`;
    const up = await supabase.storage.from("exports").upload(objectPath, built.zipBuf, {
      contentType: "application/zip",
      upsert: false,
    });
    if (up.error) return { ok: false as const, reason: `upload-failed: ${up.error.message}` };

    const signed = await supabase.storage.from("exports").createSignedUrl(objectPath, 60 * 60 * 1);
    if (!signed.data?.signedUrl) return { ok: false as const, reason: "sign-failed" };

    return {
      ok: true as const,
      url: signed.data.signedUrl,
      bytes: built.zipBuf.byteLength,
      filename: `${built.fileStem}.zip`,
      counts: built.counts,
      case_id: built.case_id,
      case_label: built.case_label,
    };
  });
