/**
 * The real Clio client, storage and ZIP builder for the transfer engine.
 * Uses the US host only, like the rest of the integration. Clio also runs EU, CA and AU
 * regions, and a token only works against its own region, so accounts there can't use this yet.
 */
import { createHash } from "crypto";
import { getValidClioAccessToken } from "@/lib/clio.server";
import { ClioHttpError, type ClioApi, type TransferDeps } from "@/lib/clio-transfer.server";
import { buildExhibitBinderZip } from "@/lib/binder-zip.server";
import { renderChronologyText, BASIS_LABEL } from "@/lib/chronology";

const CLIO_API_BASE = "https://app.clio.com/api/v4";

function api(token: string, matterId: string): ClioApi {
  return {
    async createDocument(name) {
      const res = await fetch(
        `${CLIO_API_BASE}/documents.json?fields=id,latest_document_version{uuid,put_url,put_headers}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({
            data: { name, parent: { id: matterId, type: "Matter" }, document_version: { fully_uploaded: false } },
          }),
        },
      );
      if (!res.ok) {
        console.error("[clio] document create failed with status", res.status);
        throw new ClioHttpError(res.status, "create failed");
      }
      const json = (await res.json()) as {
        data?: {
          id?: number | string;
          latest_document_version?: {
            uuid?: string;
            put_url?: string;
            put_headers?: Array<{ name: string; value: string }> | Record<string, string>;
          };
        };
      };
      const d = json.data ?? {};
      const v = d.latest_document_version ?? {};
      const headers: Record<string, string> = {};
      if (Array.isArray(v.put_headers)) {
        for (const h of v.put_headers) if (h?.name) headers[h.name] = h.value;
      } else if (v.put_headers && typeof v.put_headers === "object") {
        Object.assign(headers, v.put_headers);
      }
      return {
        id: d.id != null ? String(d.id) : "",
        versionUuid: v.uuid ?? null,
        putUrl: v.put_url ?? null,
        putHeaders: headers,
      };
    },
    async putBytes(target, bytes) {
      const res = await fetch(target.putUrl, { method: "PUT", headers: target.putHeaders, body: Buffer.from(bytes) });
      if (!res.ok) {
        console.error("[clio] document bytes upload failed with status", res.status);
        throw new ClioHttpError(res.status, "put failed");
      }
    },
    async markFullyUploaded(documentId, versionUuid) {
      const res = await fetch(`${CLIO_API_BASE}/documents/${encodeURIComponent(documentId)}.json?fields=id`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ data: { uuid: versionUuid, fully_uploaded: true } }),
      });
      if (!res.ok) {
        console.error("[clio] document confirm failed with status", res.status);
        throw new ClioHttpError(res.status, "confirm failed");
      }
    },
  };
}

export function realTransferDeps(): TransferDeps {
  return {
    getToken: (userId) => getValidClioAccessToken(userId),
    makeApi: api,
    async downloadEvidence(path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin.storage.from("evidence-files").download(path);
      return data ? new Uint8Array(await data.arrayBuffer()) : null;
    },
    async buildZip({ rows, files, packageVersion }) {
      const built = await buildExhibitBinderZip({
        entries: rows.map((r) => ({
          id: r.id,
          kind: r.kind,
          label: BASIS_LABEL[r.basis],
          exhibit: r.exhibit.label,
          date: r.date.sortDate,
          title: r.title,
          body: r.quote,
        })),
        evidenceFiles: files,
        chronologyText: renderChronologyText(rows, { packageVersion }),
        packageVersion,
      });
      return built.zipBuf;
    },
    async sha256(bytes) {
      return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
    },
    now: () => new Date(),
  };
}
