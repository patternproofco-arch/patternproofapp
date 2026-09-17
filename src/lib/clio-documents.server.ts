/**
 * Server-only: push an already-generated professional-review packet into Clio
 * as a Document on a linked matter.
 *
 * Nothing is generated here. We upload only a packet the attorney already
 * produced in PatternProof, and only for a client who has approved Clio
 * sharing. Clio's upload is a three-step contract: create the document record
 * (which returns a signed PUT target), upload the bytes, then mark the version
 * fully uploaded.
 */
import { getValidClioAccessToken } from "@/lib/clio.server";

const CLIO_API_BASE = "https://app.clio.com/api/v4";

export type PushResult =
  | { ok: true; clio_document_id: string; document_name: string; bytes: number }
  | { ok: false; reason: string };

interface CreatedDocument {
  id: string;
  versionUuid: string | null;
  putUrl: string | null;
  putHeaders: Record<string, string>;
}

async function createClioDocument(
  token: string,
  matterId: string,
  name: string,
): Promise<CreatedDocument> {
  const url = `${CLIO_API_BASE}/documents.json?fields=id,latest_document_version{uuid,put_url,put_headers}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      data: {
        name,
        parent: { id: matterId, type: "Matter" },
        document_version: { fully_uploaded: false },
      },
    }),
  });
  if (!res.ok) {
    console.error("[clio] document create failed with status", res.status);
    throw new Error("Clio wouldn't accept a new document on that matter.");
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
    v.put_headers.forEach((h) => {
      if (h?.name) headers[h.name] = h.value;
    });
  } else if (v.put_headers && typeof v.put_headers === "object") {
    Object.assign(headers, v.put_headers as Record<string, string>);
  }
  return {
    id: d.id != null ? String(d.id) : "",
    versionUuid: v.uuid ?? null,
    putUrl: v.put_url ?? null,
    putHeaders: headers,
  };
}

async function markFullyUploaded(token: string, documentId: string, versionUuid: string) {
  const res = await fetch(
    `${CLIO_API_BASE}/documents/${encodeURIComponent(documentId)}.json?fields=id`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ data: { uuid: versionUuid, fully_uploaded: true } }),
    },
  );
  if (!res.ok) {
    console.error("[clio] document confirm failed with status", res.status);
    throw new Error("Clio received the file but wouldn't finish the upload.");
  }
}

/**
 * Uploads the most recent professional-review packet the attorney generated
 * for this client. Returns a plain reason string on any expected failure.
 */
export async function pushLatestPacketToClio(
  attorneyUserId: string,
  attorneyClientLinkId: string,
): Promise<PushResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: link } = await supabaseAdmin
    .from("attorney_client_links")
    .select("id, client_user_id, status, clio_share_consent")
    .eq("id", attorneyClientLinkId)
    .eq("attorney_user_id", attorneyUserId)
    .maybeSingle();
  if (!link || link.status !== "active")
    return { ok: false, reason: "That case file isn't active for your account." };
  if (!link.clio_share_consent) {
    return { ok: false, reason: "This client hasn't approved Clio sharing. Nothing was sent." };
  }

  const { data: matterLink } = await supabaseAdmin
    .from("clio_matter_links")
    .select("clio_matter_id, clio_matter_display_number")
    .eq("attorney_client_link_id", attorneyClientLinkId)
    .is("unlinked_at", null)
    .maybeSingle();
  if (!matterLink) return { ok: false, reason: "Link this case to a Clio matter first." };

  const token = await getValidClioAccessToken(attorneyUserId);
  if (!token) return { ok: false, reason: "Clio isn't connected. Reconnect and try again." };

  // Only ever send a packet the attorney already generated in PatternProof.
  const prefix = `professional-review-packet-${link.client_user_id}-`;
  const { data: objects } = await supabaseAdmin.storage
    .from("exports")
    .list(attorneyUserId, { limit: 100, sortBy: { column: "name", order: "desc" } });
  const latest = (objects ?? [])
    .filter((o) => o.name.startsWith(prefix))
    .sort((a, b) => (a.name < b.name ? 1 : -1))[0];
  if (!latest) {
    return {
      ok: false,
      reason:
        "No packet to send yet. Generate the professional-review packet for this client first.",
    };
  }

  const dl = await supabaseAdmin.storage
    .from("exports")
    .download(`${attorneyUserId}/${latest.name}`);
  if (dl.error || !dl.data)
    return { ok: false, reason: "We couldn't read that packet. Try generating it again." };
  const bytes = new Uint8Array(await dl.data.arrayBuffer());

  const { data: logRow } = await supabaseAdmin
    .from("clio_document_exports")
    .insert({
      attorney_user_id: attorneyUserId,
      attorney_client_link_id: attorneyClientLinkId,
      clio_matter_id: matterLink.clio_matter_id,
      document_name: latest.name,
      byte_size: bytes.byteLength,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  const fail = async (reason: string, code: string): Promise<PushResult> => {
    if (logRow?.id) {
      await supabaseAdmin
        .from("clio_document_exports")
        .update({ status: "failed", error_code: code })
        .eq("id", logRow.id);
    }
    return { ok: false, reason };
  };

  try {
    const doc = await createClioDocument(token, matterLink.clio_matter_id, latest.name);
    if (!doc.id || !doc.putUrl || !doc.versionUuid) {
      return await fail("Clio didn't return an upload target for that document.", "no_put_url");
    }

    const put = await fetch(doc.putUrl, { method: "PUT", headers: doc.putHeaders, body: bytes });
    if (!put.ok) {
      console.error("[clio] document bytes upload failed with status", put.status);
      return await fail("Clio didn't accept the file contents.", `put_${put.status}`);
    }

    await markFullyUploaded(token, doc.id, doc.versionUuid);

    if (logRow?.id) {
      await supabaseAdmin
        .from("clio_document_exports")
        .update({
          status: "confirmed",
          clio_document_id: doc.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", logRow.id);
    }

    await supabaseAdmin
      .rpc("record_audit_event", {
        p_user_id: link.client_user_id,
        p_event_type: "clio.document_pushed",
        p_subject_kind: "export",
        p_actor_kind: "attorney",
        p_actor_id: attorneyUserId,
      })
      .then(
        () => undefined,
        (e: unknown) => console.error("[audit] clio push log failed", e),
      );

    return {
      ok: true,
      clio_document_id: doc.id,
      document_name: latest.name,
      bytes: bytes.byteLength,
    };
  } catch (e) {
    return await fail(
      e instanceof Error ? e.message : "We couldn't finish sending that packet to Clio.",
      "exception",
    );
  }
}
