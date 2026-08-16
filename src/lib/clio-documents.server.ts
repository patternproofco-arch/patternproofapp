/**
 * Server-only: upload a PatternProof-generated packet into a Clio Manage
 * matter using the Clio Documents API (v4, US region).
 *
 * Clio's upload is a three-step handshake:
 *   1. POST /documents.json  -> returns a one-time PUT url + headers
 *   2. PUT bytes to that url (S3-style, no Clio auth header)
 *   3. PATCH /documents/{id}.json with fully_uploaded=true
 * Success is only reported after step 3 is confirmed by Clio.
 */
import { clioApiBase, getValidClioAccessToken } from "@/lib/clio.server";

export class ClioNotConnectedError extends Error {}
export class ClioUploadError extends Error {}

interface DocumentCreateResponse {
  data?: {
    id?: number | string;
    latest_document_version?: {
      uuid?: string;
      put_url?: string;
      put_headers?: Array<{ name: string; value: string }>;
    };
  };
}

export interface ClioUploadResult {
  clioDocumentId: string;
  name: string;
  bytes: number;
}

export async function uploadDocumentToMatter(args: {
  userId: string;
  matterId: string;
  name: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<ClioUploadResult> {
  const token = await getValidClioAccessToken(args.userId);
  if (!token) throw new ClioNotConnectedError("Clio isn't connected. Reconnect Clio and try again.");

  const base = clioApiBase();
  const createRes = await fetch(
    `${base}/documents.json?fields=id,latest_document_version{uuid,put_url,put_headers}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        data: {
          name: args.name,
          parent: { id: Number(args.matterId), type: "Matter" },
          document_version: { fully_uploaded: false },
        },
      }),
    },
  );
  if (!createRes.ok) {
    console.error("[clio] document create failed with status", createRes.status);
    throw new ClioUploadError(uploadMessage(createRes.status));
  }

  const created = (await createRes.json()) as DocumentCreateResponse;
  const docId = created.data?.id != null ? String(created.data.id) : "";
  const version = created.data?.latest_document_version;
  if (!docId || !version?.put_url || !version.uuid) {
    throw new ClioUploadError("Clio didn't return an upload location for that document.");
  }

  const putHeaders: Record<string, string> = { "content-type": args.contentType };
  for (const h of version.put_headers ?? []) putHeaders[h.name] = h.value;
  const putRes = await fetch(version.put_url, {
    method: "PUT",
    headers: putHeaders,
    body: args.bytes as unknown as BodyInit,
  });
  if (!putRes.ok) {
    console.error("[clio] document bytes upload failed with status", putRes.status);
    throw new ClioUploadError("Clio accepted the document record but rejected the file upload. Nothing was filed.");
  }

  const patchRes = await fetch(`${base}/documents/${encodeURIComponent(docId)}.json?fields=id`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ data: { uuid: version.uuid, fully_uploaded: true } }),
  });
  if (!patchRes.ok) {
    console.error("[clio] document finalize failed with status", patchRes.status);
    throw new ClioUploadError("Clio didn't confirm the upload, so we can't say it was filed. Try again.");
  }

  return { clioDocumentId: docId, name: args.name, bytes: args.bytes.byteLength };
}

/** Status -> plain, non-leaking message. Never includes the provider body. */
export function uploadMessage(status: number): string {
  if (status === 401) return "Your Clio session has expired. Reconnect Clio and try again.";
  if (status === 403) return "Clio declined the upload. The connected account may need Documents (write) permission.";
  if (status === 404) return "Clio couldn't find that matter. It may have been moved or deleted.";
  if (status === 429) return "Clio is rate-limiting requests right now. Try again in a minute.";
  return "Clio couldn't accept that document just now. Nothing was filed.";
}
