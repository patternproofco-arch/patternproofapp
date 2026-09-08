import JSZip from "jszip";
import { createHash } from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Shared, server-authoritative packet builder for advocate access.
 *
 * Every read here starts from an ACTIVE, non-expired advocate_client_links row.
 * The link is the only source of scope: route params, ids and client state are
 * never trusted. Expired or revoked links resolve to null and every caller
 * fails closed.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type ResolvedGrant = {
  link_id: string;
  advocate_user_id: string;
  client_user_id: string;
  case_id: string | null;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  status: string;
  org_admin_visibility: boolean;
  include_all_incidents: boolean;
  include_all_evidence: boolean;
  include_patterns: boolean;
  scope_incidents: string[];
  scope_evidence: string[];
  invited_email: string | null;
  org_name: string | null;
};

function notExpired(row: { expires_at?: string | null }, invExpires: string | null) {
  const now = Date.now();
  if (row.expires_at && new Date(row.expires_at).getTime() < now) return false;
  if (invExpires && new Date(invExpires).getTime() < now) return false;
  return true;
}

/**
 * Resolve the effective grant between one advocate and one survivor.
 * Returns null when there is no active, non-expired link — never a partial.
 */
export async function resolveAdvocateGrant(
  admin: Admin,
  opts: { advocateUserId: string; clientUserId: string; linkId?: string },
): Promise<ResolvedGrant | null> {
  let q = admin
    .from("advocate_client_links")
    .select("*")
    .eq("advocate_user_id", opts.advocateUserId)
    .eq("client_user_id", opts.clientUserId)
    .eq("status", "active");
  if (opts.linkId) q = q.eq("id", opts.linkId);
  const { data: rows } = await q.order("created_at", { ascending: false }).limit(1);
  const link = (rows ?? [])[0];
  if (!link) return null;

  let invExpires: string | null = null;
  let invitedEmail: string | null = null;
  let orgName: string | null = null;
  if (link.invitation_id) {
    const { data: inv } = await admin
      .from("advocate_invitations")
      .select("expires_at,advocate_email,org_name,status")
      .eq("id", link.invitation_id)
      .maybeSingle();
    if (inv) {
      if (inv.status === "revoked") return null;
      invExpires = inv.expires_at ?? null;
      invitedEmail = inv.advocate_email ?? null;
      orgName = inv.org_name ?? null;
    }
  }
  if (!notExpired(link, invExpires)) return null;

  let includeAllIncidents = !!link.include_all_incidents;
  let includeAllEvidence = !!link.include_all_evidence;
  let scopedIncidents = (link.scope_incidents ?? []) as string[];
  let scopedEvidence = (link.scope_evidence ?? []) as string[];

  // A case-scoped grant is the intersection of the grant and the case: only
  // the items the survivor attached to that case are ever in range.
  if (link.case_id) {
    const { data: c } = await admin
      .from("cases")
      .select("highlighted_incident_ids,attached_evidence_ids")
      .eq("id", link.case_id)
      .eq("user_id", opts.clientUserId)
      .maybeSingle();
    includeAllIncidents = false;
    includeAllEvidence = false;
    scopedIncidents = (c?.highlighted_incident_ids ?? []) as string[];
    scopedEvidence = (c?.attached_evidence_ids ?? []) as string[];
  }

  return {
    link_id: link.id,
    advocate_user_id: link.advocate_user_id,
    client_user_id: link.client_user_id,
    case_id: link.case_id ?? null,
    granted_at: link.created_at,
    expires_at: link.expires_at ?? invExpires,
    revoked_at: link.revoked_at ?? null,
    status: link.status,
    org_admin_visibility: !!link.org_admin_visibility,
    include_all_incidents: includeAllIncidents,
    include_all_evidence: includeAllEvidence,
    include_patterns: !!link.include_patterns,
    scope_incidents: scopedIncidents,
    scope_evidence: scopedEvidence,
    invited_email: invitedEmail,
    org_name: orgName,
  };
}

/** True when the grant authorises no content at all. Empty scope = no access. */
export function grantIsEmpty(g: ResolvedGrant) {
  const incidents = g.include_all_incidents || g.scope_incidents.length > 0;
  const evidence = g.include_all_evidence || g.scope_evidence.length > 0;
  return !incidents && !evidence && !g.include_patterns;
}

export type ScopedContent = {
  caseRow: Record<string, unknown> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  incidents: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evidence: any[];
};

export async function loadScopedContent(admin: Admin, g: ResolvedGrant): Promise<ScopedContent> {
  const uid = g.client_user_id;
  const incQ = g.include_all_incidents
    ? admin
        .from("incidents")
        .select("*")
        .eq("user_id", uid)
        .is("deleted_at", null)
        .or("source.neq.ai_extracted,confirmed_at.not.is.null")
        .order("date", { ascending: true })
    : g.scope_incidents.length
      ? admin
          .from("incidents")
          .select("*")
          .eq("user_id", uid)
          .in("id", g.scope_incidents)
          .is("deleted_at", null)
          .or("source.neq.ai_extracted,confirmed_at.not.is.null")
          .order("date", { ascending: true })
      : Promise.resolve({ data: [] });
  const evQ = g.include_all_evidence
    ? admin
        .from("evidence")
        .select("*")
        .eq("user_id", uid)
        .is("deleted_at", null)
        .neq("review_status", "suggested")
        .order("date", { ascending: true })
    : g.scope_evidence.length
      ? admin
          .from("evidence")
          .select("*")
          .eq("user_id", uid)
          .in("id", g.scope_evidence)
          .is("deleted_at", null)
          .neq("review_status", "suggested")
          .order("date", { ascending: true })
      : Promise.resolve({ data: [] });
  const caseQ = g.case_id
    ? admin.from("cases").select("*").eq("id", g.case_id).eq("user_id", uid).maybeSingle()
    : Promise.resolve({ data: null });

  const [inc, ev, cs] = await Promise.all([incQ, evQ, caseQ]);
  return {
    caseRow: (cs.data as Record<string, unknown> | null) ?? null,
    incidents: inc.data ?? [],
    evidence: ev.data ?? [],
  };
}

/* --------------------------------- PDF ---------------------------------- */

const NOT_LEGAL_NOTE =
  "Advocates and organization staff are not necessarily lawyers. Their confidentiality " +
  "obligations vary by role, organization and jurisdiction. This packet is a record of what " +
  "was documented in PatternProof. It is not legal advice and makes no legal claim.";

const RETRACTION_NOTE =
  "Once this packet is downloaded it exists outside PatternProof. Withdrawing access stops " +
  "future access in the app, but PatternProof cannot retract copies that have already been " +
  "downloaded, printed or forwarded.";

export type PacketInput = {
  grant: ResolvedGrant;
  content: ScopedContent;
  advocate: { full_name?: string | null; org_name?: string | null; email?: string | null } | null;
  generatedAt: string;
  audience: "survivor" | "advocate";
};

export async function buildPacketPdf(input: PacketInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 54;
  const width = 595.28;
  const height = 841.89;
  let page = pdf.addPage([width, height]);
  let y = height - margin;

  const wrap = (text: string, size: number, f: typeof font) => {
    const max = width - margin * 2;
    const words = String(text).replace(/\s+/g, " ").trim().split(" ");
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > max) {
        if (line) lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };

  const write = (text: string, opts?: { size?: number; boldFace?: boolean; gap?: number }) => {
    const size = opts?.size ?? 10.5;
    const f = opts?.boldFace ? bold : font;
    for (const line of wrap(text, size, f)) {
      if (y < margin + 40) {
        page = pdf.addPage([width, height]);
        y = height - margin;
      }
      page.drawText(line, { x: margin, y, size, font: f, color: rgb(0.13, 0.1, 0.16) });
      y -= size + 4;
    }
    y -= opts?.gap ?? 4;
  };

  const g = input.grant;
  write("PatternProof — Advocate access packet", { size: 18, boldFace: true, gap: 10 });
  write(`Generated ${new Date(input.generatedAt).toLocaleString()}`, { size: 9.5, gap: 12 });

  write("Sharing scope", { size: 13, boldFace: true, gap: 6 });
  write(
    `Shared with: ${input.advocate?.full_name ?? g.invited_email ?? "Advocate"}${
      input.advocate?.org_name || g.org_name
        ? ` — ${input.advocate?.org_name ?? g.org_name}`
        : ""
    }`,
  );
  if (input.advocate?.email || g.invited_email)
    write(`Invited address: ${input.advocate?.email ?? g.invited_email}`);
  write(`Granted: ${new Date(g.granted_at).toLocaleString()}`);
  write(`Expires: ${g.expires_at ? new Date(g.expires_at).toLocaleString() : "No expiry set"}`);
  write(
    `Status: ${g.status === "active" ? "Active" : "Withdrawn"}${
      g.revoked_at ? ` on ${new Date(g.revoked_at).toLocaleString()}` : ""
    }`,
  );
  write(
    `Journal entries shared: ${
      g.include_all_incidents ? "All entries" : `${g.scope_incidents.length} selected`
    }`,
  );
  write(
    `Evidence shared: ${
      g.include_all_evidence ? "All evidence" : `${g.scope_evidence.length} selected`
    }`,
  );
  write(`Pattern grouping shared: ${g.include_patterns ? "Yes" : "No"}`);
  write(`Organization-level visibility: ${g.org_admin_visibility ? "On" : "Off"}`, { gap: 10 });

  if (input.content.caseRow) {
    const c = input.content.caseRow as Record<string, string | null>;
    write("Case", { size: 13, boldFace: true, gap: 6 });
    write(`Label: ${c.case_name || c.other_party || "Case"}`);
    if (c.case_type) write(`Type: ${c.case_type}`);
    if (c.jurisdiction) write(`Jurisdiction: ${c.jurisdiction}`);
    y -= 6;
  }

  write("Timeline", { size: 13, boldFace: true, gap: 6 });
  if (input.content.incidents.length === 0) {
    write("No journal entries are included in this scope.", { gap: 8 });
  } else {
    for (const i of input.content.incidents) {
      write(`${i.date ?? "Undated"}${i.time ? ` ${i.time}` : ""}`, { size: 10.5, boldFace: true });
      const meta = [
        (i.abuse_types ?? []).join(", ") || null,
        i.location ? `Location: ${i.location}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      if (meta) write(meta, { size: 9.5 });
      if (i.description) write(String(i.description), { size: 10 });
      y -= 2;
    }
  }
  y -= 6;

  write("Evidence index", { size: 13, boldFace: true, gap: 6 });
  if (input.content.evidence.length === 0) {
    write("No evidence is included in this scope.", { gap: 8 });
  } else {
    for (const e of input.content.evidence) {
      write(`${e.date ?? "Undated"} — ${e.title ?? "Untitled"} (${e.file_type ?? "file"})`, {
        size: 10,
      });
      if (e.description) write(String(e.description), { size: 9.5 });
    }
  }
  y -= 8;

  write("What this packet is", { size: 13, boldFace: true, gap: 6 });
  write(NOT_LEGAL_NOTE, { size: 9.5 });
  write(RETRACTION_NOTE, { size: 9.5 });

  return await pdf.save();
}

/* --------------------------------- ZIP ---------------------------------- */

function csv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export async function buildAdvocateZip(
  admin: Admin,
  input: PacketInput & { includeFiles: boolean },
): Promise<Uint8Array> {
  const zip = new JSZip();
  const g = input.grant;

  zip.file("PatternProof-Advocate-Packet.pdf", await buildPacketPdf(input));

  zip.file(
    "timeline.csv",
    csv(
      input.content.incidents.map((i) => ({
        incident_id: i.id,
        date: i.date,
        time: i.time ?? "",
        location: i.location ?? "",
        categories: (i.abuse_types ?? []).join("; "),
        description: i.description ?? "",
      })),
    ),
  );

  zip.file(
    "consent-manifest.json",
    JSON.stringify(
      {
        grant_id: g.link_id,
        case_id: g.case_id,
        status: g.status,
        granted_at: g.granted_at,
        expires_at: g.expires_at,
        revoked_at: g.revoked_at,
        scope: {
          include_all_incidents: g.include_all_incidents,
          include_all_evidence: g.include_all_evidence,
          include_patterns: g.include_patterns,
          selected_incident_ids: g.include_all_incidents ? null : g.scope_incidents,
          selected_evidence_ids: g.include_all_evidence ? null : g.scope_evidence,
          organization_visibility: g.org_admin_visibility,
        },
        invited_email: g.invited_email,
        note: RETRACTION_NOTE,
      },
      null,
      2,
    ),
  );

  const files: Array<Record<string, unknown>> = [];
  if (input.includeFiles) {
    const folder = zip.folder("evidence");
    await Promise.all(
      input.content.evidence.map(async (e) => {
        if (!folder || !e.file_url) return;
        const { data } = await admin.storage.from("evidence-files").download(e.file_url);
        if (!data) return;
        const buf = new Uint8Array(await data.arrayBuffer());
        const ext = String(e.file_url).split(".").pop() || "bin";
        const safe = `${e.date ?? "undated"}_${String(e.id).slice(0, 8)}_${String(e.title ?? "evidence")
          .replace(/[^a-zA-Z0-9-_]+/g, "_")
          .slice(0, 60)}.${ext}`;
        folder.file(safe, buf);
        files.push({
          file: `evidence/${safe}`,
          evidence_id: e.id,
          title: e.title,
          date: e.date,
          file_type: e.file_type,
          linked_incident_id: e.linked_incident_id ?? null,
          bytes: buf.byteLength,
          sha256: createHash("sha256").update(Buffer.from(buf)).digest("hex"),
        });
      }),
    );
  }

  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        generated_at: input.generatedAt,
        generated_for: input.audience,
        grant_id: g.link_id,
        incident_ids: input.content.incidents.map((i) => i.id),
        evidence_ids: input.content.evidence.map((e) => e.id),
        files,
        contents: [
          "PatternProof-Advocate-Packet.pdf",
          "timeline.csv",
          "consent-manifest.json",
          ...(input.includeFiles ? ["evidence/"] : []),
        ],
      },
      null,
      2,
    ),
  );

  return await zip.generateAsync({ type: "uint8array" });
}
