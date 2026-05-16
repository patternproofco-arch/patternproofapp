import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

function gatewayHeaders() {
  const lov = process.env.LOVABLE_API_KEY;
  const drive = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lov) throw new Error("missing-lovable-key");
  if (!drive) throw new Error("missing-drive-connection");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": drive,
  } as Record<string, string>;
}

export const listDriveFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      query: z.string().max(120).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const headers = gatewayHeaders();
      const params = new URLSearchParams();
      // Only PDFs and images, not trashed
      const mimeFilter =
        "(mimeType='application/pdf' or mimeType contains 'image/')";
      const nameFilter = data.query ? ` and name contains '${data.query.replace(/'/g, "\\'")}'` : "";
      params.set("q", `trashed=false and ${mimeFilter}${nameFilter}`);
      params.set("pageSize", "30");
      params.set("fields", "files(id,name,mimeType,size,modifiedTime,iconLink)");
      params.set("orderBy", "modifiedTime desc");
      const res = await fetch(`${GATEWAY}/files?${params.toString()}`, { headers });
      if (!res.ok) {
        return { ok: false as const, reason: `drive-${res.status}` };
      }
      const j = await res.json() as { files?: Array<{ id: string; name: string; mimeType: string; size?: string; modifiedTime?: string }> };
      return { ok: true as const, files: j.files ?? [] };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown";
      return { ok: false as const, reason: msg };
    }
  });

export const downloadDriveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      fileId: z.string().min(1).max(120),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const headers = gatewayHeaders();
      // get metadata
      const metaRes = await fetch(`${GATEWAY}/files/${data.fileId}?fields=id,name,mimeType,size`, { headers });
      if (!metaRes.ok) return { ok: false as const, reason: `meta-${metaRes.status}` };
      const meta = await metaRes.json() as { id: string; name: string; mimeType: string; size?: string };
      if (meta.size && Number(meta.size) > 15 * 1024 * 1024) {
        return { ok: false as const, reason: "too-large" };
      }
      const binRes = await fetch(`${GATEWAY}/files/${data.fileId}?alt=media`, { headers });
      if (!binRes.ok) return { ok: false as const, reason: `download-${binRes.status}` };
      const buf = Buffer.from(await binRes.arrayBuffer());
      return {
        ok: true as const,
        filename: meta.name,
        mimeType: meta.mimeType,
        base64: buf.toString("base64"),
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown";
      return { ok: false as const, reason: msg };
    }
  });
