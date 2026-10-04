/**
 * Server-only: push PatternProof archives into Clio as Documents on a linked
 * matter.
 *
 * Two paths:
 *  - pushLatestPacketToClio: uploads an already-generated professional-review
 *    packet from storage (nothing is generated here).
 *  - pushBinderZipToClio: builds an Exhibit Binder ZIP (Exhibit N naming) from
 *    shared items, then uploads it via the same Clio document contract.
 *
 * Consent and matter link are re-checked server-side. Soft claims only.
 */
import { getValidClioAccessToken } from "@/lib/clio.server";
import { buildBinderEntries } from "@/lib/binder";
import { buildExhibitBinderZip } from "@/lib/binder-zip.server";
import { byDateAscNullsLast, ChunkedReadError, selectInChunks } from "@/lib/in-chunks.server";

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

type GuardOk = {
  ok: true;
  link: { id: string; client_user_id: string };
  matterId: string;
  token: string;
};
type GuardFail = { ok: false; reason: string };

/** Shared consent + matter + token gates used by every Clio upload path. */
async function assertClioUploadGuards(
  attorneyUserId: string,
  attorneyClientLinkId: string,
): Promise<GuardOk | GuardFail> {
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

  return {
    ok: true,
    link: { id: link.id, client_user_id: link.client_user_id },
    matterId: matterLink.clio_matter_id,
    token,
  };
}

async function uploadBytesToClioMatter(args: {
  attorneyUserId: string;
  attorneyClientLinkId: string;
  clientUserId: string;
  matterId: string;
  token: string;
  documentName: string;
  bytes: Uint8Array;
  auditEvent: string;
}): Promise<PushResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: logRow } = await supabaseAdmin
    .from("clio_document_exports")
    .insert({
      attorney_user_id: args.attorneyUserId,
      attorney_client_link_id: args.attorneyClientLinkId,
      clio_matter_id: args.matterId,
      document_name: args.documentName,
      byte_size: args.bytes.byteLength,
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
    const doc = await createClioDocument(args.token, args.matterId, args.documentName);
    if (!doc.id || !doc.putUrl || !doc.versionUuid) {
      return await fail("Clio didn't return an upload target for that document.", "no_put_url");
    }

    const put = await fetch(doc.putUrl, {
      method: "PUT",
      headers: doc.putHeaders,
      body: Buffer.from(args.bytes),
    });
    if (!put.ok) {
      console.error("[clio] document bytes upload failed with status", put.status);
      return await fail("Clio didn't accept the file contents.", `put_${put.status}`);
    }

    await markFullyUploaded(args.token, doc.id, doc.versionUuid);

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
        p_user_id: args.clientUserId,
        p_event_type: args.auditEvent,
        p_subject_kind: "export",
        p_actor_kind: "attorney",
        p_actor_id: args.attorneyUserId,
      })
      .then(
        () => undefined,
        (e: unknown) => console.error("[audit] clio push log failed", e),
      );

    return {
      ok: true,
      clio_document_id: doc.id,
      document_name: args.documentName,
      bytes: args.bytes.byteLength,
    };
  } catch (e) {
    return await fail(
      e instanceof Error ? e.message : "We couldn't finish sending that file to Clio.",
      "exception",
    );
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
  const guards = await assertClioUploadGuards(attorneyUserId, attorneyClientLinkId);
  if (!guards.ok) return guards;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Only ever send a packet the attorney already generated in PatternProof.
  const prefix = `professional-review-packet-${guards.link.client_user_id}-`;
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

  return uploadBytesToClioMatter({
    attorneyUserId,
    attorneyClientLinkId,
    clientUserId: guards.link.client_user_id,
    matterId: guards.matterId,
    token: guards.token,
    documentName: latest.name,
    bytes,
    auditEvent: "clio.document_pushed",
  });
}

/**
 * Builds the Exhibit Binder ZIP (Exhibit N naming) from items the client
 * shared on this link, then uploads it to the linked Clio matter.
 * Soft claims only — nothing is sent without consent + matter link.
 */
export async function pushBinderZipToClio(
  attorneyUserId: string,
  attorneyClientLinkId: string,
): Promise<PushResult> {
  const guards = await assertClioUploadGuards(attorneyUserId, attorneyClientLinkId);
  if (!guards.ok) return guards;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const access = await import("@/lib/attorney-access.server");

  // Load the exact relationship the attorney asked to push (multi-case caseload).
  const { data: specific } = await supabaseAdmin
    .from("attorney_client_links")
    .select(access.LINK_COLUMNS)
    .eq("id", attorneyClientLinkId)
    .eq("attorney_user_id", attorneyUserId)
    .maybeSingle();
  if (!specific || !access.isActiveShareLink(specific)) {
    return { ok: false, reason: "That case file isn't active for your account." };
  }
  const link = specific as Awaited<ReturnType<typeof access.assertLink>>;
  const clientId = guards.link.client_user_id;
  await access.applyCaseScope(supabaseAdmin, link, clientId);
  const scopeIncidents = (link.scope_incidents as string[] | null) ?? [];
  const scopeEvidence = (link.scope_evidence as string[] | null) ?? [];
  const includeAllIncidents = link.include_all_incidents === true;
  const includeAllEvidence = link.include_all_evidence === true;

  // Read the shared items in batches and fail loudly: a binder missing some of the
  // selected items must never be sent to a matter as if it were complete.
  const incidentsQuery = includeAllIncidents
    ? supabaseAdmin
        .from("incidents")
        .select("*")
        .eq("user_id", clientId)
        .is("deleted_at", null)
        .or("source.neq.ai_extracted,confirmed_at.not.is.null")
        .order("date", { ascending: true })
        .then((r) => {
          if (r.error) throw new ChunkedReadError("shared incident", r.error.message);
          return r.data ?? [];
        })
    : selectInChunks(
        scopeIncidents,
        (chunk) =>
          supabaseAdmin
            .from("incidents")
            .select("*")
            .eq("user_id", clientId)
            .in("id", chunk)
            .is("deleted_at", null)
            .or("source.neq.ai_extracted,confirmed_at.not.is.null")
            .order("date", { ascending: true }),
        { sort: byDateAscNullsLast, what: "shared incident" },
      );

  const evidenceQuery = includeAllEvidence
    ? supabaseAdmin
        .from("evidence")
        .select("*")
        .eq("user_id", clientId)
        .is("deleted_at", null)
        .neq("review_status", "suggested")
        .order("date", { ascending: true })
        .then((r) => {
          if (r.error) throw new ChunkedReadError("shared file", r.error.message);
          return r.data ?? [];
        })
    : selectInChunks(
        scopeEvidence,
        (chunk) =>
          supabaseAdmin
            .from("evidence")
            .select("*")
            .eq("user_id", clientId)
            .in("id", chunk)
            .is("deleted_at", null)
            .neq("review_status", "suggested")
            .order("date", { ascending: true }),
        { sort: byDateAscNullsLast, what: "shared file" },
      );

  const requestsQuery = supabaseAdmin
    .from("attorney_document_requests")
    .select(
      "id,title,details,kind,due_at,status,created_at,submitted_at,declined_at,response_note,response_evidence_ids",
    )
    .eq("link_id", attorneyClientLinkId)
    .eq("attorney_user_id", attorneyUserId)
    .order("created_at", { ascending: false });

  let incRows: unknown[];
  let evRows: unknown[];
  let reqRes: Awaited<typeof requestsQuery>;
  try {
    [incRows, evRows, reqRes] = await Promise.all([incidentsQuery, evidenceQuery, requestsQuery]);
  } catch (e) {
    if (e instanceof ChunkedReadError) return { ok: false, reason: e.message };
    throw e;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const incidents = incRows as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evidence = (evRows as any[]).map((e) => {
    const clone = { ...(e as Record<string, unknown>) };
    delete clone.gps_lat;
    delete clone.gps_lon;
    delete clone.gps_reveal_opt_in;
    return clone;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requests = (reqRes.data ?? []) as any[];

  const entries = buildBinderEntries(incidents, evidence, requests);
  if (entries.length === 0) {
    return {
      ok: false,
      reason:
        "Nothing to send yet. The exhibit binder is empty for this client — shared entries or files need to be on the binder first.",
    };
  }

  const evidenceFiles = new Map<
    string,
    { bytes: Uint8Array; extension?: string; contentType?: string }
  >();
  // A file that can't be read must never be left out quietly: a binder that is missing
  // an exhibit's file would otherwise be sent to the matter as if it were complete.
  const unreadable: string[] = [];
  await Promise.all(
    evidence.map(async (raw) => {
      const e = raw as { id: string; title?: string | null; file_url?: string | null };
      if (!e.file_url || /^https?:\/\//i.test(e.file_url)) {
        unreadable.push(e.title || e.id);
        return;
      }
      const { data: blob } = await supabaseAdmin.storage
        .from("evidence-files")
        .download(e.file_url);
      if (!blob) {
        unreadable.push(e.title || e.id);
        return;
      }
      const buf = new Uint8Array(await blob.arrayBuffer());
      const ext = String(e.file_url).split(".").pop() || "bin";
      evidenceFiles.set(e.id, { bytes: buf, extension: ext });
    }),
  );
  if (unreadable.length > 0) {
    return {
      ok: false,
      reason: `${unreadable.length} shared file(s) couldn't be read from storage, so the binder was NOT sent. Nothing was left out silently. Re-upload them or send the exhibits one by one.`,
    };
  }

  const built = await buildExhibitBinderZip({
    entries,
    evidenceFiles,
    clientRef: clientId,
  });

  // Keep a copy in exports so attorneys can re-send without regenerating (mirrors packets).
  const objectPath = `${attorneyUserId}/${built.documentName}`;
  await supabaseAdmin.storage
    .from("exports")
    .upload(objectPath, built.zipBuf, {
      contentType: "application/zip",
      upsert: false,
    })
    .then(
      () => undefined,
      (e: unknown) => console.error("[clio] binder zip storage mirror failed", e),
    );

  return uploadBytesToClioMatter({
    attorneyUserId,
    attorneyClientLinkId,
    clientUserId: clientId,
    matterId: guards.matterId,
    token: guards.token,
    documentName: built.documentName,
    bytes: built.zipBuf,
    auditEvent: "clio.binder_pushed",
  });
}
